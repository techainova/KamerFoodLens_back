import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersGateway } from './orders.gateway';
import { GamesService } from '../games/games.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

const PAGE_SIZE = 20;
const KFL_FEE_PERCENT = 5;

@Injectable()
export class OrdersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly gamesService: GamesService,
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

    return order;
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

    return updated;
  }

  public async updateStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.prisma.order.update({ where: { id: orderId }, data: { status } });

    this.ordersGateway.emitOrderStatusUpdate(order.userId, {
      orderId: order.id,
      status: order.status,
      updatedAt: order.updatedAt.toISOString(),
    });

    return order;
  }
}
