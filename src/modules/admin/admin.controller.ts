import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Event,
  Order,
  OrderStatus,
  Payout,
  PayoutStatus,
  ProRequest,
  ProRequestStatus,
  SystemLog,
  SystemSetting,
  Tombola,
  User,
  LogLevel,
} from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PushNotificationDto } from './dto/push-notification.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { RejectProRequestDto } from './dto/reject-pro-request.dto';
import { AdminDashboardStats, AdminService } from './admin.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  public constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard summary statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  public async getDashboard(): Promise<AdminDashboardStats> {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get paginated, filterable users list' })
  @ApiResponse({ status: 200, description: 'Paginated users' })
  public async getUsers(
    @Query('filter') filter?: string,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<User>> {
    return this.adminService.getUsers(filter, page ? parseInt(page, 10) : 1);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'User details' })
  public async getUserById(@Param('id') id: string): Promise<User> {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user for a number of days' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  public async suspendUser(@Param('id') id: string, @Body() dto: SuspendUserDto): Promise<User> {
    return this.adminService.suspendUser(id, dto.days);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Permanently ban a user' })
  @ApiResponse({ status: 200, description: 'User banned' })
  public async banUser(@Param('id') id: string): Promise<User> {
    return this.adminService.banUser(id);
  }

  @Get('pro-requests')
  @ApiOperation({ summary: 'Get Pro upgrade requests, optionally filtered by status' })
  @ApiResponse({ status: 200, description: 'Pro requests' })
  public async getProRequests(@Query('status') status?: ProRequestStatus): Promise<ProRequest[]> {
    return this.adminService.getProRequests(status);
  }

  @Patch('pro-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a Pro upgrade request' })
  @ApiResponse({ status: 200, description: 'Pro request approved, user upgraded' })
  public async approveProRequest(@Param('id') id: string): Promise<ProRequest> {
    return this.adminService.approveProRequest(id);
  }

  @Patch('pro-requests/:id/reject')
  @ApiOperation({ summary: 'Reject a Pro upgrade request' })
  @ApiResponse({ status: 200, description: 'Pro request rejected' })
  public async rejectProRequest(
    @Param('id') id: string,
    @Body() dto: RejectProRequestDto,
  ): Promise<ProRequest> {
    return this.adminService.rejectProRequest(id, dto.reason);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get paginated orders, optionally filtered by status' })
  @ApiResponse({ status: 200, description: 'Paginated orders' })
  public async getOrders(
    @Query('status') status?: OrderStatus,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<Order>> {
    return this.adminService.getOrders(status, page ? parseInt(page, 10) : 1);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get paginated events for moderation' })
  @ApiResponse({ status: 200, description: 'Paginated events' })
  public async getEvents(@Query('page') page?: string): Promise<PaginatedResult<Event>> {
    return this.adminService.getEvents(page ? parseInt(page, 10) : 1);
  }

  @Get('finance')
  @ApiOperation({ summary: 'Get platform-wide financial summary' })
  @ApiResponse({ status: 200, description: 'Finance summary' })
  public async getFinance(): Promise<{
    totalRevenueXAF: number;
    totalKflFeesXAF: number;
    totalPayoutsXAF: number;
    pendingPayoutsXAF: number;
  }> {
    return this.adminService.getFinance();
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Get payouts, optionally filtered by status' })
  @ApiResponse({ status: 200, description: 'Payouts list' })
  public async getPayouts(@Query('status') status?: PayoutStatus): Promise<Payout[]> {
    return this.adminService.getPayouts(status);
  }

  @Patch('payouts/:id/approve')
  @ApiOperation({ summary: 'Approve a Pro payout request' })
  @ApiResponse({ status: 200, description: 'Payout approved' })
  public async approvePayout(@Param('id') id: string): Promise<Payout> {
    return this.adminService.approvePayout(id);
  }

  @Post('push')
  @ApiOperation({ summary: 'Send a push notification to a target audience' })
  @ApiResponse({ status: 201, description: 'Push notification queued' })
  public async sendPush(@Body() dto: PushNotificationDto): Promise<{ queued: boolean }> {
    return this.adminService.sendPush(dto.target, dto.title, dto.body);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get paginated system logs, optionally filtered by level' })
  @ApiResponse({ status: 200, description: 'Paginated logs' })
  public async getLogs(
    @Query('level') level?: LogLevel,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<SystemLog>> {
    return this.adminService.getLogs(level, page ? parseInt(page, 10) : 1);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get system settings' })
  @ApiResponse({ status: 200, description: 'System settings' })
  public async getSettings(): Promise<SystemSetting> {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update system settings' })
  @ApiResponse({ status: 200, description: 'System settings updated' })
  public async updateSettings(@Body() dto: UpdateSettingsDto): Promise<SystemSetting> {
    return this.adminService.updateSettings(dto);
  }

  @Get('tombola')
  @ApiOperation({ summary: 'Get all tombolas' })
  @ApiResponse({ status: 200, description: 'Tombolas list' })
  public async getTombola(): Promise<Tombola[]> {
    return this.adminService.getTombola();
  }

  @Post('tombola/draw')
  @ApiOperation({ summary: 'Trigger the tombola draw and notify winners' })
  @ApiResponse({ status: 201, description: 'Draw completed' })
  public async drawTombola(): Promise<{ tombolaId: string; winners: string[] }> {
    return this.adminService.drawTombola();
  }
}
