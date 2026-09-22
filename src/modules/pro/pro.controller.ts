import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Payout, Promo, ProMessage, ProRequest } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MessageView } from '../messages/messages.service';
import { UpgradeProDto } from './dto/upgrade-pro.dto';
import { CreatePromoDto } from './dto/create-promo.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdatePaymentMethodsDto } from './dto/update-payment-methods.dto';
import { ReplyToMessageDto } from './dto/reply-to-message.dto';
import { SetMemberBlockedDto } from './dto/set-member-blocked.dto';
import {
  CommunityMemberView,
  PaymentMethodBreakdown,
  PaymentMethodsView,
  ProOrderDetailView,
  ProOrderSummary,
  ProService,
  ProStats,
  RevenueDaySummary,
} from './pro.service';

@ApiTags('pro')
@ApiBearerAuth()
@Controller('pro')
export class ProController {
  public constructor(private readonly proService: ProService) {}

  @Roles('pro', 'admin')
  @Get('dashboard')
  @ApiOperation({ summary: 'Get Pro dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Pro stats' })
  public async getDashboard(@CurrentUser() user: AuthenticatedUser): Promise<ProStats> {
    return this.proService.getDashboard(user.id);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Request a Pro account upgrade' })
  @ApiResponse({ status: 201, description: 'Pro request created (pending admin approval)' })
  public async upgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpgradeProDto,
  ): Promise<ProRequest> {
    return this.proService.requestUpgrade(user.id, dto);
  }

  @Roles('pro', 'admin')
  @Get('revenues')
  @ApiOperation({ summary: 'Get revenue summary for a period' })
  @ApiResponse({ status: 200, description: 'Revenue summary' })
  public async getRevenues(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: string = 'week',
  ): Promise<{
    period: string;
    totalXAF: number;
    ordersCount: number;
    revenueByDay: RevenueDaySummary[];
    paymentBreakdown: PaymentMethodBreakdown[];
  }> {
    return this.proService.getRevenues(user.id, period);
  }

  @Roles('pro', 'admin')
  @Get('analytics')
  @ApiOperation({ summary: 'Get order and menu analytics for a period' })
  @ApiResponse({ status: 200, description: 'Analytics summary' })
  public async getAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: string = 'week',
  ): Promise<{
    period: string;
    ordersByStatus: Record<string, number>;
    topMenuItems: { name: string; qty: number }[];
  }> {
    return this.proService.getAnalytics(user.id, period);
  }

  @Roles('pro', 'admin')
  @Get('messages')
  @ApiOperation({ summary: 'Get paginated Pro inbox messages' })
  @ApiResponse({ status: 200, description: 'Paginated messages' })
  public async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
  ): Promise<{ items: ProMessage[]; total: number; page: number }> {
    return this.proService.getMessages(user.id, page ? parseInt(page, 10) : 1);
  }

  @Roles('pro', 'admin')
  @Patch('messages/:id/read')
  @ApiOperation({ summary: 'Mark a Pro inbox message as read' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  public async markMessageRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProMessage> {
    return this.proService.markMessageRead(user.id, id);
  }

  @Roles('pro', 'admin')
  @Post('messages/:id/reply')
  @ApiOperation({ summary: "Reply to a Pro inbox message via direct messaging (when the sender is identifiable)" })
  @ApiResponse({ status: 201, description: 'Reply sent' })
  public async replyToMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplyToMessageDto,
  ): Promise<MessageView> {
    return this.proService.replyToMessage(user.id, id, dto.text);
  }

  @Roles('pro', 'admin')
  @Get('community/members')
  @ApiOperation({ summary: 'List followers ("community members") of the owned restaurants' })
  @ApiResponse({ status: 200, description: 'Community members' })
  public async getCommunityMembers(@CurrentUser() user: AuthenticatedUser): Promise<CommunityMemberView[]> {
    return this.proService.getCommunityMembers(user.id);
  }

  @Roles('pro', 'admin')
  @Patch('community/members/:memberId/block')
  @ApiOperation({ summary: 'Block or unblock a community member from following the owned restaurants' })
  @ApiResponse({ status: 200, description: 'Block status updated' })
  public async setCommunityMemberBlocked(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
    @Body() dto: SetMemberBlockedDto,
  ): Promise<{ message: string }> {
    return this.proService.setCommunityMemberBlocked(user.id, memberId, dto.blocked);
  }

  @Roles('pro', 'admin')
  @Delete('community/members/:memberId')
  @ApiOperation({ summary: 'Remove a community member (unfollow them from the owned restaurants)' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  public async removeCommunityMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ): Promise<{ message: string }> {
    return this.proService.removeCommunityMember(user.id, memberId);
  }

  @Roles('pro', 'admin')
  @Get('promos')
  @ApiOperation({ summary: 'List promos for owned restaurants' })
  @ApiResponse({ status: 200, description: 'Promos list' })
  public async getPromos(@CurrentUser() user: AuthenticatedUser): Promise<Promo[]> {
    return this.proService.getPromos(user.id);
  }

  @Roles('pro', 'admin')
  @Post('promos')
  @ApiOperation({ summary: 'Create a promo for an owned restaurant' })
  @ApiResponse({ status: 201, description: 'Promo created' })
  public async createPromo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromoDto,
  ): Promise<Promo> {
    return this.proService.createPromo(user.id, dto);
  }

  @Roles('pro', 'admin')
  @Get('orders')
  @ApiOperation({ summary: 'Get paginated orders for owned restaurants' })
  @ApiResponse({ status: 200, description: 'Paginated Pro order summaries' })
  public async getOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: string,
  ): Promise<{ items: ProOrderSummary[]; total: number }> {
    return this.proService.getOrders(user.id, status, page ? parseInt(page, 10) : 1);
  }

  @Roles('pro', 'admin')
  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order details for an owned restaurant' })
  @ApiResponse({ status: 200, description: 'Order detail' })
  public async getOrderDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProOrderDetailView> {
    return this.proService.getOrderDetail(user.id, id);
  }

  @Roles('pro', 'admin')
  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Update the status of an order for an owned restaurant' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  public async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<ProOrderDetailView> {
    return this.proService.updateOrderStatus(user.id, id, dto.status);
  }

  @Roles('pro', 'admin')
  @Get('restaurants')
  @ApiOperation({ summary: 'List the current user owned restaurants' })
  @ApiResponse({ status: 200, description: 'Owned restaurants' })
  public async getMyRestaurants(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; name: string }[]> {
    return this.proService.getMyRestaurants(user.id);
  }

  @Roles('pro', 'admin')
  @Get('payouts')
  @ApiOperation({ summary: 'List the current user payout requests' })
  @ApiResponse({ status: 200, description: 'Payout requests' })
  public async getPayouts(@CurrentUser() user: AuthenticatedUser): Promise<Payout[]> {
    return this.proService.getPayouts(user.id);
  }

  @Roles('pro', 'admin')
  @Get('subscription')
  @ApiOperation({ summary: 'Get the current Pro subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription info' })
  public async getSubscription(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ plan: string; status: string; proProfile: unknown }> {
    return this.proService.getSubscription(user.id);
  }

  @Roles('pro', 'admin')
  @Get('payment-methods')
  @ApiOperation({ summary: 'Get accepted payment methods and mobile money numbers' })
  @ApiResponse({ status: 200, description: 'Payment methods configuration' })
  public async getPaymentMethods(@CurrentUser() user: AuthenticatedUser): Promise<PaymentMethodsView> {
    return this.proService.getPaymentMethods(user.id);
  }

  @Roles('pro', 'admin')
  @Patch('payment-methods')
  @ApiOperation({ summary: 'Update accepted payment methods and mobile money numbers' })
  @ApiResponse({ status: 200, description: 'Updated payment methods configuration' })
  public async updatePaymentMethods(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePaymentMethodsDto,
  ): Promise<PaymentMethodsView> {
    return this.proService.updatePaymentMethods(user.id, dto);
  }

  @Roles('pro', 'admin')
  @Post('payouts/request')
  @ApiOperation({ summary: 'Request a payout of accumulated revenue' })
  @ApiResponse({ status: 201, description: 'Payout request created' })
  public async requestPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestPayoutDto,
  ): Promise<{ message: string; requestId: string }> {
    const payout = await this.proService.requestPayout(user.id, dto.amountXAF, dto.method, dto.phone);
    return { message: 'Payout request submitted', requestId: payout.id };
  }
}
