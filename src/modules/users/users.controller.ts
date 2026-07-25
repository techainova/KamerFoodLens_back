import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Notification } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { AddJournalDto } from './dto/add-journal.dto';
import {
  BadgeWithStatus,
  EnrichedFavorite,
  JournalEntryView,
  PaginatedResult,
  UserProfile,
  UsersService,
} from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  public async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  public async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Get('badges')
  @ApiOperation({ summary: 'List all badges with earned status for the current user' })
  @ApiResponse({ status: 200, description: 'Badges with isEarned flag' })
  public async getBadges(@CurrentUser() user: AuthenticatedUser): Promise<BadgeWithStatus[]> {
    return this.usersService.getBadges(user.id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Paginated list of notifications' })
  @ApiResponse({ status: 200, description: 'Notifications page with unread count' })
  public async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<Notification> & { unreadCount: number }> {
    return this.usersService.getNotifications(user.id, page ? parseInt(page, 10) : 1);
  }

  @Patch('notifications/read/:id')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  public async markNotificationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Notification> {
    return this.usersService.markNotificationRead(user.id, id);
  }

  @Patch('notifications/read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  public async markAllNotificationsRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.usersService.markAllNotificationsRead(user.id);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorite items' })
  @ApiResponse({ status: 200, description: 'Favorite items' })
  public async getFavorites(@CurrentUser() user: AuthenticatedUser): Promise<EnrichedFavorite[]> {
    return this.usersService.getFavorites(user.id);
  }

  @Post('favorites')
  @ApiOperation({ summary: 'Add a favorite item' })
  @ApiResponse({ status: 201, description: 'Favorite created' })
  public async addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddFavoriteDto,
  ): Promise<EnrichedFavorite> {
    return this.usersService.addFavorite(user.id, dto);
  }

  @Delete('favorites/:id')
  @ApiOperation({ summary: 'Remove a favorite item' })
  @ApiResponse({ status: 200, description: 'Favorite removed' })
  public async removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.usersService.removeFavorite(user.id, id);
  }

  @Get('journal')
  @ApiOperation({ summary: 'Get food journal entries, optionally filtered by date' })
  @ApiResponse({ status: 200, description: 'Journal entries' })
  public async getJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
  ): Promise<JournalEntryView[]> {
    return this.usersService.getJournal(user.id, date);
  }

  @Post('journal')
  @ApiOperation({ summary: 'Add a food journal entry' })
  @ApiResponse({ status: 201, description: 'Journal entry created' })
  public async addJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddJournalDto,
  ): Promise<JournalEntryView> {
    return this.usersService.addJournalEntry(user.id, dto);
  }

  @Delete('journal/:id')
  @ApiOperation({ summary: 'Remove a food journal entry' })
  @ApiResponse({ status: 200, description: 'Journal entry removed' })
  public async removeJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.usersService.removeJournalEntry(user.id, id);
  }
}
