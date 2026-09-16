import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { EventView } from './events.service';

export interface EventChatMessage {
  eventId: string;
  userId: string;
  username: string;
  text: string;
  sentAt: string;
}

@WebSocketGateway({ namespace: '/events', cors: true })
export class EventsGateway {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  // Diffusion globale (aucune room) : un nouvel événement doit apparaître
  // instantanément chez tous les comptes connectés, pas seulement dans la
  // room de l'événement lui-même (qui n'existe qu'après coup, une fois qu'on
  // y a rejoint le chat live).
  public broadcastNewEvent(event: EventView): void {
    this.server.emit('event:new', event);
  }

  @SubscribeMessage('event:live')
  public handleJoinEventRoom(@ConnectedSocket() client: Socket, @MessageBody() eventId: string): void {
    void client.join(this.eventRoom(eventId));
    this.logger.log(`Socket ${client.id} joined live room for event ${eventId}`);
  }

  @SubscribeMessage('event:chat')
  public handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: EventChatMessage,
  ): void {
    this.server.to(this.eventRoom(message.eventId)).emit('event:chat', message);
  }

  private eventRoom(eventId: string): string {
    return `event:${eventId}`;
  }
}
