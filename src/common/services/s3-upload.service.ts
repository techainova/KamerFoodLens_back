import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

@Injectable()
export class S3UploadService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  public constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') ?? 'eu-west-3';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') ?? '';

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  public async uploadBase64Image(base64Data: string, mimeType: string, folder: string): Promise<string> {
    const buffer = Buffer.from(base64Data.replace(/^data:.*;base64,/, ''), 'base64');
    const extension = mimeType.split('/')[1] ?? 'jpg';
    const key = `${folder}/${uuid()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
