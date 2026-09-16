import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus, Payout, Promo, ProMessage, ProRequest } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { UpgradeProDto } from './dto/upgrade-pro.dto';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePaymentMethodsDto } from './dto/update-payment-methods.dto';

export interface PaymentMethodsView {
  acceptsMtn: boolean;
  acceptsOrange: boolean;
  acceptsCard: boolean;
  acceptsCash: boolean;
  mtnPhone: string | null;
  orangePhone: string | null;
}

export interface ProStats {
  revenueXAF: number;
  revenueChange: number;
  ordersCount: number;
  ordersChange: number;
  customersCount: number;
  avgOrderXAF: number;
  activeMenuItems: number;
  rating: number;
}

export interface ProOrderSummary {
  id: string;
  ref: string;
  clientName: string;
  status: OrderStatus;
  totalXAF: number;
  createdAt: Date;
}

export interface ProOrderDetailView extends ProOrderSummary {
  clientPhone: string | null;
  mode: string;
  note: string | null;
  kflFeeXAF: number;
  items: { name: string; qty: number; priceXAF: number }[];
  paymentMethod: string | null;
  paymentStatus: string | null;
}

export interface RevenueDaySummary {
  date: string;
  amount: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  amountXAF: number;
  pct: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

const PAGE_SIZE = 20;
const PERIOD_DAYS: Record<string, number> = { week: 7, month: 30, year: 365 };

@Injectable()
export class ProService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  public async getDashboard(userId: string): Promise<ProStats> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);

    if (restaurantIds.length === 0) {
      return {
        revenueXAF: 0,
        revenueChange: 0,
        ordersCount: 0,
        ordersChange: 0,
        customersCount: 0,
        avgOrderXAF: 0,
        activeMenuItems: 0,
        rating: 0,
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentOrders, previousOrders, activeMenuItems, reviews, distinctCustomers] = await Promise.all([
      this.prisma.order.findMany({
        where: { restaurantId: { in: restaurantIds }, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.order.findMany({
        where: { restaurantId: { in: restaurantIds }, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      this.prisma.menuItem.count({ where: { restaurantId: { in: restaurantIds }, isAvailable: true } }),
      this.prisma.review.findMany({
        where: { restaurantId: { in: restaurantIds } },
        select: { rating: true },
      }),
      this.prisma.order.findMany({
        where: { restaurantId: { in: restaurantIds } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const currentRevenue = currentOrders.reduce((sum, order) => sum + order.totalXAF, 0);
    const previousRevenue = previousOrders.reduce((sum, order) => sum + order.totalXAF, 0);
    const revenueChange =
      previousRevenue === 0 ? 0 : ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    const ordersChange =
      previousOrders.length === 0
        ? 0
        : ((currentOrders.length - previousOrders.length) / previousOrders.length) * 100;
    const rating =
      reviews.length === 0 ? 0 : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    return {
      revenueXAF: currentRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
      ordersCount: currentOrders.length,
      ordersChange: Math.round(ordersChange * 10) / 10,
      customersCount: distinctCustomers.length,
      avgOrderXAF: currentOrders.length === 0 ? 0 : Math.round(currentRevenue / currentOrders.length),
      activeMenuItems,
      rating: Math.round(rating * 10) / 10,
    };
  }

  public async requestUpgrade(userId: string, dto: UpgradeProDto): Promise<ProRequest> {
    const existing = await this.prisma.proRequest.findFirst({ where: { userId, status: 'pending' } });
    if (existing) {
      throw new BadRequestException('You already have a pending Pro request');
    }

    return this.prisma.proRequest.create({
      data: {
        userId,
        businessName: dto.businessName,
        businessType: dto.businessType,
        phone: dto.phone,
        address: dto.address,
        description: dto.description,
      },
    });
  }

  public async getRevenues(
    userId: string,
    period: string,
  ): Promise<{
    period: string;
    totalXAF: number;
    ordersCount: number;
    revenueByDay: RevenueDaySummary[];
    paymentBreakdown: PaymentMethodBreakdown[];
  }> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.week;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [orders, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: { restaurantId: { in: restaurantIds }, createdAt: { gte: since } },
      }),
      this.prisma.payment.findMany({
        where: { order: { restaurantId: { in: restaurantIds } }, status: 'succeeded', createdAt: { gte: since } },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + order.totalXAF);
    }
    const revenueByDay = [...byDay.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byMethod = new Map<string, number>();
    for (const payment of payments) {
      byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amountXAF);
    }
    const totalPaid = [...byMethod.values()].reduce((sum, amount) => sum + amount, 0);
    const paymentBreakdown = [...byMethod.entries()].map(([method, amountXAF]) => ({
      method,
      amountXAF,
      pct: totalPaid === 0 ? 0 : Math.round((amountXAF / totalPaid) * 100),
    }));

    return {
      period,
      totalXAF: orders.reduce((sum, order) => sum + order.totalXAF, 0),
      ordersCount: orders.length,
      revenueByDay,
      paymentBreakdown,
    };
  }

  public async getAnalytics(
    userId: string,
    period: string,
  ): Promise<{
    period: string;
    ordersByStatus: Record<string, number>;
    topMenuItems: { name: string; qty: number }[];
  }> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.week;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: { restaurantId: { in: restaurantIds }, createdAt: { gte: since } },
      include: { items: true },
    });

    const ordersByStatus: Record<string, number> = {};
    const itemTotals = new Map<string, number>();

    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
      for (const item of order.items) {
        itemTotals.set(item.name, (itemTotals.get(item.name) ?? 0) + item.qty);
      }
    }

    const topMenuItems = Array.from(itemTotals.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    return { period, ordersByStatus, topMenuItems };
  }

  public async getMyRestaurants(userId: string): Promise<{ id: string; name: string }[]> {
    return this.prisma.restaurant.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
    });
  }

  public async markMessageRead(userId: string, messageId: string): Promise<ProMessage> {
    const message = await this.prisma.proMessage.findUnique({ where: { id: messageId } });
    if (!message || message.recipientId !== userId) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.proMessage.update({ where: { id: messageId }, data: { isRead: true } });
  }

  public async getMessages(userId: string, page: number): Promise<PaginatedResult<ProMessage>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [items, total] = await Promise.all([
      this.prisma.proMessage.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.proMessage.count({ where: { recipientId: userId } }),
    ]);

    return { items, total, page };
  }

  public async getPromos(userId: string): Promise<Promo[]> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    return this.prisma.promo.findMany({
      where: { restaurantId: { in: restaurantIds } },
      orderBy: { validFrom: 'desc' },
    });
  }

  public async createPromo(userId: string, dto: CreatePromoDto): Promise<Promo> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    if (!restaurantIds.includes(dto.restaurantId)) {
      throw new ForbiddenException('You do not own this restaurant');
    }

    return this.prisma.promo.create({
      data: {
        restaurantId: dto.restaurantId,
        title: dto.title,
        discountPercent: dto.discountPercent,
        discountXAF: dto.discountXAF,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });
  }

  public async getOrders(
    userId: string,
    status: OrderStatus | undefined,
    page: number,
  ): Promise<{ items: ProOrderSummary[]; total: number }> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    const skip = (page - 1) * PAGE_SIZE;
    const where = { restaurantId: { in: restaurantIds }, ...(status ? { status } : {}) };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.order.count({ where }),
    ]);

    const items: ProOrderSummary[] = orders.map((order) => ({
      id: order.id,
      ref: order.ref,
      clientName: `${order.user.firstName} ${order.user.lastName}`,
      status: order.status,
      totalXAF: order.totalXAF,
      createdAt: order.createdAt,
    }));

    return { items, total };
  }

  public async getOrderDetail(userId: string, orderId: string): Promise<ProOrderDetailView> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order || !restaurantIds.includes(order.restaurantId)) {
      throw new NotFoundException('Order not found');
    }

    const lastPayment = order.payments[0];

    return {
      id: order.id,
      ref: order.ref,
      clientName: `${order.user.firstName} ${order.user.lastName}`,
      clientPhone: order.user.phone,
      status: order.status,
      mode: order.mode,
      note: order.note,
      totalXAF: order.totalXAF,
      kflFeeXAF: order.kflFeeXAF,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, priceXAF: item.priceXAF })),
      paymentMethod: lastPayment?.method ?? null,
      paymentStatus: lastPayment?.status ?? null,
    };
  }

  public async updateOrderStatus(userId: string, orderId: string, status: OrderStatus): Promise<Order> {
    const restaurantIds = await this.getOwnedRestaurantIds(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order || !restaurantIds.includes(order.restaurantId)) {
      throw new NotFoundException('Order not found');
    }

    return this.ordersService.updateStatus(orderId, status);
  }

  public async getPayouts(userId: string): Promise<Payout[]> {
    return this.prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  public async getSubscription(
    userId: string,
  ): Promise<{ plan: string; status: string; proProfile: unknown }> {
    const proProfile = await this.prisma.proProfile.findUnique({ where: { userId } });
    return { plan: 'pro_standard', status: proProfile ? 'active' : 'inactive', proProfile };
  }

  public async getPaymentMethods(userId: string): Promise<PaymentMethodsView> {
    const proProfile = await this.prisma.proProfile.findUnique({ where: { userId } });
    if (!proProfile) {
      throw new ForbiddenException('You do not have a Pro profile');
    }
    return this.toPaymentMethodsView(proProfile);
  }

  public async updatePaymentMethods(userId: string, dto: UpdatePaymentMethodsDto): Promise<PaymentMethodsView> {
    const existing = await this.prisma.proProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new ForbiddenException('You do not have a Pro profile');
    }
    const proProfile = await this.prisma.proProfile.update({ where: { userId }, data: dto });
    return this.toPaymentMethodsView(proProfile);
  }

  private toPaymentMethodsView(proProfile: {
    acceptsMtn: boolean;
    acceptsOrange: boolean;
    acceptsCard: boolean;
    acceptsCash: boolean;
    mtnPhone: string | null;
    orangePhone: string | null;
  }): PaymentMethodsView {
    const { acceptsMtn, acceptsOrange, acceptsCard, acceptsCash, mtnPhone, orangePhone } = proProfile;
    return { acceptsMtn, acceptsOrange, acceptsCard, acceptsCash, mtnPhone, orangePhone };
  }

  public async requestPayout(
    userId: string,
    amountXAF: number,
    method = 'wallet',
    phone = '',
  ): Promise<Payout> {
    const proProfile = await this.prisma.proProfile.findUnique({ where: { userId } });
    if (!proProfile) {
      throw new ForbiddenException('You do not have a Pro profile');
    }

    if (amountXAF > proProfile.totalRevenueXAF) {
      throw new BadRequestException('Requested payout exceeds total revenue');
    }

    return this.prisma.payout.create({ data: { userId, amountXAF, method, phone } });
  }

  private async getOwnedRestaurantIds(userId: string): Promise<string[]> {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    return restaurants.map((restaurant) => restaurant.id);
  }
}
