import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { JOBS, QUEUES, SendEmailJobData, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TotpRequiredResponseDto, TotpSetupResponseDto } from './dto/totp.dto';
import { TotpService } from './totp.service';
import { GoogleProfile } from './strategies/google.strategy';
import { MessagesService } from '../messages/messages.service';

const BCRYPT_ROUNDS = 12;
const LOGIN_LOCK_KEY = (email: string) => `auth:login:${email}`;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_TTL_SECONDS = 900; // 15 minutes
const TOTP_PARTIAL_TOKEN_EXPIRY = '5m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly totpService: TotpService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    private readonly messages: MessagesService,
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

    // A newly chosen password does not prove ownership of the mailbox.
    // Link guest history only after email verification.

    // Queue verification email (fire-and-forget)
    await this.enqueueVerificationEmail(user.id, user.email, user.firstName ?? '').catch((err) =>
      this.logger.error(`Failed to enqueue verification email: ${err.message}`),
    );

    const tokens = await this.generateTokens(user.id, user.email, user.role, false, user.storeId, undefined, res.req?.headers['user-agent']);
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
        storeId:     user.storeId ?? null,
        isSeller:    user.isSeller,
        permissions: (user.permissions ?? null) as import('@ezihubb/constants').PermissionDocument | null,
      },
    };
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, res: Response): Promise<AuthResponseDto | TotpRequiredResponseDto> {
    // Check account lock
    const lockKey = LOGIN_LOCK_KEY(dto.email);
    const attempts = await this.redis.getSecurityCounter(lockKey);
    if (attempts !== null && attempts >= LOGIN_MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        code: 'ERR_ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.deletedAt || !user.passwordHash) {
      await this.recordFailedLogin(lockKey);
      throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      await this.recordFailedLogin(lockKey);
      throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Invalid email or password' });
    }

    // Clear failed attempts on success
    await this.redis.clearSecurityCounter(lockKey);

    // An enabled factor applies to every role and every sign-in method.
    if (user.totpEnabled) {
      const partialToken = this.signPartialToken(user.id, user.email, user.role, dto.rememberMe);
      return { requiresTOTP: true, partialToken };
    }

    if (user.isEmailVerified) await this.linkVerifiedGuestHistory(user.id, user.email);

    const tokens = await this.generateTokens(user.id, user.email, user.role, dto.rememberMe, user.storeId, undefined, res.req?.headers['user-agent']);
    this.setRefreshTokenCookie(res, tokens.refreshToken, dto.rememberMe);

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
        storeId:     user.storeId ?? null,
        isSeller:    user.isSeller,
        permissions: (user.permissions ?? null) as import('@ezihubb/constants').PermissionDocument | null,
      },
    };
  }

  // ─── TOTP verify ───────────────────────────────────────────────────────────

  async verifyTotp(partialToken: string, code: string, res: Response): Promise<AuthResponseDto> {
    let payload: { sub: string; email: string; role: string; purpose: string; iat?: number; exp?: number; rememberMe?: boolean };
    try {
      const secret = this.config.get<string>('jwt.accessSecret');
      payload = this.jwtService.verify(partialToken, { secret }) as typeof payload;
    } catch {
      throw new UnauthorizedException({ code: 'ERR_TOTP_TOKEN_INVALID', message: 'Invalid or expired TOTP session' });
    }

    if (payload.purpose !== 'totp-pending' || typeof payload.sub !== 'string' || !payload.exp || !payload.iat) {
      throw new UnauthorizedException({ code: 'ERR_TOTP_TOKEN_INVALID', message: 'Invalid TOTP session token' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt || !user.totpEnabled || user.role !== payload.role ||
      (user.sessionsRevokedAt && payload.iat * 1000 <= user.sessionsRevokedAt.getTime())) {
      throw new UnauthorizedException({ code: 'ERR_TOTP_NOT_ENABLED' });
    }

    const attemptKey = `auth:totp:attempts:${user.id}`;
    // Count attempts before checking codes so concurrent guesses cannot bypass
    // the account-level budget by racing separate read/increment commands.
    const attempts = await this.redis.incrementSecurityCounter(attemptKey, LOGIN_LOCK_TTL_SECONDS);
    if (attempts > LOGIN_MAX_ATTEMPTS) {
      throw new UnauthorizedException({ code: 'ERR_ACCOUNT_LOCKED', message: 'Too many authentication attempts. Try again in 15 minutes.' });
    }

    // Try TOTP code first, then backup codes
    let valid = false;
    if (user.totpSecret) {
      const plainSecret = this.totpService.decryptSecret(user.totpSecret);
      valid = await this.totpService.verifyToken(plainSecret, code);
    }

    if (!valid && user.backupCodes.length > 0) {
      const remaining = await this.totpService.consumeBackupCode(user.backupCodes, code);
      if (remaining !== null) {
        const consumed = await this.prisma.user.updateMany({
          where: { id: user.id, backupCodes: { equals: user.backupCodes } },
          data: { backupCodes: remaining },
        });
        valid = consumed.count === 1;
      }
    }

    if (!valid) {
      throw new UnauthorizedException({ code: 'ERR_TOTP_CODE_INVALID', message: 'Invalid authentication code' });
    }

    const challengeKey = `auth:totp:used:${createHash('sha256').update(partialToken).digest('hex')}`;
    const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
    if (!(await this.redis.claimSecurityToken(challengeKey, ttl))) {
      throw new UnauthorizedException({ code: 'ERR_TOTP_TOKEN_INVALID', message: 'This sign-in was already completed. Please sign in again.' });
    }
    await this.redis.clearSecurityCounter(attemptKey);

    if (user.isEmailVerified) await this.linkVerifiedGuestHistory(user.id, user.email);

    const tokens = await this.generateTokens(user.id, user.email, user.role, payload.rememberMe === true, user.storeId, undefined, res.req?.headers['user-agent']);
    this.setRefreshTokenCookie(res, tokens.refreshToken, payload.rememberMe === true);

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
        storeId:     user.storeId ?? null,
        isSeller:    user.isSeller,
        permissions: (user.permissions ?? null) as import('@ezihubb/constants').PermissionDocument | null,
      },
    };
  }

  // ─── TOTP setup ────────────────────────────────────────────────────────────

  async setupTotp(userId: string): Promise<TotpSetupResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new ConflictException('Disable the existing factor before setting up a new one');
    const secret = this.totpService.newSecret();
    const uri = this.totpService.otpAuthUri(secret, user.email);
    const qrCodeDataUrl = await this.totpService.qrCodeDataUrl(uri);
    // Backup codes are generated and returned only after confirmTotp — not here
    return { secret, qrCodeDataUrl };
  }

  async confirmTotp(userId: string, secret: string, code: string): Promise<{ backupCodes: string[] }> {
    const valid = await this.totpService.verifyToken(secret, code);
    if (!valid) {
      throw new BadRequestException({ code: 'ERR_TOTP_CODE_INVALID', message: 'Invalid code — scan QR code again and try' });
    }

    const plainCodes = this.totpService.generateBackupCodes();
    const hashedCodes = await this.totpService.hashBackupCodes(plainCodes);
    const encryptedSecret = this.totpService.encryptSecret(secret);

    const enabled = await this.prisma.user.updateMany({
      where: { id: userId, totpEnabled: false, deletedAt: null },
      data: { totpSecret: encryptedSecret, totpEnabled: true, totpVerifiedAt: new Date(), backupCodes: hashedCodes },
    });
    if (enabled.count !== 1) throw new ConflictException('Two-factor authentication is already enabled or account unavailable');

    return { backupCodes: plainCodes };
  }

  async disableTotp(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException({ code: 'ERR_TOTP_NOT_ENABLED', message: '2FA is not currently enabled' });
    }

    const plainSecret = this.totpService.decryptSecret(user.totpSecret);
    const valid = await this.totpService.verifyToken(plainSecret, code);
    if (!valid) {
      throw new UnauthorizedException({ code: 'ERR_TOTP_CODE_INVALID', message: 'Invalid authentication code' });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false, totpVerifiedAt: null, backupCodes: [] },
    });
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  /** Revoke all sessions and legacy tokens; access is checked on every API request. */
  async logoutAll(userId: string): Promise<{ revoked: number }> {
    const revokedAt = new Date();
    const [, , { count }] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { sessionsRevokedAt: revokedAt } }),
      this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } }),
    ]);
    return { revoked: count };
  }

  async listSessions(userId: string, currentSessionId?: string, page = 1) {
    const take = 10;
    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.authSession.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take,
        select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, ipAddress: true, userAgent: true, location: true },
      }),
      this.prisma.authSession.count({ where: { userId } }),
    ]);
    return {
      data: sessions.map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId,
        status: session.revokedAt ? 'SIGNED_OUT' : session.expiresAt <= new Date() ? 'EXPIRED' : 'ACTIVE',
      })),
      total, page, totalPages: Math.ceil(total / take),
      legacySession: !currentSessionId,
    };
  }

  async recordSessionDevice(userId: string, sessionId: string | undefined, ipAddress?: string, userAgent?: string) {
    if (!sessionId) return;
    // Called by the browser, so the address is the API-observed connection,
    // not the server-to-server NextAuth login request. Capture once per sign-in.
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null, ipAddress: null },
      data: { ipAddress: ipAddress?.slice(0, 64), userAgent: userAgent?.slice(0, 512) },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.authSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Session not found');
    const revokedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt } }),
      this.prisma.refreshToken.updateMany({ where: { sessionId, userId, revokedAt: null }, data: { revokedAt } }),
    ]);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({ where: { userId, tokenHash } });
    if (stored?.sessionId) {
      await this.revokeSession(userId, stored.sessionId);
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Refresh ───────────────────────────────────────────────────────────────

  async refreshTokens(userId: string, oldRefreshToken: string, res: Response): Promise<{ accessToken: string }> {
    const oldHash = createHash('sha256').update(oldRefreshToken).digest('hex');

    const tokens = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const stored = await tx.refreshToken.findFirst({
        where: { userId, tokenHash: oldHash, revokedAt: null, expiresAt: { gt: now } },
        include: { user: { select: { email: true, role: true, storeId: true, deletedAt: true } }, session: true },
      });
      if (!stored || stored.user.deletedAt ||
        (stored.sessionId && !stored.session) ||
        (stored.session && (stored.session.revokedAt || stored.session.expiresAt <= now))) {
        throw new UnauthorizedException({ code: 'ERR_REFRESH_TOKEN_INVALID' });
      }

      // Only one concurrent request may consume this token. Creating its
      // successor in this transaction means a signing/DB failure rolls it back.
      const consumed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (consumed.count !== 1) throw new UnauthorizedException({ code: 'ERR_REFRESH_TOKEN_INVALID' });
      return this.generateTokens(userId, stored.user.email, stored.user.role, false,
        stored.user.storeId, stored.sessionId ?? undefined, undefined, tx,
        stored.session?.expiresAt ?? stored.expiresAt);
    });
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return { accessToken: tokens.accessToken };
  }

  // ─── Email verification ────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    // @Body('token') is not a validated DTO. Undefined would otherwise omit
    // the Prisma token predicate and select an unrelated verification record.
    if (typeof token !== 'string' || !token.trim()) {
      throw new BadRequestException({ code: 'ERR_VERIFICATION_TOKEN_INVALID', message: 'Invalid or expired verification token' });
    }
    const record = await this.prisma.emailVerification.findFirst({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!record) {
      throw new BadRequestException({ code: 'ERR_VERIFICATION_TOKEN_INVALID', message: 'Invalid or expired verification token' });
    }

    const [, verifiedUser] = await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { isEmailVerified: true },
      }),
    ]);
    await this.linkVerifiedGuestHistory(verifiedUser.id, verifiedUser.email);
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
      data: { userId: user.id, email: user.email, token, expiresAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    await this.emailQueue.add(
      JOBS.SEND_EMAIL,
      {
        to: email,
        template: 'password-reset',
        subject: 'Reset your EziHubb password',
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
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, sessionsRevokedAt: new Date() } }),
      this.prisma.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      // Revoke all refresh tokens for the user
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.passwordHash) {
      // Normal change — the account already has a password, so the caller
      // must prove they know it.
      if (!currentPassword) {
        throw new BadRequestException({ code: 'ERR_CURRENT_PASSWORD_REQUIRED', message: 'Current password is required' });
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        throw new UnauthorizedException({ code: 'ERR_CREDENTIALS_INVALID', message: 'Current password is incorrect' });
      }
    }
    // else: account signed up via Google and has no password yet — setting
    // one for the first time needs no current-password check, since there
    // isn't one to prove knowledge of.

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, sessionsRevokedAt: new Date() } }),
      this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  /** Legacy OAuth 2.0 authorization-code flow — GET /auth/google → Google consent page → GET /auth/google/callback. */
  async googleLogin(profile: GoogleProfile, res: Response): Promise<AuthResponseDto | TotpRequiredResponseDto> {
    const user = await this.findOrCreateGoogleUser(profile);
    return this.buildGoogleAuthResponse(user, res);
  }

  /**
   * Google Identity Services (One Tap / "Sign in with Google" button) flow —
   * the client posts the ID token it received directly from Google's JS SDK,
   * with no redirect at all. Verifying it here (audience-checked against our
   * own client ID) is what stands in for the authorization-code exchange the
   * legacy flow above does via Passport.
   */
  async googleTokenLogin(idToken: string, res: Response): Promise<AuthResponseDto | TotpRequiredResponseDto> {
    const profile = await this.verifyGoogleIdToken(idToken);
    const user = await this.findOrCreateGoogleUser(profile);
    return this.buildGoogleAuthResponse(user, res);
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const client = new OAuth2Client(clientId);

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException({ code: 'ERR_GOOGLE_TOKEN_INVALID', message: 'Invalid Google credential' });
    }

    if (!payload?.email) {
      throw new BadRequestException({ code: 'ERR_GOOGLE_NO_EMAIL', message: 'Google account has no email' });
    }

    return {
      googleId:      payload.sub,
      email:         payload.email,
      emailVerified: payload.email_verified ?? false,
      firstName:     payload.given_name ?? '',
      lastName:      payload.family_name ?? '',
      avatarUrl:     payload.picture ?? null,
    };
  }

  private async findOrCreateGoogleUser(profile: GoogleProfile) {
    if (!profile.email) {
      throw new BadRequestException({ code: 'ERR_GOOGLE_NO_EMAIL', message: 'Google account has no email' });
    }
    // Without this, someone could sign in with an *unverified* Google email
    // that happens to match an existing local account and get silently
    // linked into — and logged in as — that account. Google marks an email
    // verified once its owner has proven receipt of it, so this is the one
    // check standing between "any string Google will hand us" and "an email
    // we can trust enough to auto-link an account by".
    if (!profile.emailVerified) {
      throw new BadRequestException({ code: 'ERR_GOOGLE_EMAIL_UNVERIFIED', message: 'Google email is not verified' });
    }

    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (user?.deletedAt || (user?.providerId && user.providerId !== profile.googleId)) {
      throw new UnauthorizedException({ code: 'ERR_GOOGLE_ACCOUNT_INVALID', message: 'Unable to sign in with this Google account.' });
    }

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

    return user;
  }

  private async buildGoogleAuthResponse(
    user: Awaited<ReturnType<AuthService['findOrCreateGoogleUser']>>,
    res: Response,
  ): Promise<AuthResponseDto | TotpRequiredResponseDto> {
    if (user.totpEnabled) {
      return { requiresTOTP: true, partialToken: this.signPartialToken(user.id, user.email, user.role) };
    }
    if (user.isEmailVerified) await this.linkVerifiedGuestHistory(user.id, user.email);
    const tokens = await this.generateTokens(user.id, user.email, user.role, false, user.storeId, undefined, res.req?.headers['user-agent']);
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
        storeId:     user.storeId ?? null,
        isSeller:    user.isSeller,
        permissions: (user.permissions ?? null) as import('@ezihubb/constants').PermissionDocument | null,
      },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  async generateTokens(
    userId: string,
    email: string,
    role: string,
    rememberMe = false,
    storeId?: string | null,
    existingSessionId?: string,
    userAgent?: string,
    db: Prisma.TransactionClient = this.prisma,
    expiryLimit?: Date,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET environment variable is not set');
    }

    const refreshDays = rememberMe ? 90 : 30;
    const expiresAt = new Date(Math.min(Date.now() + refreshDays * 24 * 60 * 60 * 1_000,
      expiryLimit?.getTime() ?? Number.POSITIVE_INFINITY));
    const sessionId = existingSessionId ?? (await db.authSession.create({
      data: { userId, expiresAt, userAgent: userAgent?.slice(0, 512) },
    })).id;

    const accessToken = this.jwtService.sign(
      { sub: userId, email, role, sid: sessionId, ...(storeId ? { storeId } : {}) },
      {
        secret,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: (this.config.get<string>('jwt.accessExpiresIn') ?? '15m') as any,
      },
    );

    const rawRefreshToken = randomBytes(40).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    await db.refreshToken.create({
      data: { userId, tokenHash, expiresAt, sessionId },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  setRefreshTokenCookie(res: Response, token: string, rememberMe = false): void {
    const isProd = this.config.get<string>('app.env') === 'production';
    const maxAgeDays = rememberMe ? 90 : 30;
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: maxAgeDays * 24 * 60 * 60 * 1_000,
      path: '/api/v1/auth',
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Called only after mailbox proof; failures retry on the next verified login. */
  private async linkVerifiedGuestHistory(userId: string, email: string): Promise<void> {
    this.linkGuestOrders(userId, email);
    await this.messages.linkGuestConversations(userId, email).catch(() =>
      this.logger.error(`Guest conversation linking failed for user=${userId}`),
    );
  }

  /** Only claims still-unowned records, never reassigns historical ownership. */
  private linkGuestOrders(userId: string, email: string): void {
    this.prisma.order.updateMany({
      where: { guestEmail: email.toLowerCase(), userId: null },
      data:  { userId },
    })
      .then(({ count }) => {
        if (count > 0) this.logger.log(`Linked ${count} guest order(s) to user=${userId}`);
      })
      .catch(() =>
        this.logger.error(`Failed to link guest orders for user=${userId}`),
      );
  }

  private signPartialToken(userId: string, email: string, role: string, rememberMe = false): string {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) throw new Error('JWT_ACCESS_SECRET not set');
    return this.jwtService.sign(
      { sub: userId, email, role, purpose: 'totp-pending', jti: randomBytes(16).toString('hex'), rememberMe },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { secret, expiresIn: TOTP_PARTIAL_TOKEN_EXPIRY as any },
    );
  }

  private async recordFailedLogin(lockKey: string): Promise<void> {
    await this.redis.incrementSecurityCounter(lockKey, LOGIN_LOCK_TTL_SECONDS);
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
        subject: 'Verify your EziHubb email',
        data: { firstName, verifyUrl: `${frontendUrl}/verify-email?token=${token}` },
      } satisfies SendEmailJobData,
      DEFAULT_JOB_OPTIONS,
    );
    this.logger.log(`Verification email queued for ${email}`);
  }
}
