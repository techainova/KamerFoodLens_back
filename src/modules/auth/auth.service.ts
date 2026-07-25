import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import { Role, User } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleProfilePayload } from './strategies/google.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string | null;
  role: Role;
  isEmailVerified: boolean;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const OTP_TTL_SECONDS = 10 * 60;
const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const RESET_TOKEN_PREFIX = 'reset_token:';

@Injectable()
export class AuthService {
  private readonly mailTransporter: nodemailer.Transporter;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.mailTransporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  public async register(dto: RegisterDto): Promise<{ user: PublicUser }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        username: dto.username,
        // Every registration starts as a standard account, regardless of isBusiness.
        // That flag only signals the client to prompt a follow-up POST /pro/upgrade request.
        role: Role.standard,
      },
    });

    await this.prisma.wallet.create({ data: { userId: user.id, balanceXAF: 0 } });
    await this.prisma.userXP.create({ data: { userId: user.id, points: 0, level: 1 } });

    await this.sendOtp(user.email, 'email_verification');

    return { user: this.toPublicUser(user) };
  }

  public async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isBanned || !user.isActive) {
      throw new UnauthorizedException('This account is not active');
    }

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  public async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('No account found for this email');
    }

    const storedOtp = await this.redis.get(this.otpKey(dto.email));
    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.redis.del(this.otpKey(dto.email));

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });

    const tokens = await this.issueTokenPair(updated);
    return { ...tokens, user: this.toPublicUser(updated) };
  }

  public async resendOtp(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('No account found for this email');
    }

    await this.sendOtp(email, 'email_verification');
    return { message: 'Verification code resent' };
  }

  public async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const storedToken = await this.redis.get(`${REFRESH_TOKEN_PREFIX}${payload.sub}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.isBanned) {
      throw new UnauthorizedException('User account is not active');
    }

    return this.issueTokenPair(user);
  }

  public async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.redis.del(`${REFRESH_TOKEN_PREFIX}${payload.sub}`);
    } catch {
      // Token already invalid/expired — logout is idempotent.
    }

    return { message: 'Logged out successfully' };
  }

  public async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'If an account exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.redis.set(`${RESET_TOKEN_PREFIX}${resetToken}`, user.id, 'EX', 3600);

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Password reset token for ${user.email}: ${resetToken}`);
    }

    try {
      await this.mailTransporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: user.email,
        subject: 'KmerFoodLens — Réinitialisation du mot de passe',
        html: `<p>Votre code de réinitialisation est : <strong>${resetToken}</strong></p>`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to send reset email to ${user.email}:`, error instanceof Error ? error.message : error);
    }

    return { message: 'If an account exists, a reset link has been sent' };
  }

  public async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const userId = await this.redis.get(`${RESET_TOKEN_PREFIX}${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.redis.del(`${RESET_TOKEN_PREFIX}${token}`);

    return { message: 'Password has been reset successfully' };
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('Password authentication is not enabled for this account');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return { message: 'Password changed successfully' };
  }

  public async loginWithGoogle(profile: GoogleProfilePayload): Promise<AuthResponse> {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatar: profile.avatar,
          googleId: profile.googleId,
          isEmailVerified: true,
        },
      });
      await this.prisma.wallet.create({ data: { userId: user.id, balanceXAF: 0 } });
      await this.prisma.userXP.create({ data: { userId: user.id, points: 0, level: 1 } });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
    }

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        privateKey: (this.configService.get<string>('JWT_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n'),
        algorithm: 'RS256',
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    // The refresh token uses a plain HMAC secret, not the RSA keypair — algorithm
    // must be overridden explicitly, otherwise it inherits the module's RS256
    // default (set for the access token) and jsonwebtoken rejects the symmetric
    // secret with "secretOrPrivateKey must be an asymmetric key when using RS256".
    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenId: uuid() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        algorithm: 'HS256',
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );

    await this.redis.set(`${REFRESH_TOKEN_PREFIX}${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

    return { accessToken, refreshToken };
  }

  private async sendOtp(email: string, purpose: string): Promise<void> {
    const otp = crypto.randomInt(100000, 999999).toString();
    await this.redis.set(this.otpKey(email), otp, 'EX', OTP_TTL_SECONDS);

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[DEV] OTP for ${email} (${purpose}): ${otp}`);
    }

    try {
      await this.mailTransporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: 'KmerFoodLens — Code de vérification',
        html: `<p>Votre code de vérification (${purpose}) est : <strong>${otp}</strong></p><p>Il expire dans 10 minutes.</p>`,
      });
    } catch (error) {
      // The OTP is already stored in Redis and can still be verified/resent —
      // a flaky/unconfigured SMTP transporter must not fail registration or login.
      // eslint-disable-next-line no-console
      console.error(`Failed to send OTP email to ${email}:`, error instanceof Error ? error.message : error);
    }
  }

  private otpKey(email: string): string {
    return `otp:${email}`;
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
