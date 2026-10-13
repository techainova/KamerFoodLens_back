import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

// Every media type the app actually uploads (avatars, menu/event/post photos, scan
// photos, videos, course media). Deliberately excludes anything a browser would ever
// render/execute inline instead of treating as a download — notably image/svg+xml
// (can carry a <script>) and any text/* or application/javascript — since this bucket
// serves uploaded objects back with the caller-supplied Content-Type and, for local
// Garage/MinIO setups, over plain unauthenticated HTTP: an attacker-chosen Content-Type
// of text/html on their own "avatar" would otherwise be a stored-XSS primitive.
const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/webm',
  'application/pdf',
  'application/octet-stream',
]);

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'weba',
  'application/pdf': 'pdf',
  'application/octet-stream': 'bin',
};

@Injectable()
export class S3UploadService implements OnModuleInit {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  private readonly publicUrl: string | undefined;

  public constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') ?? 'eu-west-3';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') ?? '';
    this.endpoint = this.configService.get<string>('AWS_ENDPOINT') || undefined;
    // The SDK needs the internal/private endpoint (e.g. a Docker-network hostname) to
    // talk to the store, but that address is often not reachable by the end client that
    // later opens the returned URL. AWS_PUBLIC_URL lets ops point returned links at a
    // reverse-proxied public address instead; it defaults to `endpoint` so existing local
    // MinIO setups (where the endpoint already is the publicly reachable one) keep working.
    this.publicUrl = this.configService.get<string>('AWS_PUBLIC_URL') || this.endpoint;

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      // MinIO (and other S3-compatible local stores) need a custom endpoint and path-style
      // URLs (bucket.s3.amazonaws.com virtual-hosted style doesn't resolve for them).
      ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
    });
  }

  // Real AWS S3 buckets are expected to already exist and be configured by whoever owns the
  // AWS account — only auto-create/auto-publicize when pointed at a local MinIO instance.
  public async onModuleInit(): Promise<void> {
    if (!this.endpoint || !this.bucket) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        await this.client.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucket,
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: { AWS: ['*'] },
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${this.bucket}/*`],
                },
              ],
            }),
          }),
        );
        this.logger.log(`Created local MinIO bucket "${this.bucket}" with public-read access`);
      } catch (error) {
        this.logger.error(
          `Failed to create local MinIO bucket "${this.bucket}"`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  public async uploadBase64Image(base64Data: string, mimeType: string, folder: string): Promise<string> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }

    const buffer = Buffer.from(base64Data.replace(/^data:.*;base64,/, ''), 'base64');
    const extension = EXTENSION_BY_MIME_TYPE[mimeType];
    const key = `${folder}/${uuid()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    if (this.publicUrl) {
      return `${this.publicUrl}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
