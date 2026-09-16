import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, Message, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { SendMessageDto } from './dto/messages.dto';

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar?: string;
  role: 'standard' | 'pro' | 'admin';
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationView {
  id: string;
  otherUser: ConversationParticipant;
  lastMessage?: { text: string; senderId: string; createdAt: string };
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationDetailView extends ConversationView {
  messages: MessageView[];
  total: number;
  page: number;
}

type ConversationWithUsers = Conversation & { userA: User; userB: User };

const PAGE_SIZE = 30;

@Injectable()
export class MessagesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  public async getOrCreateConversation(userId: string, recipientId: string): Promise<ConversationView> {
    if (userId === recipientId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }
    const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    // Ordre canonique (toujours trié) : garantit une seule conversation par
    // paire, quel que soit qui a initié l'échange.
    const [userAId, userBId] = [userId, recipientId].sort();

    const existing = await this.prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      include: { userA: true, userB: true },
    });
    const conversation = existing
      ?? await this.prisma.conversation.create({
        data: { userAId, userBId },
        include: { userA: true, userB: true },
      });

    return this.toConversationView(conversation, userId, undefined, 0);
  }

  public async listConversations(userId: string): Promise<ConversationView[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: true,
        userB: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (conversations.length === 0) return [];

    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: userId },
        isRead: false,
      },
      _count: true,
    });
    const unreadByConversation = new Map(unreadCounts.map((row) => [row.conversationId, row._count]));

    return conversations.map((c) =>
      this.toConversationView(c, userId, c.messages[0], unreadByConversation.get(c.id) ?? 0),
    );
  }

  public async getMessages(userId: string, conversationId: string, page: number): Promise<ConversationDetailView> {
    const conversation = await this.requireParticipant(userId, conversationId);
    const skip = (page - 1) * PAGE_SIZE;

    const [docs, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    const view = this.toConversationView(conversation, userId, docs[0], 0);
    return {
      ...view,
      messages: docs.reverse().map((m) => this.toMessageView(m)),
      total,
      page,
    };
  }

  public async sendMessage(userId: string, conversationId: string, dto: SendMessageDto): Promise<MessageView> {
    const conversation = await this.requireParticipant(userId, conversationId);
    const recipientId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, text: dto.text },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    const view = this.toMessageView(message);
    this.messagesGateway.sendToUser(recipientId, view);
    return view;
  }

  public async markRead(userId: string, conversationId: string): Promise<{ message: string }> {
    await this.requireParticipant(userId, conversationId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
    return { message: 'Marked as read' };
  }

  private async requireParticipant(userId: string, conversationId: string): Promise<ConversationWithUsers> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { userA: true, userB: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    return conversation;
  }

  private toParticipant(user: User): ConversationParticipant {
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      avatar: user.avatar ?? undefined,
      role: user.role,
    };
  }

  private toConversationView(
    conversation: ConversationWithUsers,
    userId: string,
    lastMessage: Message | undefined,
    unreadCount: number,
  ): ConversationView {
    const other = conversation.userAId === userId ? conversation.userB : conversation.userA;
    return {
      id: conversation.id,
      otherUser: this.toParticipant(other),
      lastMessage: lastMessage
        ? { text: lastMessage.text, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt.toISOString() }
        : undefined,
      unreadCount,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toMessageView(message: Message): MessageView {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      isRead: message.isRead,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
