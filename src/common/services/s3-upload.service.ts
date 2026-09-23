import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

@Injectable()
export class S3UploadService implements OnModuleInit {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;

  public constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') ?? 'eu-west-3';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') ?? '';
    this.endpoint = this.configService.get<string>('AWS_ENDPOINT') || undefined;

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
    const buffer = Buffer.from(base64Data.replace(/^data:.*;base64,/, ''), 'base64');
    // "image/svg+xml" etc. carry a structured-syntax suffix after '+' that
    // isn't part of the file extension — strip it so keys end in ".svg", not ".svg+xml".
    const extension = (mimeType.split('/')[1] ?? 'jpg').split('+')[0];
    const key = `${folder}/${uuid()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
