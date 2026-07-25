import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  public constructor(configService: ConfigService) {
    super({
      // passport-oauth2 throws a TypeError at boot if clientID is falsy, so a
      // placeholder keeps the app startable when Google OAuth isn't configured yet.
      // The /auth/google routes simply won't function until real credentials are set.
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  public validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback): void {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      done(new Error('Google profile did not return an email address'), undefined);
      return;
    }

    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      email,
      firstName: profile.name?.givenName ?? profile.displayName,
      lastName: profile.name?.familyName ?? '',
      avatar: profile.photos?.[0]?.value,
    };

    done(null, payload);
  }
}
