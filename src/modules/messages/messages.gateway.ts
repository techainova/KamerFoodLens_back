import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageView } from './messages.service';

// Une room par utilisateur (pas par conversation) : le destinataire doit être
// notifié même s'il n'a pas la conversation ouverte — même principe que
// OrdersGateway (room 'order:join' ciblée par userId, pas par ressource).
@WebSocketGateway({ namespace: '/messages', cors: true })
export class MessagesGateway {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  @SubscribeMessage('message:join')
  public handleJoin(@ConnectedSocket() client: Socket, @MessageBody() userId: string): void {
    void client.join(this.userRoom(userId));
    this.logger.log(`Socket ${client.id} joined message room for user ${userId}`);
  }

  public sendToUser(userId: string, message: MessageView): void {
    this.server.to(this.userRoom(userId)).emit('message:new', message);
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
