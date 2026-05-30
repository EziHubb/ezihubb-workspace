import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { JOBS, QUEUES, SendEmailJobData, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleProfile } from './strategies/google.strategy';

const BCRYPT_ROUNDS = 12;
const LOGIN_LOCK_KEY = (email: string) => `auth:login:${email}`;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_TTL_SECONDS = 900; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ─── Registration ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto, res: Response): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({ code: 'ERR_EMAIL_TAKEN', message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    // Queue verification email (fire-and-forget)
    await this.enqueueVerificationEmail(user.id, user.email, user.firstName ?? '').catch((err) =>
      this.logger.error(`Failed to enqueue verification email: ${err.message}`),
    );

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, res: Response): Promise<AuthResponseDto> {
    // Check account lock
    const lockKey = LOGIN_LOCK_KEY(dto.email);
    const attempts = await this.redis.get<number>(lockKey);
    if (attempts !== null && attempts >= LOGIN_MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        code: 'ERR_ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordHash) {
      await this.recordFailedLogin(lockKey);
      throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      await this.recordFailedLogin(lockKey);
      throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Invalid email or password' });
    }

    // Clear failed attempts on success
    await this.redis.del(lockKey);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    // TODO: merge guest cart — call CartService.mergeGuestCart(guestCartId, user.id) once CartService is implemented

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Refresh ───────────────────────────────────────────────────────────────

  async refreshTokens(userId: string, oldRefreshToken: string, res: Response): Promise<{ accessToken: string }> {
    const oldHash = createHash('sha256').update(oldRefreshToken).digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId, tokenHash: oldHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { email: true, role: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException({ code: 'ERR_REFRESH_TOKEN_INVALID' });
    }

    // Rotation: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(userId, stored.user.email, stored.user.role);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return { accessToken: tokens.accessToken };
  }

  // ─── Email verification ────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerification.findFirst({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!record) {
      throw new BadRequestException({ code: 'ERR_VERIFICATION_TOKEN_INVALID', message: 'Invalid or expired verification token' });
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { isEmailVerified: true },
      }),
    ]);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.isEmailVerified) {
      throw new BadRequestException({ code: 'ERR_ALREADY_VERIFIED', message: 'Email is already verified' });
    }
    await this.enqueueVerificationEmail(user.id, user.email, user.firstName ?? '');
  }

  // ─── Password reset ────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent user enumeration
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000); // 1 hour

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: email,
        template: 'password-reset',
        subject: 'Reset your MapleLoom password',
        data: { firstName: user.firstName, resetUrl: `${frontendUrl}/reset-password?token=${token}` },
      } satisfies SendEmailJobData,
      DEFAULT_JOB_OPTIONS,
    );
    this.logger.log(`Password reset email queued for ${email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordReset.findFirst({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!record) {
      throw new BadRequestException({ code: 'ERR_RESET_TOKEN_INVALID', message: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // Revoke all refresh tokens for the user
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.passwordHash) {
      throw new BadRequestException({ code: 'ERR_NO_PASSWORD', message: 'This account uses social login — set a password first' });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  async googleLogin(profile: GoogleProfile, res: Response): Promise<AuthResponseDto> {
    if (!profile.email) {
      throw new BadRequestException({ code: 'ERR_GOOGLE_NO_EMAIL', message: 'Google account has no email' });
    }

    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          provider: 'GOOGLE',
          providerId: profile.googleId,
          isEmailVerified: true,
        },
      });
    } else if (!user.providerId) {
      // Existing local account — link Google
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { provider: 'GOOGLE', providerId: profile.googleId, isEmailVerified: true },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: (this.config.get<string>('jwt.accessExpiresIn') ?? '15m') as any,
      },
    );

    const rawRefreshToken = randomBytes(40).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const refreshDays = 30;
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1_000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  setRefreshTokenCookie(res: Response, token: string): void {
    const isProd = this.config.get<string>('app.env') === 'production';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1_000, // 30 days in ms
      path: '/api/v1/auth',
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async recordFailedLogin(lockKey: string): Promise<void> {
    const current = await this.redis.increment(lockKey);
    if (current === 1) {
      // Set TTL only on first increment
      const client = this.redis.getClient();
      await client.expire(lockKey, LOGIN_LOCK_TTL_SECONDS);
    }
  }

  private async enqueueVerificationEmail(userId: string, email: string, firstName: string): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000); // 24 hours

    await this.prisma.emailVerification.create({
      data: { userId, token, expiresAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: email,
        template: 'email-verification',
        subject: 'Verify your MapleLoom email',
        data: { firstName, verifyUrl: `${frontendUrl}/verify-email?token=${token}` },
      } satisfies SendEmailJobData,
      DEFAULT_JOB_OPTIONS,
    );
    this.logger.log(`Verification email queued for ${email}`);
  }
}
