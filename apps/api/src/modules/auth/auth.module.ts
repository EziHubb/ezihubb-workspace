import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DevBullModule } from '../../queue/dev-bull.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UsersModule } from '../users/users.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // secrets injected per-call in AuthService.generateTokens
    ConfigModule,
    ...(process.env['DISABLE_QUEUE'] !== 'true'
      ? [BullModule.registerQueue({ name: QUEUES.EMAIL })]
      : [DevBullModule.forQueues([QUEUES.EMAIL])]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TotpService, JwtStrategy, JwtRefreshStrategy, GoogleStrategy],
  exports: [AuthService, TotpService],
})
export class AuthModule {}
