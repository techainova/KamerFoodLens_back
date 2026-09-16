import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { StoryView, PostView } from './community.service';

// Diffusion globale (aucune room) : tout compte connecté doit voir apparaître
// une nouvelle story/publication instantanément, pas seulement l'auteur —
// contrairement à OrdersGateway/EventsGateway qui ciblent une room précise
// (un utilisateur, un événement), ici l'émission touche tous les clients du
// namespace.
@WebSocketGateway({ namespace: '/community', cors: true })
export class CommunityGateway {
  @WebSocketServer()
  private readonly server!: Server;

  public broadcastNewStory(story: StoryView): void {
    this.server.emit('story:new', story);
  }

  public broadcastNewPost(post: PostView): void {
    this.server.emit('post:new', post);
  }
}
