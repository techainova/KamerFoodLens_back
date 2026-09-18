import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersGateway } from './orders.gateway';
import { GamesService } from '../games/games.service';
import { NotificationsService } from '../notifications/notifications.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

const PAGE_SIZE = 20;
const KFL_FEE_PERCENT = 5;

const ORDER_STATUS_MESSAGES: Record<OrderStatus, string> = {
  pending: 'est en attente de confirmation',
  confirmed: 'a été confirmée par le restaurant',
  preparing: 'est en cours de préparation',
  ready: 'est prête',
  delivering: 'est en cours de livraison',
  completed: 'a été livrée avec succès',
  cancelled: 'a été annulée',
};

@Injectable()
export class OrdersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly gamesService: GamesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  public async create(userId: string, dto: CreateOrderDto): Promise<Order> {
    const menuItemIds = dto.items.map((item) => item.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } });

    if (menuItems.length !== new Set(menuItemIds).size) {
      throw new BadRequestException('One or more menu items do not exist');
    }

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

    let totalXAF = 0;
    const orderItemsData = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(`Menu item ${item.menuItemId} not found`);
      }
      totalXAF += menuItem.priceXAF * item.qty;
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        priceXAF: menuItem.priceXAF,
        qty: item.qty,
      };
    });

    const kflFeeXAF = Math.round((totalXAF * KFL_FEE_PERCENT) / 100);

    const order = await this.prisma.order.create({
      data: {
        ref: `KFL-${uuid().slice(0, 8).toUpperCase()}`,
        userId,
        restaurantId: dto.restaurantId,
        mode: dto.mode,
        note: dto.note,
        reservationAt: dto.reservationAt ? new Date(dto.reservationAt) : undefined,
        totalXAF,
        kflFeeXAF,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    await this.gamesService.awardOrderXp(userId);
    await this.notifyOwner(order.restaurantId, userId, order.ref, totalXAF);
    await this.notificationsService.create(
      userId,
      'order',
      'Commande envoyée',
      `Votre commande ${order.ref} ${ORDER_STATUS_MESSAGES.pending}.`,
      { orderId: order.id, status: order.status },
    );

    return order;
  }

  // Alimente l'inbox système -> pro (GET /pro/messages) : sans ceci, un
  // restaurateur n'est jamais notifié dans l'app qu'une commande vient d'arriver.
  private async notifyOwner(restaurantId: string, customerId: string, ref: string, totalXAF: number): Promise<void> {
    const [restaurant, customer] = await Promise.all([
      this.prisma.restaurant.findUnique({ where: { id: restaurantId } }),
      this.prisma.user.findUnique({ where: { id: customerId } }),
    ]);
    if (!restaurant) return;
    const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Un client';
    await this.prisma.proMessage.create({
      data: {
        recipientId: restaurant.ownerId,
        senderName: customerName,
        subject: `Nouvelle commande ${ref}`,
        body: `${customerName} vient de passer une commande de ${totalXAF.toLocaleString()} XAF chez ${restaurant.name}.`,
      },
    });
  }

  public async findAllForUser(userId: string, page: number): Promise<PaginatedResult<Order>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return { items, total, page };
  }

  public async findOne(userId: string, orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  public async cancel(userId: string, orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.completed || order.status === OrderStatus.cancelled) {
      throw new ForbiddenException('This order can no longer be cancelled');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.cancelled },
    });

    this.ordersGateway.emitOrderStatusUpdate(userId, {
      orderId: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
    await this.notificationsService.create(
      userId,
      'order',
      'Commande annulée',
      `Votre commande ${updated.ref} ${ORDER_STATUS_MESSAGES.cancelled}.`,
      { orderId: updated.id, status: updated.status },
    );

    return updated;
  }

  public async updateStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.prisma.order.update({ where: { id: orderId }, data: { status } });

    this.ordersGateway.emitOrderStatusUpdate(order.userId, {
      orderId: order.id,
      status: order.status,
      updatedAt: order.updatedAt.toISOString(),
    });
    await this.notificationsService.create(
      order.userId,
      'order',
      'Mise à jour de commande',
      `Votre commande ${order.ref} ${ORDER_STATUS_MESSAGES[order.status]}.`,
      { orderId: order.id, status: order.status },
    );

    return order;
  }
}
