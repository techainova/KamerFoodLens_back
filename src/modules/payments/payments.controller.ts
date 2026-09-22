import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Transaction, Wallet } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AesDecryptGuard } from '../../common/guards/aes-decrypt.guard';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { InitiatePaymentResult, PaymentsService } from './payments.service';

interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  public constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @Post('initiate')
  @UseGuards(AesDecryptGuard)
  @ApiOperation({ summary: 'Initiate a payment for an order (AES-256-GCM encrypted payload)' })
  @ApiResponse({ status: 201, description: 'Payment initiated' })
  public async initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResult> {
    return this.paymentsService.initiate(user.id, dto);
  }

  @Public()
  @Post('webhook/cinetpay')
  @ApiOperation({ summary: 'CinetPay IPN webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  public async cinetpayWebhook(@Body() payload: Record<string, unknown>): Promise<{ received: boolean }> {
    return this.paymentsService.handleCinetPayWebhook(payload);
  }

  @Public()
  @Post('webhook/stripe')
  @ApiOperation({ summary: 'Stripe webhook (signature verified)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  public async stripeWebhook(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing raw body or Stripe signature header');
    }
    return this.paymentsService.handleStripeWebhook(req.rawBody.toString('utf8'), signature);
  }

  @ApiBearerAuth()
  @Get('wallet')
  @ApiOperation({ summary: 'Get current user wallet balance' })
  @ApiResponse({ status: 200, description: 'Wallet balance' })
  public async getWallet(@CurrentUser() user: AuthenticatedUser): Promise<Wallet> {
    return this.paymentsService.getWallet(user.id);
  }

  @ApiBearerAuth()
  @Post('wallet/topup')
  @ApiOperation({ summary: 'Top up the wallet balance' })
  @ApiResponse({ status: 201, description: 'Topup initiated' })
  public async topup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TopupWalletDto,
  ): Promise<InitiatePaymentResult> {
    return this.paymentsService.topup(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('transactions')
  @ApiOperation({ summary: 'Get paginated payment transaction history' })
  @ApiResponse({ status: 200, description: 'Paginated transactions' })
  public async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<Transaction>> {
    return this.paymentsService.getTransactions(user.id, page ? parseInt(page, 10) : 1);
  }
}
