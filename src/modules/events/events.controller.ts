import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Event } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService, EventView } from './events.service';

interface ListResult<T> {
  data: T[];
  meta: { page: number; total: number };
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  public constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List events, optionally filtered by category' })
  @ApiResponse({ status: 200, description: 'Event list' })
  public async findAll(
    @Query('category') category?: string,
    @Query('page') page?: string,
  ): Promise<ListResult<EventView>> {
    return this.eventsService.findAll(category, page ? parseInt(page, 10) : 1);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'Get events the current user is registered for' })
  @ApiResponse({ status: 200, description: 'Registered events' })
  public async getMyRegistrations(@CurrentUser() user: AuthenticatedUser): Promise<EventView[]> {
    return this.eventsService.getMyRegistrations(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get event details' })
  @ApiResponse({ status: 200, description: 'Event details' })
  public async findById(@Param('id') id: string): Promise<EventView> {
    return this.eventsService.findById(id);
  }

  @ApiBearerAuth()
  @Post(':id/register')
  @ApiOperation({ summary: 'Register the current user for an event' })
  @ApiResponse({ status: 201, description: 'Registered' })
  public async register(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.eventsService.register(user.id, id);
  }

  @ApiBearerAuth()
  @Delete(':id/register')
  @ApiOperation({ summary: 'Unregister the current user from an event' })
  @ApiResponse({ status: 200, description: 'Unregistered' })
  public async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.eventsService.unregister(user.id, id);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create an event (Pro only)' })
  @ApiResponse({ status: 201, description: 'Event created' })
  public async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(user.id, dto);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update an event (Pro only)' })
  @ApiResponse({ status: 200, description: 'Event updated' })
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventsService.update(user.id, id, dto);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event (Pro only)' })
  @ApiResponse({ status: 200, description: 'Event deleted' })
  public async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.eventsService.remove(user.id, id);
  }
}
