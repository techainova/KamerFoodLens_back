import { BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from './events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { S3UploadService } from '../../common/services/s3-upload.service';

// Regression test for "si payant, il paye avant d'être inscrit": a paid event
// must debit the wallet and create the registration atomically — an
// insufficient balance must leave the wallet untouched and create no
// registration row, and the debit/registration must never happen separately.
describe('EventsService.register — paid events', () => {
  const userId = 'user-1';
  const eventId = 'event-1';
  const organizerId = 'organizer-1';

  function buildService(walletBalance: number) {
    const tx = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', userId, balanceXAF: walletBalance }),
        update: jest.fn().mockResolvedValue({}),
      },
      transaction: { create: jest.fn().mockResolvedValue({}) },
      eventRegistration: { create: jest.fn().mockResolvedValue({}) },
    };

    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventId,
          organizerId,
          title: 'Atelier payant',
          priceXAF: 2000,
          maxSeats: null,
        }),
      },
      eventRegistration: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Std', lastName: 'Tester' }) },
      proMessage: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const gateway = { emitOrderStatusUpdate: jest.fn() } as unknown as EventsGateway;
    const notificationsService = { create: jest.fn().mockResolvedValue({}) } as unknown as NotificationsService;
    const s3UploadService = {} as S3UploadService;

    return {
      service: new EventsService(prisma, gateway, notificationsService, s3UploadService),
      tx,
      prisma,
    };
  }

  it('rejects and creates no registration when the wallet balance is insufficient', async () => {
    const { service, tx } = buildService(500); // event costs 2000

    await expect(service.register(userId, eventId)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.eventRegistration.create).not.toHaveBeenCalled();
  });

  it('debits the exact price and registers atomically when the balance is sufficient', async () => {
    const { service, tx } = buildService(5000);

    const result = await service.register(userId, eventId);

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { userId },
      data: { balanceXAF: { decrement: 2000 } },
    });
    expect(tx.eventRegistration.create).toHaveBeenCalledWith({ data: { eventId, userId } });
    expect(result).toEqual({ message: 'Registered successfully' });
  });
});
