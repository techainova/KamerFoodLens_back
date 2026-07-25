import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OrderStatus } from '@prisma/client';

export interface OrderStatusUpdatePayload {
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
}

@WebSocketGateway({ namespace: '/orders', cors: true })
export class OrdersGateway {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  @SubscribeMessage('order:join')
  public handleJoinUserRoom(@ConnectedSocket() client: Socket, @MessageBody() userId: string): void {
    void client.join(this.userRoom(userId));
    this.logger.log(`Socket ${client.id} joined room for user ${userId}`);
  }

  public emitOrderStatusUpdate(userId: string, payload: OrderStatusUpdatePayload): void {
    this.server.to(this.userRoom(userId)).emit('order:status_update', payload);
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
