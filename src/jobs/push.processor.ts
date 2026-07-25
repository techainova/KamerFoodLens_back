import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';

export interface PushJobData {
  target: string;
  title: string;
  body: string;
  tokens: string[];
}

@Processor('push')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);

  public constructor(private readonly configService: ConfigService) {}

  @Process('send')
  public async handleSendPush(job: Job<PushJobData>): Promise<{ sent: number }> {
    const { target, title, body, tokens } = job.data;
    const fcmServerKey = this.configService.get<string>('FCM_SERVER_KEY');

    if (!fcmServerKey) {
      this.logger.warn('FCM_SERVER_KEY not configured — skipping push send');
      return { sent: 0 };
    }

    this.logger.log(`Sending push notification to target="${target}" (${tokens.length} tokens): ${title}`);

    let sent = 0;
    for (const token of tokens) {
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            Authorization: `key=${fcmServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body },
          }),
        });

        if (response.ok) {
          sent += 1;
        } else {
          this.logger.error(`FCM push failed for token ${token}: ${response.statusText}`);
        }
      } catch (error) {
        this.logger.error(
          `FCM push error for token ${token}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return { sent };
  }
}
