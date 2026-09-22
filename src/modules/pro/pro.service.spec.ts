import { NotFoundException } from '@nestjs/common';
import { ProService } from './pro.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { MessagesService } from '../messages/messages.service';

// Regression test for the "Confirmée" button blank-page / non-functional
// status buttons reported by Pro users: updateOrderStatus() used to return the
// raw Prisma Order (missing clientName/items/paymentMethod), which crashed the
// frontend's ProOrderDetail render. It must now return the same enriched shape
// as getOrderDetail().
describe('ProService.updateOrderStatus', () => {
  const userId = 'user-1';
  const restaurantId = 'restaurant-1';
  const orderId = 'order-1';

  function buildService(orderRow: unknown) {
    const prisma = {
      restaurant: {
        findMany: jest.fn().mockResolvedValue([{ id: restaurantId }]),
      },
      order: {
        findUnique: jest.fn().mockImplementation(({ include }: { include?: unknown }) =>
          Promise.resolve(include ? orderRow : { id: orderId, restaurantId }),
        ),
      },
    } as unknown as PrismaService;

    const ordersService = {
      updateStatus: jest.fn().mockResolvedValue({ id: orderId, status: 'confirmed' }),
    } as unknown as OrdersService;

    const messagesService = {} as MessagesService;

    return { service: new ProService(prisma, ordersService, messagesService), prisma, ordersService };
  }

  it('returns the enriched ProOrderDetailView, not the raw Order', async () => {
    const orderRow = {
      id: orderId,
      ref: 'REF-1',
      restaurantId,
      status: 'confirmed',
      mode: 'delivery',
      note: null,
      totalXAF: 3500,
      kflFeeXAF: 200,
      createdAt: new Date(),
      user: { firstName: 'Std', lastName: 'Tester', phone: null },
      items: [{ name: 'Ndolé', qty: 1, priceXAF: 3500 }],
      payments: [{ method: 'wallet', status: 'paid' }],
    };
    const { service, ordersService } = buildService(orderRow);

    const result = await service.updateOrderStatus(userId, orderId, 'confirmed' as never);

    expect(ordersService.updateStatus).toHaveBeenCalledWith(orderId, 'confirmed');
    expect(result.items).toEqual([{ name: 'Ndolé', qty: 1, priceXAF: 3500 }]);
    expect(result.clientName).toBe('Std Tester');
    expect(result.paymentMethod).toBe('wallet');
    expect(result).not.toHaveProperty('userId');
  });

  it('throws NotFoundException when the order does not belong to an owned restaurant', async () => {
    const prisma = {
      restaurant: { findMany: jest.fn().mockResolvedValue([{ id: 'some-other-restaurant' }]) },
      order: { findUnique: jest.fn().mockResolvedValue({ id: orderId, restaurantId }) },
    } as unknown as PrismaService;
    const ordersService = { updateStatus: jest.fn() } as unknown as OrdersService;
    const service = new ProService(prisma, ordersService, {} as MessagesService);

    await expect(service.updateOrderStatus(userId, orderId, 'confirmed' as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ordersService.updateStatus).not.toHaveBeenCalled();
  });
});
