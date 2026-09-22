import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

// Regression test: a successful CinetPay/Stripe top-up webhook used to only
// flip Payment.status to 'succeeded' and send a notification — the wallet
// balance was never actually credited, so a "successful" recharge left the
// user's spendable balance at 0. Also verifies idempotency: a duplicate
// webhook delivery (payment providers retry) must not double-credit.
describe('PaymentsService — wallet top-up webhook crediting', () => {
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
        update: jest.fn().mockResolvedValue({ ...paymentRow, status: 'succeeded' }),
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
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    return { service: new PaymentsService(prisma, configService, notificationsService), prisma };
  }

  it('credits the wallet and records a ledger Transaction when a pending top-up succeeds', async () => {
    const { service, prisma } = buildService('pending');

    await service.handleCinetPayWebhook({ cpm_trans_id: externalRef, cpm_result: '00' });

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

    await service.handleCinetPayWebhook({ cpm_trans_id: externalRef, cpm_result: '00' });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.wallet.update).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});
