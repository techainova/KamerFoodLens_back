import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentMethod, PaymentStatus, TransactionType, Wallet } from '@prisma/client';
import Stripe from 'stripe';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface InitiatePaymentResult {
  paymentUrl?: string;
  paymentIntentId?: string;
  paymentId: string;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

const PAGE_SIZE = 20;

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe | null;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }) : null;
  }

  public async initiate(userId: string, dto: InitiatePaymentDto): Promise<InitiatePaymentResult> {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        userId,
        method: dto.method,
        amountXAF: order.totalXAF + order.kflFeeXAF,
        status: PaymentStatus.pending,
      },
    });

    if (dto.method === PaymentMethod.wallet) {
      return this.chargeWallet(payment.id, userId, payment.amountXAF);
    }

    if (dto.method === PaymentMethod.stripe) {
      return this.initiateStripe(payment.id, payment.amountXAF);
    }

    return this.initiateCinetPay(payment.id, payment.amountXAF, order.ref);
  }

  public async handleCinetPayWebhook(payload: Record<string, unknown>): Promise<{ received: boolean }> {
    const externalRef = String(payload.cpm_trans_id ?? payload.transaction_id ?? '');
    const status =
      String(payload.cpm_result ?? payload.status ?? '') === '00'
        ? PaymentStatus.succeeded
        : PaymentStatus.failed;

    const payment = await this.prisma.payment.findFirst({ where: { externalRef } });
    if (payment) {
      const updated = await this.prisma.payment.update({ where: { id: payment.id }, data: { status } });
      await this.notifyPaymentStatus(updated);
    }

    return { received: true };
  }

  public async handleStripeWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException(
        `Invalid Stripe webhook signature: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await this.prisma.payment.findFirst({ where: { externalRef: intent.id } });

      if (payment) {
        const updated = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status:
              event.type === 'payment_intent.succeeded' ? PaymentStatus.succeeded : PaymentStatus.failed,
          },
        });
        await this.notifyPaymentStatus(updated);
      }
    }

    return { received: true };
  }

  public async getWallet(userId: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  public async topup(userId: string, dto: TopupWalletDto): Promise<InitiatePaymentResult> {
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        method: dto.method,
        amountXAF: dto.amount,
        status: PaymentStatus.pending,
      },
    });

    if (dto.method === PaymentMethod.stripe) {
      return this.initiateStripe(payment.id, dto.amount, userId);
    }

    return this.initiateCinetPay(payment.id, dto.amount, `TOPUP-${payment.id}`);
  }

  public async getTransactions(userId: string, page: number): Promise<PaginatedResult<Payment>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return { items, total, page };
  }

  private async chargeWallet(
    paymentId: string,
    userId: string,
    amountXAF: number,
  ): Promise<InitiatePaymentResult> {
    const wallet = await this.getWallet(userId);

    if (wallet.balanceXAF < amountXAF) {
      const failed = await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.failed },
      });
      await this.notifyPaymentStatus(failed);
      throw new BadRequestException('Insufficient wallet balance');
    }

    const [, , succeeded] = await this.prisma.$transaction([
      this.prisma.wallet.update({ where: { userId }, data: { balanceXAF: { decrement: amountXAF } } }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.debit,
          amountXAF,
          description: 'Order payment via wallet',
        },
      }),
      this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.succeeded } }),
    ]);
    await this.notifyPaymentStatus(succeeded);

    return { paymentId };
  }

  private async initiateStripe(
    paymentId: string,
    amountXAF: number,
    userId?: string,
  ): Promise<InitiatePaymentResult> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create({
        amount: amountXAF,
        currency: 'xaf',
        metadata: { paymentId, userId: userId ?? '' },
      });
    } catch (error) {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.failed } });
      throw new BadGatewayException(
        `Stripe is unreachable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    await this.prisma.payment.update({ where: { id: paymentId }, data: { externalRef: intent.id } });

    return { paymentIntentId: intent.id, paymentId };
  }

  private async initiateCinetPay(
    paymentId: string,
    amountXAF: number,
    transactionRef: string,
  ): Promise<InitiatePaymentResult> {
    const apiKey = this.configService.get<string>('CINETPAY_API_KEY');
    const siteId = this.configService.get<string>('CINETPAY_SITE_ID');
    const externalRef = `${transactionRef}-${uuid().slice(0, 8)}`;

    // Placeholder values (e.g. still the sample ".env.example" strings) are
    // truthy but not real credentials — treat them the same as "not
    // configured" rather than letting them reach CinetPay's API as garbage.
    if (!apiKey || !siteId || apiKey === 'your_cinetpay_api_key' || siteId === 'your_cinetpay_site_id') {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { externalRef } });
      return { paymentId, paymentUrl: undefined };
    }

    let result: { data?: { payment_url?: string } };
    try {
      const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          site_id: siteId,
          transaction_id: externalRef,
          amount: amountXAF,
          currency: 'XAF',
          description: 'KmerFoodLens payment',
        }),
      });
      result = (await response.json()) as { data?: { payment_url?: string } };
    } catch (error) {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.failed } });
      throw new BadGatewayException(
        `CinetPay is unreachable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    await this.prisma.payment.update({ where: { id: paymentId }, data: { externalRef } });

    return { paymentId, paymentUrl: result.data?.payment_url };
  }

  private async notifyPaymentStatus(payment: Payment): Promise<void> {
    if (payment.status !== PaymentStatus.succeeded && payment.status !== PaymentStatus.failed) {
      return;
    }

    const isTopup = !payment.orderId;
    const succeeded = payment.status === PaymentStatus.succeeded;
    const amountLabel = `${payment.amountXAF.toLocaleString()} XAF`;

    const title = succeeded ? 'Paiement réussi' : 'Paiement échoué';
    const body = isTopup
      ? succeeded
        ? `Votre rechargement de ${amountLabel} a été effectué avec succès.`
        : `Votre rechargement de ${amountLabel} a échoué. Veuillez réessayer.`
      : succeeded
        ? `Votre paiement de ${amountLabel} a été confirmé.`
        : `Votre paiement de ${amountLabel} a échoué. Veuillez réessayer.`;

    await this.notificationsService.create(payment.userId, 'payment', title, body, {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
    });
  }
}
