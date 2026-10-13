import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

// Regression tests for two things:
// 1. A successful CinetPay/Stripe top-up webhook used to only flip Payment.status to
//    'succeeded' and send a notification — the wallet balance was never actually
//    credited, so a "successful" recharge left the user's spendable balance at 0.
//    Also verifies idempotency: a duplicate webhook delivery must not double-credit.
// 2. CinetPay's IPN carries no signature, so its own `cpm_result` field must never be
//    trusted directly — the webhook only uses the body to look up which payment to
//    re-check, and the actual status always comes from CinetPay's authenticated
//    "check payment" API (verifyCinetPayTransaction). A forged "cpm_result: 00" with no
//    matching ACCEPTED status from that API must NOT mark the payment as succeeded.
describe('PaymentsService — CinetPay webhook', () => {
  const userId = 'user-1';
  const walletId = 'wallet-1';
  const externalRef = 'TOPUP-payment-1-abcd1234';

  function buildService(paymentStatus: 'pending' | 'succeeded') {
    const paymentRow = {
      id: 'payment-1',
      userId,
      orderId: null,
      method: 'cinetpay',
      status: paymentStatus,
      amountXAF: 10000,
      externalRef,
    };

    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(paymentRow),
        update: jest.fn((args: { data: { status: string } }) => Promise.resolve({ ...paymentRow, status: args.data.status })),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: walletId, userId, balanceXAF: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    } as unknown as PrismaService;

    const notificationsService = { create: jest.fn().mockResolvedValue({}) } as unknown as NotificationsService;
    const configService = {
      get: jest.fn((key: string) => (key === 'CINETPAY_API_KEY' || key === 'CINETPAY_SITE_ID' ? 'real-value' : undefined)),
    } as unknown as ConfigService;

    return { service: new PaymentsService(prisma, configService, notificationsService), prisma };
  }

  function mockCinetPayCheckResponse(status: 'ACCEPTED' | 'REFUSED') {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: { status } }),
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('credits the wallet when CinetPay independently confirms the transaction as ACCEPTED', async () => {
    const { service, prisma } = buildService('pending');
    mockCinetPayCheckResponse('ACCEPTED');

    await service.handleCinetPayWebhook({ cpm_trans_id: externalRef, cpm_result: '00' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-checkout.cinetpay.com/v2/payment/check',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { status: 'succeeded' } });
    expect(prisma.wallet.update).toHaveBeenCalledWith({
      where: { userId },
      data: { balanceXAF: { increment: 10000 } },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ walletId, type: 'credit', amountXAF: 10000 }),
    });
  });

  it('does not credit the wallet again for a payment that already succeeded (idempotency)', async () => {
    const { service, prisma } = buildService('succeeded');
    mockCinetPayCheckResponse('ACCEPTED');

    await service.handleCinetPayWebhook({ cpm_trans_id: externalRef, cpm_result: '00' });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.wallet.update).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('ignores a forged "cpm_result: 00" when CinetPay itself reports the transaction as REFUSED', async () => {
    const { service, prisma } = buildService('pending');
    mockCinetPayCheckResponse('REFUSED');

    await service.handleCinetPayWebhook({ cpm_trans_id: externalRef, cpm_result: '00' });

    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { status: 'failed' } });
    expect(prisma.wallet.update).not.toHaveBeenCalled();
  });

  it('does not change payment status at all when CinetPay cannot be reached to verify', async () => {
    const { service, prisma } = buildService('pending');
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

    await service.handleCinetPayWebhook({ cpm_trans_id: externalRef, cpm_result: '00' });

    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});
