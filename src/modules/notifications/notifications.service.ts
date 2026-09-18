import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushJobData } from '../../jobs/push.processor';
import { NotificationsGateway } from './notifications.gateway';

// Point d'entrée unique pour créer une notification : persiste en base (source de
// vérité pour GET /users/notifications), pousse en direct via WebSocket si le client
// est connecté, et met en file une notification push Expo si des devices sont enregistrés.
// Sans ce service, chaque module réinvente sa propre inbox (cf. ProMessage) et l'écran
// Notifications de l'app reste vide même quand l'action métier a bien eu lieu.
@Injectable()
export class NotificationsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    @InjectQueue('push') private readonly pushQueue: Queue<PushJobData>,
  ) {}

  public async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });

    this.gateway.emitNew(userId, notification);
    await this.queuePush(userId, title, body);

    return notification;
  }

  public async createForMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    await Promise.all(uniqueUserIds.map((userId) => this.create(userId, type, title, body, data)));
  }

  private async queuePush(userId: string, title: string, body: string): Promise<void> {
    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (deviceTokens.length === 0) {
      return;
    }
    await this.pushQueue.add('send', {
      target: userId,
      title,
      body,
      tokens: deviceTokens.map((deviceToken) => deviceToken.token),
    });
  }
}
