import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'standard' | 'pro' | 'admin';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  public constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey.replace(/\\n/g, '\n'),
      algorithms: ['RS256'],
    });
  }

  public async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive || user.isBanned) {
      throw new UnauthorizedException('User account is not active');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
