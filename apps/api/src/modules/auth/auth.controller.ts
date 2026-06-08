import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TotpVerifyDto, TotpConfirmDto, TotpDisableDto, TotpSetupResponseDto, TotpRequiredResponseDto } from './dto/totp.dto';
import { GoogleProfile } from './strategies/google.strategy';
import { RefreshPayload } from './strategies/jwt-refresh.strategy';
import { JwtPayload } from './strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // POST /auth/register
  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    return this.authService.register(dto, res);
  }

  // POST /auth/login
  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 202, type: TotpRequiredResponseDto, description: 'TOTP required — use partialToken with POST /auth/totp/verify' })
  async login(
    @Body() dto: LoginDto,
    @Res() res: Response,
  ): Promise<void> {
    // Use @Res() (not passthrough) so res.status() is not overridden by @HttpCode
    const result = await this.authService.login(dto, res);
    const status = 'requiresTOTP' in result && result.requiresTOTP
      ? HttpStatus.ACCEPTED
      : HttpStatus.OK;
    res.status(status).json(result);
  }

  // POST /auth/totp/verify
  @Public()
  @Post('totp/verify')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete admin login with TOTP code' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async totpVerify(
    @Body() dto: TotpVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.verifyTotp(dto.partialToken, dto.code, res);
  }

  // GET /auth/totp/setup
  @Get('totp/setup')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate TOTP setup data (QR code + backup codes)' })
  @ApiResponse({ status: 200, type: TotpSetupResponseDto })
  async totpSetup(@CurrentUser() user: JwtPayload): Promise<TotpSetupResponseDto> {
    return this.authService.setupTotp(user.sub);
  }

  // POST /auth/totp/confirm
  @Post('totp/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirm TOTP setup by verifying a code' })
  @ApiResponse({ status: 200, description: 'Returns backup codes' })
  async totpConfirm(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TotpConfirmDto,
  ): Promise<{ backupCodes: string[] }> {
    return this.authService.confirmTotp(user.sub, dto.secret, dto.code);
  }

  // POST /auth/totp/disable
  @Post('totp/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable TOTP 2FA' })
  async totpDisable(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TotpDisableDto,
  ): Promise<void> {
    return this.authService.disableTotp(user.sub, dto.code);
  }

  // POST /auth/logout
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken: string | undefined = req.cookies?.['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(user.sub, refreshToken);
    }
    this.authService.clearRefreshTokenCookie(res);
  }

  // POST /auth/refresh
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Rotate refresh token and get new access token' })
  async refresh(
    @CurrentUser() payload: RefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.refreshTokens(payload.userId, payload.refreshToken, res);
  }

  // POST /auth/verify-email
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Verify email with token from verification email' })
  async verifyEmail(@Body('token') token: string): Promise<void> {
    return this.authService.verifyEmail(token);
  }

  // POST /auth/resend-verification
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.authService.resendVerification(user.sub);
  }

  // POST /auth/forgot-password
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { ttl: 900_000, limit: 3 } })   // 3 per 15 min — prevent email spam
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(dto.email);
  }

  // POST /auth/reset-password
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // POST /auth/change-password
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password (requires current password)' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  // GET /auth/google
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  googleLogin(): void {
    // Passport redirects to Google
  }

  // GET /auth/google/callback
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleCallback(
    @CurrentUser() profile: GoogleProfile,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.googleLogin(profile, res);
    const frontendUrl = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }
}
