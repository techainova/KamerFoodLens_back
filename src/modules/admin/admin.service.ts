import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  Event,
  LogLevel,
  Order,
  OrderStatus,
  Payout,
  PayoutStatus,
  ProRequest,
  ProRequestStatus,
  Role,
  SystemLog,
  SystemSetting,
  Tombola,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PayoutJobData } from '../../jobs/payout.processor';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface AdminDashboardStats {
  totalUsers: number;
  totalProUsers: number;
  totalRestaurants: number;
  totalOrders: number;
  totalRevenueXAF: number;
  pendingProRequests: number;
  pendingPayouts: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

const PAGE_SIZE = 20;
const SETTINGS_ID = 'singleton';

@Injectable()
export class AdminService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue('payout') private readonly payoutQueue: Queue<PayoutJobData>,
  ) {}

  public async getDashboard(): Promise<AdminDashboardStats> {
    const [
      totalUsers,
      totalProUsers,
      totalRestaurants,
      totalOrders,
      orders,
      pendingProRequests,
      pendingPayouts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.pro } }),
      this.prisma.restaurant.count(),
      this.prisma.order.count(),
      this.prisma.order.findMany({ select: { totalXAF: true, kflFeeXAF: true } }),
      this.prisma.proRequest.count({ where: { status: ProRequestStatus.pending } }),
      this.prisma.payout.count({ where: { status: PayoutStatus.pending } }),
    ]);

    return {
      totalUsers,
      totalProUsers,
      totalRestaurants,
      totalOrders,
      totalRevenueXAF: orders.reduce((sum, order) => sum + order.kflFeeXAF, 0),
      pendingProRequests,
      pendingPayouts,
    };
  }

  public async getUsers(filter: string | undefined, page: number): Promise<PaginatedResult<User>> {
    const skip = (page - 1) * PAGE_SIZE;
    const where = filter
      ? {
          OR: [
            { email: { contains: filter, mode: 'insensitive' as const } },
            { firstName: { contains: filter, mode: 'insensitive' as const } },
            { lastName: { contains: filter, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: PAGE_SIZE, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page };
  }

  public async getUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  public async suspendUser(id: string, days: number): Promise<User> {
    const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const user = await this.prisma.user.update({ where: { id }, data: { suspendedUntil, isActive: false } });
    await this.notificationsService.create(
      id,
      'system',
      'Compte suspendu',
      `Votre compte a été suspendu pour ${days} jour(s), jusqu'au ${suspendedUntil.toLocaleDateString('fr-FR')}.`,
    );
    return user;
  }

  public async banUser(id: string): Promise<User> {
    const user = await this.prisma.user.update({ where: { id }, data: { isBanned: true, isActive: false } });
    await this.notificationsService.create(
      id,
      'system',
      'Compte banni',
      'Votre compte a été banni pour non-respect des conditions d\'utilisation.',
    );
    return user;
  }

  public async getProRequests(status: ProRequestStatus | undefined): Promise<ProRequest[]> {
    return this.prisma.proRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  public async approveProRequest(id: string): Promise<ProRequest> {
    const request = await this.prisma.proRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Pro request not found');
    }
    if (request.status !== ProRequestStatus.pending) {
      throw new BadRequestException('This Pro request has already been processed');
    }

    // Douala default coordinates — the Pro upgrade form doesn't collect geo-location yet,
    // so the restaurant lands on the map here until the owner corrects it from their dashboard.
    const DEFAULT_LAT = 4.0511;
    const DEFAULT_LNG = 9.7679;

    const [updated] = await this.prisma.$transaction([
      this.prisma.proRequest.update({ where: { id }, data: { status: ProRequestStatus.approved } }),
      this.prisma.user.update({ where: { id: request.userId }, data: { role: Role.pro } }),
      this.prisma.proProfile.upsert({
        where: { userId: request.userId },
        update: {},
        create: { userId: request.userId, businessName: request.businessName },
      }),
      this.prisma.restaurant.create({
        data: {
          ownerId: request.userId,
          name: request.businessName,
          cuisineType: request.businessType,
          address: request.address,
          phone: request.phone,
          description: request.description,
          lat: DEFAULT_LAT,
          lng: DEFAULT_LNG,
          isOpen: true,
          isActive: true,
          isVerified: false,
        },
      }),
    ]);

    await this.notificationsService.create(
      request.userId,
      'system',
      'Compte Pro approuvé',
      'Félicitations ! Votre demande de compte Pro a été approuvée. Votre restaurant est maintenant visible sur KmerFoodLens.',
    );

    return updated;
  }

  public async rejectProRequest(id: string, reason: string): Promise<ProRequest> {
    const request = await this.prisma.proRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Pro request not found');
    }

    const updated = await this.prisma.proRequest.update({
      where: { id },
      data: { status: ProRequestStatus.rejected, rejectionReason: reason },
    });

    await this.notificationsService.create(
      request.userId,
      'system',
      'Compte Pro refusé',
      `Votre demande de compte Pro a été refusée. Motif : ${reason}`,
    );

    return updated;
  }

  public async approveProRequestByUserId(userId: string): Promise<ProRequest> {
    const request = await this.prisma.proRequest.findFirst({
      where: { userId, status: ProRequestStatus.pending },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) {
      throw new NotFoundException('No pending Pro request found for this user');
    }
    return this.approveProRequest(request.id);
  }

  public async rejectProRequestByUserId(userId: string, reason: string): Promise<ProRequest> {
    const request = await this.prisma.proRequest.findFirst({
      where: { userId, status: ProRequestStatus.pending },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) {
      throw new NotFoundException('No pending Pro request found for this user');
    }
    return this.rejectProRequest(request.id, reason);
  }

  public async getOrders(status: OrderStatus | undefined, page: number): Promise<PaginatedResult<Order>> {
    const skip = (page - 1) * PAGE_SIZE;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({ where, skip, take: PAGE_SIZE, orderBy: { createdAt: 'desc' } }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page };
  }

  public async getEvents(page: number): Promise<PaginatedResult<Event>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({ skip, take: PAGE_SIZE, orderBy: { startAt: 'desc' } }),
      this.prisma.event.count(),
    ]);

    return { items, total, page };
  }

  public async getFinance(): Promise<{
    totalRevenueXAF: number;
    totalKflFeesXAF: number;
    totalPayoutsXAF: number;
    pendingPayoutsXAF: number;
  }> {
    const [orders, paidPayouts, pendingPayouts] = await Promise.all([
      this.prisma.order.findMany({ select: { totalXAF: true, kflFeeXAF: true } }),
      this.prisma.payout.findMany({ where: { status: PayoutStatus.paid }, select: { amountXAF: true } }),
      this.prisma.payout.findMany({ where: { status: PayoutStatus.pending }, select: { amountXAF: true } }),
    ]);

    return {
      totalRevenueXAF: orders.reduce((sum, order) => sum + order.totalXAF, 0),
      totalKflFeesXAF: orders.reduce((sum, order) => sum + order.kflFeeXAF, 0),
      totalPayoutsXAF: paidPayouts.reduce((sum, payout) => sum + payout.amountXAF, 0),
      pendingPayoutsXAF: pendingPayouts.reduce((sum, payout) => sum + payout.amountXAF, 0),
    };
  }

  public async getPayouts(status: PayoutStatus | undefined): Promise<Payout[]> {
    return this.prisma.payout.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' } });
  }

  public async approvePayout(id: string): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    const updated = await this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.approved },
    });
    await this.payoutQueue.add('process', { payoutId: id });
    await this.notificationsService.create(
      payout.userId,
      'payment',
      'Retrait approuvé',
      `Votre demande de retrait de ${payout.amountXAF.toLocaleString()} XAF a été approuvée et est en cours de traitement.`,
      { payoutId: payout.id },
    );
    return updated;
  }

  public async sendPush(target: string, title: string, body: string): Promise<{ queued: boolean }> {
    const where =
      target === 'all'
        ? {}
        : target === 'standard' || target === 'pro' || target === 'admin'
          ? { role: target as Role }
          : { id: target };

    const users = await this.prisma.user.findMany({ where, select: { id: true } });
    // Persiste une notification en base pour chaque destinataire (visible dans
    // GET /users/notifications) en plus du push Expo — sans ceci, la diffusion
    // admin n'atteint que les appareils déjà connectés au moment de l'envoi.
    await this.notificationsService.createForMany(
      users.map((user) => user.id),
      'system',
      title,
      body,
    );
    return { queued: true };
  }

  public async getLogs(level: LogLevel | undefined, page: number): Promise<PaginatedResult<SystemLog>> {
    const skip = (page - 1) * PAGE_SIZE;
    const where = level ? { level } : {};

    const [items, total] = await Promise.all([
      this.prisma.systemLog.findMany({ where, skip, take: PAGE_SIZE, orderBy: { createdAt: 'desc' } }),
      this.prisma.systemLog.count({ where }),
    ]);

    return { items, total, page };
  }

  public async getSettings(): Promise<SystemSetting> {
    return this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  public async updateSettings(dto: UpdateSettingsDto): Promise<SystemSetting> {
    return this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
  }

  public async setMaintenanceMode(enabled: boolean): Promise<SystemSetting> {
    return this.updateSettings({ maintenanceMode: enabled });
  }

  public async setCommissionRate(percent: number): Promise<SystemSetting> {
    return this.updateSettings({ commissionPct: percent });
  }

  public async getTombola(): Promise<Tombola[]> {
    return this.prisma.tombola.findMany({ orderBy: { drawAt: 'desc' } });
  }

  public async drawTombola(): Promise<{ tombolaId: string; winners: string[] }> {
    const tombola = await this.prisma.tombola.findFirst({
      where: { isActive: true },
      orderBy: { drawAt: 'asc' },
    });
    if (!tombola) {
      throw new BadRequestException('No active tombola to draw');
    }

    const tickets = await this.prisma.tombolaTicket.findMany({ where: { tombolaId: tombola.id } });
    if (tickets.length === 0) {
      throw new BadRequestException('No tickets sold for this tombola');
    }

    const prizes = Array.isArray(tombola.prizes) ? (tombola.prizes as unknown[]) : [];
    const winnerCount = Math.min(prizes.length || 1, tickets.length);
    const shuffled = [...tickets].sort(() => Math.random() - 0.5);
    const winnerTickets = shuffled.slice(0, winnerCount);
    const winnerUserIds = winnerTickets.map((ticket) => ticket.userId);

    await this.prisma.tombola.update({ where: { id: tombola.id }, data: { isActive: false } });
    await this.notificationsService.createForMany(
      winnerUserIds,
      'system',
      'Félicitations !',
      `Vous avez gagné à la tombola "${tombola.title}" !`,
      { tombolaId: tombola.id },
    );

    return { tombolaId: tombola.id, winners: winnerUserIds };
  }
}
