import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from '@prisma/client';

// Une room par utilisateur, même principe que OrdersGateway/MessagesGateway :
// le client rejoint sa room au démarrage de l'app pour recevoir ses notifications
// en direct, indépendamment de l'écran actuellement ouvert.
@WebSocketGateway({ namespace: '/notifications', cors: true })
export class NotificationsGateway {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  @SubscribeMessage('notification:join')
  public handleJoin(@ConnectedSocket() client: Socket, @MessageBody() userId: string): void {
    void client.join(this.userRoom(userId));
    this.logger.log(`Socket ${client.id} joined notification room for user ${userId}`);
  }

  public emitNew(userId: string, notification: Notification): void {
    this.server.to(this.userRoom(userId)).emit('notification:new', notification);
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
