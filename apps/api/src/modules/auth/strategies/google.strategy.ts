import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:3002/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email: email ?? '',
      firstName: profile.name?.givenName ?? '',
      lastName: profile.name?.familyName ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, googleProfile);
  }
}
