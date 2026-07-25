import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: (configService.get<string>('JWT_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n'),
        publicKey: (configService.get<string>('JWT_PUBLIC_KEY') ?? '').replace(/\\n/g, '\n'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
