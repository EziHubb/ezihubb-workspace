import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { DEFAULT_JOB_OPTIONS, JOBS, QUEUES, SendEmailJobData } from '../../queue/queue.constants';

const COOKIE = 'guest_message_access';
const COOKIE_PATH = '/api/v1/messages';
const PROOF_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class GuestMessageAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async requestProof(rawEmail: string): Promise<{ challengeId: string; expiresIn: number }> {
    const email = rawEmail.trim().toLowerCase();
    const requests = await this.redis.incrementSecurityCounter(`guest-message:proof:${hash(email)}`, 900);
    if (requests > 3) throw new UnauthorizedException({ code: 'ERR_GUEST_PROOF_LIMIT', message: 'Please wait 15 minutes before requesting another code.' });
    // DevBull deliberately does not deliver email; never report a queued proof there.
    if (this.config.get<string>('DISABLE_QUEUE') === 'true') {
      throw new ServiceUnavailableException({ code: 'ERR_GUEST_PROOF_UNAVAILABLE', message: 'Email verification is temporarily unavailable.' });
    }
    const code = randomInt(10_000_000, 100_000_000).toString();
    const record = await this.prisma.guestMessageAccess.create({ data: { email, expiresAt: new Date(Date.now() + PROOF_TTL_MS) } });
    await this.prisma.guestMessageAccess.update({ where: { id: record.id }, data: { verificationHash: hash(`${record.id}:${code}`) } });
    try {
      await this.emailQueue.add(JOBS.SEND_EMAIL, {
        to: email, template: 'guest-message-verification', subject: 'Your EziHubb messaging verification code',
        data: { code, expiresInMinutes: 15 },
      } satisfies SendEmailJobData, { ...DEFAULT_JOB_OPTIONS, removeOnComplete: true, removeOnFail: true });
    } catch {
      await this.prisma.guestMessageAccess.update({ where: { id: record.id }, data: { revokedAt: new Date(), verificationHash: null } });
      throw new ServiceUnavailableException({ code: 'ERR_GUEST_PROOF_UNAVAILABLE', message: 'Unable to send your code. Please try again later.' });
    }
    // Same response whether or not this mailbox has conversations/accounts.
    return { challengeId: record.id, expiresIn: PROOF_TTL_MS / 1000 };
  }

  async verifyProof(challengeId: string, code: string, res: Response): Promise<{ email: string }> {
    const now = new Date();
    // Reserve an attempt atomically before comparison; concurrent guesses count.
    const attempted = await this.prisma.guestMessageAccess.updateMany({
      where: { id: challengeId, verifiedAt: null, revokedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    if (attempted.count !== 1) throw this.invalidProof();
    const record = await this.prisma.guestMessageAccess.findUnique({ where: { id: challengeId } });
    const supplied = Buffer.from(hash(`${challengeId}:${code}`), 'hex');
    const expected = Buffer.from(record?.verificationHash ?? '', 'hex');
    if (!record || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw this.invalidProof();

    const token = randomBytes(32).toString('hex');
    const consumed = await this.prisma.guestMessageAccess.updateMany({
      where: { id: challengeId, verificationHash: record.verificationHash, verifiedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { verifiedAt: now, verificationHash: null, tokenHash: hash(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    if (consumed.count !== 1) throw this.invalidProof();
    res.cookie(COOKIE, token, { httpOnly: true, secure: this.config.get<string>('app.env') === 'production',
      sameSite: 'lax', path: COOKIE_PATH, maxAge: SESSION_TTL_MS });
    res.setHeader('Cache-Control', 'no-store');
    return { email: record.email };
  }

  async resolveEmail(req: Request): Promise<string | undefined> {
    const token: unknown = req.cookies?.[COOKIE];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return undefined;
    const record = await this.prisma.guestMessageAccess.findFirst({
      where: { tokenHash: hash(token), verifiedAt: { not: null }, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { email: true },
    });
    return record?.email;
  }

  async revoke(req: Request, res: Response): Promise<void> {
    const token: unknown = req.cookies?.[COOKIE];
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      await this.prisma.guestMessageAccess.updateMany({ where: { tokenHash: hash(token), revokedAt: null }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(COOKIE, { path: COOKIE_PATH, sameSite: 'lax', secure: this.config.get<string>('app.env') === 'production' });
  }

  private invalidProof(): UnauthorizedException {
    return new UnauthorizedException({ code: 'ERR_GUEST_PROOF_INVALID', message: 'Invalid or expired code. Request a new code if needed.' });
  }
}
