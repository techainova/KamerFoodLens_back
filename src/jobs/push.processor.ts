import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

export interface PushJobData {
  target: string;
  title: string;
  body: string;
  tokens: string[];
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100;

function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

@Processor('push')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);

  @Process('send')
  public async handleSendPush(job: Job<PushJobData>): Promise<{ sent: number }> {
    const { target, title, body, tokens } = job.data;

    const validTokens = tokens.filter(isExpoPushToken);
    if (validTokens.length < tokens.length) {
      this.logger.warn(`Dropped ${tokens.length - validTokens.length} non-Expo-push-token value(s) for target="${target}"`);
    }

    this.logger.log(`Sending push notification to target="${target}" (${validTokens.length} device(s)): ${title}`);

    let sent = 0;
    for (let i = 0; i < validTokens.length; i += EXPO_PUSH_BATCH_SIZE) {
      const batch = validTokens.slice(i, i + EXPO_PUSH_BATCH_SIZE);

      try {
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch.map((token) => ({ to: token, title, body, sound: 'default' }))),
        });

        if (!response.ok) {
          this.logger.error(`Expo push batch failed: ${response.status} ${response.statusText}`);
          continue;
        }

        const payload = (await response.json()) as { data?: ExpoPushTicket[] };
        for (const ticket of payload.data ?? []) {
          if (ticket.status === 'ok') {
            sent += 1;
          } else {
            this.logger.error(`Expo push ticket error: ${ticket.message ?? ticket.details?.error ?? 'unknown'}`);
          }
        }
      } catch (error) {
        this.logger.error(
          'Expo push batch request error',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return { sent };
  }
}
