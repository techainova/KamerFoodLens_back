import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Event, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsGateway } from './events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

export interface EventView {
  id: string;
  title: string;
  category: string;
  description: string;
  date: string;
  time: string;
  location: string;
  city: string;
  price: number;
  isFree: boolean;
  maxAttendees: number;
  registeredCount: number;
  organizer: string;
  organizerId: string;
  tags: string[];
  startAt: string;
  endAt: string;
  isOnline: boolean;
  streamUrl?: string;
  imageUrl?: string;
}

interface ListResult<T> {
  data: T[];
  meta: { page: number; total: number };
}

type EventWithOrganizer = Event & {
  organizer: { firstName: string; lastName: string; proProfile: { businessName: string } | null };
  _count: { registrations: number };
};

const PAGE_SIZE = 20;

const EVENT_INCLUDE = {
  organizer: { select: { firstName: true, lastName: true, proProfile: { select: { businessName: true } } } },
  _count: { select: { registrations: true } },
} as const;

@Injectable()
export class EventsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  public async findAll(category: string | undefined, page: number): Promise<ListResult<EventView>> {
    const skip = (page - 1) * PAGE_SIZE;
    const where: Prisma.EventWhereInput = category ? { category } : {};

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { startAt: 'asc' },
        include: EVENT_INCLUDE,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { data: items.map((event) => this.toEventView(event)), meta: { page, total } };
  }

  public async findById(id: string): Promise<EventView> {
    const event = await this.prisma.event.findUnique({ where: { id }, include: EVENT_INCLUDE });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return this.toEventView(event);
  }

  public async getMyRegistrations(userId: string): Promise<EventView[]> {
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { userId },
      include: { event: { include: EVENT_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });

    return registrations.map((registration) => this.toEventView(registration.event));
  }

  // Événements créés par ce compte Pro — alimente l'onglet "Offres" du tableau
  // de bord Pro (distinct de getMyRegistrations, qui liste ce que l'utilisateur
  // a rejoint en tant que participant).
  public async getManagedByOrganizer(organizerId: string): Promise<EventView[]> {
    const events = await this.prisma.event.findMany({
      where: { organizerId },
      include: EVENT_INCLUDE,
      orderBy: { startAt: 'desc' },
    });
    return events.map((event) => this.toEventView(event));
  }

  public async register(userId: string, eventId: string): Promise<{ message: string }> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.maxSeats) {
      const registrationCount = await this.prisma.eventRegistration.count({ where: { eventId } });
      if (registrationCount >= event.maxSeats) {
        throw new ConflictException('This event is fully booked');
      }
    }

    const existing = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      throw new ConflictException('You are already registered for this event');
    }

    // Événement payant : la souscription débite le wallet KFL de l'utilisateur
    // (rechargé via CinetPay/Stripe/Mobile Money — voir PaymentsModule) avant
    // de créer l'inscription. Le tout est atomique pour éviter un débit sans
    // inscription (ou l'inverse) en cas d'échec partiel.
    if (event.priceXAF > 0) {
      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balanceXAF < event.priceXAF) {
          throw new BadRequestException('Solde du portefeuille insuffisant pour souscrire à cet événement');
        }
        await tx.wallet.update({ where: { userId }, data: { balanceXAF: { decrement: event.priceXAF } } });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: TransactionType.debit,
            amountXAF: event.priceXAF,
            description: `Souscription — ${event.title}`,
          },
        });
        await tx.eventRegistration.create({ data: { eventId, userId } });
      });
      await this.notifyOrganizer(event.organizerId, userId, event.title);
      await this.notifyRegistrant(userId, event);
      return { message: 'Registered successfully' };
    }

    await this.prisma.eventRegistration.create({ data: { eventId, userId } });
    await this.notifyOrganizer(event.organizerId, userId, event.title);
    await this.notifyRegistrant(userId, event);
    return { message: 'Registered successfully' };
  }

  private async notifyRegistrant(userId: string, event: Event): Promise<void> {
    await this.notificationsService.create(
      userId,
      'event',
      'Inscription confirmée',
      `Votre inscription à l'événement "${event.title}" est confirmée.`,
      { eventId: event.id },
    );
  }

  // Alimente l'inbox système -> pro (GET /pro/messages).
  private async notifyOrganizer(organizerId: string, attendeeId: string, eventTitle: string): Promise<void> {
    const attendee = await this.prisma.user.findUnique({ where: { id: attendeeId } });
    const attendeeName = attendee ? `${attendee.firstName} ${attendee.lastName}`.trim() : 'Un utilisateur';
    await this.prisma.proMessage.create({
      data: {
        recipientId: organizerId,
        senderName: attendeeName,
        subject: 'Nouvelle inscription à votre événement',
        body: `${attendeeName} s'est inscrit(e) à votre événement "${eventTitle}".`,
      },
    });
  }

  public async unregister(userId: string, eventId: string): Promise<{ message: string }> {
    const [registration, event] = await Promise.all([
      this.prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId } } }),
      this.prisma.event.findUnique({ where: { id: eventId } }),
    ]);

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (event && event.priceXAF > 0) {
      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          await tx.wallet.update({ where: { userId }, data: { balanceXAF: { increment: event.priceXAF } } });
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: TransactionType.credit,
              amountXAF: event.priceXAF,
              description: `Remboursement — ${event.title}`,
            },
          });
        }
        await tx.eventRegistration.delete({ where: { id: registration.id } });
      });
      return { message: 'Unregistered successfully' };
    }

    await this.prisma.eventRegistration.delete({ where: { id: registration.id } });
    return { message: 'Unregistered successfully' };
  }

  public async create(organizerId: string, dto: CreateEventDto): Promise<EventView> {
    const event = await this.prisma.event.create({
      data: {
        organizerId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        imageUrl: dto.imageUrl,
        location: dto.location,
        city: dto.city,
        tags: dto.tags ?? [],
        isOnline: dto.isOnline ?? false,
        streamUrl: dto.streamUrl,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        priceXAF: dto.priceXAF ?? 0,
        maxSeats: dto.maxSeats,
      },
    });
    // Diffusion instantanée à tous les comptes connectés — sans ça, un
    // événement créé n'apparaît ailleurs qu'au prochain fetch manuel. On
    // re-résout la vue complète (organisateur, compteurs) plutôt que
    // d'envoyer la ligne Prisma brute, pour correspondre exactement à la
    // forme que le front reçoit déjà via GET /events — et pour que la
    // réponse HTTP de création corresponde elle aussi à ce format.
    const view = await this.findById(event.id);
    this.eventsGateway.broadcastNewEvent(view);
    return view;
  }

  public async update(organizerId: string, eventId: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });

    const registrantIds = await this.getRegistrantIds(eventId);
    await this.notificationsService.createForMany(
      registrantIds,
      'event',
      'Événement modifié',
      `L'événement "${updated.title}" auquel vous êtes inscrit(e) a été mis à jour.`,
      { eventId: updated.id },
    );

    return updated;
  }

  public async remove(organizerId: string, eventId: string): Promise<{ message: string }> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    const registrantIds = await this.getRegistrantIds(eventId);
    await this.prisma.event.delete({ where: { id: eventId } });
    await this.notificationsService.createForMany(
      registrantIds,
      'event',
      'Événement annulé',
      `L'événement "${event.title}" auquel vous étiez inscrit(e) a été annulé.`,
      { eventId: event.id },
    );

    return { message: 'Event deleted' };
  }

  private async getRegistrantIds(eventId: string): Promise<string[]> {
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      select: { userId: true },
    });
    return registrations.map((registration) => registration.userId);
  }

  private toEventView(event: EventWithOrganizer): EventView {
    return {
      id: event.id,
      title: event.title,
      category: event.category ?? '',
      description: event.description ?? '',
      date: event.startAt.toISOString().slice(0, 10),
      time: event.startAt.toISOString().slice(11, 16),
      location: event.location ?? '',
      city: event.city ?? '',
      price: event.priceXAF,
      isFree: event.priceXAF === 0,
      maxAttendees: event.maxSeats ?? 0,
      registeredCount: event._count.registrations,
      organizer: event.organizer.proProfile?.businessName ?? `${event.organizer.firstName} ${event.organizer.lastName}`,
      organizerId: event.organizerId,
      tags: event.tags,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      isOnline: event.isOnline,
      streamUrl: event.streamUrl ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
    };
  }
}
