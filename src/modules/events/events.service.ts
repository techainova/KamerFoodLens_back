import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

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
  public constructor(private readonly prisma: PrismaService) {}

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

    await this.prisma.eventRegistration.create({ data: { eventId, userId } });
    return { message: 'Registered successfully' };
  }

  public async unregister(userId: string, eventId: string): Promise<{ message: string }> {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    await this.prisma.eventRegistration.delete({ where: { id: registration.id } });
    return { message: 'Unregistered successfully' };
  }

  public async create(organizerId: string, dto: CreateEventDto): Promise<Event> {
    return this.prisma.event.create({
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
  }

  public async update(organizerId: string, eventId: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
  }

  public async remove(organizerId: string, eventId: string): Promise<{ message: string }> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('You do not own this event');
    }

    await this.prisma.event.delete({ where: { id: eventId } });
    return { message: 'Event deleted' };
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
      tags: event.tags,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      isOnline: event.isOnline,
      streamUrl: event.streamUrl ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
    };
  }
}
