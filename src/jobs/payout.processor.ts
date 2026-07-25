import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export interface PayoutJobData {
  payoutId: string;
}

@Processor('payout')
export class PayoutProcessor {
  private readonly logger = new Logger(PayoutProcessor.name);

  public constructor(private readonly prisma: PrismaService) {}

  @Process('process')
  public async handleProcessPayout(job: Job<PayoutJobData>): Promise<{ status: string }> {
    const { payoutId } = job.data;

    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      this.logger.warn(`Payout ${payoutId} not found — skipping`);
      return { status: 'not_found' };
    }

    this.logger.log(`Processing payout ${payoutId} of ${payout.amountXAF} XAF for user ${payout.userId}`);

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'paid' },
    });

    return { status: 'paid' };
  }
}
