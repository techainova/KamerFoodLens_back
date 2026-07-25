import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Order } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  public constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  public async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated order history' })
  @ApiResponse({ status: 200, description: 'Paginated orders' })
  public async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<Order>> {
    return this.ordersService.findAllForUser(user.id, page ? parseInt(page, 10) : 1);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, description: 'Order details' })
  public async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Order> {
    return this.ordersService.findOne(user.id, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  public async cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Order> {
    return this.ordersService.cancel(user.id, id);
  }
}
