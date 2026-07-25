import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { FastifyRequest } from 'fastify';

interface EncryptedRequest extends FastifyRequest {
  body: unknown;
}

const AES_ALGORITHM = 'aes-256-gcm';

// Implemented as a Guard (not NestMiddleware) on purpose: under the Fastify adapter,
// Express-style NestMiddleware runs at Fastify's 'onRequest' hook, which is BEFORE
// Fastify parses the request body — so request.body is always undefined there.
// Guards run after body parsing, so this is the earliest point where the raw
// ciphertext body is actually available to decrypt.
@Injectable()
export class AesDecryptGuard implements CanActivate {
  private readonly encryptionKey: Buffer;

  public constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY is not configured');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  public canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<EncryptedRequest>();

    const ivHeader = req.headers['x-kfl-iv'];
    const tagHeader = req.headers['x-kfl-tag'];

    if (!ivHeader || !tagHeader) {
      throw new BadRequestException('Missing X-KFL-IV or X-KFL-TAG headers for encrypted payload');
    }

    const iv = Buffer.from(Array.isArray(ivHeader) ? ivHeader[0] : ivHeader, 'hex');
    const authTag = Buffer.from(Array.isArray(tagHeader) ? tagHeader[0] : tagHeader, 'hex');

    const rawBody = req.body;
    let cipherHex: string;

    if (typeof rawBody === 'string') {
      cipherHex = rawBody;
    } else if (rawBody && typeof rawBody === 'object' && 'data' in (rawBody as Record<string, unknown>)) {
      cipherHex = String((rawBody as Record<string, unknown>).data);
    } else {
      throw new BadRequestException('Encrypted body must be a hex-encoded ciphertext string');
    }

    try {
      const encryptedBuffer = Buffer.from(cipherHex, 'hex');
      const decipher = crypto.createDecipheriv(AES_ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
      req.body = JSON.parse(decrypted.toString('utf8'));
      return true;
    } catch (error) {
      throw new BadRequestException(
        `Failed to decrypt payload: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
