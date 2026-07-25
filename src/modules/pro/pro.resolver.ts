import {
  Args,
  Field,
  Float,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  registerEnumType,
} from '@nestjs/graphql';
import { OrderStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ProService } from './pro.service';

registerEnumType(OrderStatus, { name: 'OrderStatus' });

@ObjectType()
class ProStatsType {
  @Field(() => Int)
  public revenueXAF!: number;

  @Field(() => Float)
  public revenueChange!: number;

  @Field(() => Int)
  public ordersCount!: number;

  @Field(() => Float)
  public ordersChange!: number;

  @Field(() => Int)
  public customersCount!: number;

  @Field(() => Int)
  public avgOrderXAF!: number;

  @Field(() => Int)
  public activeMenuItems!: number;

  @Field(() => Float)
  public rating!: number;
}

@ObjectType()
class ProOrderSummaryType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public ref!: string;

  @Field()
  public clientName!: string;

  @Field(() => OrderStatus)
  public status!: OrderStatus;

  @Field(() => Int)
  public totalXAF!: number;

  @Field()
  public createdAt!: Date;
}

@ObjectType()
class ProOrdersPageType {
  @Field(() => [ProOrderSummaryType])
  public items!: ProOrderSummaryType[];

  @Field(() => Int)
  public total!: number;
}

@ObjectType()
class MenuItemAggregateType {
  @Field()
  public name!: string;

  @Field(() => Int)
  public qty!: number;
}

@ObjectType()
class ProAnalyticsType {
  @Field()
  public period!: string;

  @Field(() => String)
  public ordersByStatus!: string;

  @Field(() => [MenuItemAggregateType])
  public topMenuItems!: MenuItemAggregateType[];
}

@ObjectType()
class ProMessageType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public senderName!: string;

  @Field()
  public subject!: string;

  @Field()
  public body!: string;

  @Field()
  public isRead!: boolean;

  @Field()
  public createdAt!: Date;
}

@ObjectType()
class PromoType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public restaurantId!: string;

  @Field()
  public title!: string;

  @Field(() => Int, { nullable: true })
  public discountPercent!: number | null;

  @Field(() => Int, { nullable: true })
  public discountXAF!: number | null;

  @Field()
  public validFrom!: Date;

  @Field()
  public validUntil!: Date;
}

@ObjectType()
class PayoutType {
  @Field(() => ID)
  public id!: string;

  @Field(() => Int)
  public amountXAF!: number;

  @Field()
  public status!: string;
}

@InputType()
class CreatePromoInput {
  @Field()
  public restaurantId!: string;

  @Field()
  public title!: string;

  @Field(() => Int, { nullable: true })
  public discountPercent?: number;

  @Field(() => Int, { nullable: true })
  public discountXAF?: number;

  @Field()
  public validFrom!: string;

  @Field()
  public validUntil!: string;
}

@Resolver()
@Roles('pro', 'admin')
export class ProResolver {
  public constructor(private readonly proService: ProService) {}

  @Query(() => ProStatsType)
  public async proDashboard(@CurrentUser() user: AuthenticatedUser): Promise<ProStatsType> {
    return this.proService.getDashboard(user.id);
  }

  @Query(() => ProOrdersPageType)
  public async proOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Args('status', { type: () => OrderStatus, nullable: true }) status?: OrderStatus,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ): Promise<ProOrdersPageType> {
    return this.proService.getOrders(user.id, status, page ?? 1);
  }

  @Query(() => ProAnalyticsType)
  public async proAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Args('period', { nullable: true }) period?: string,
  ): Promise<ProAnalyticsType> {
    const analytics = await this.proService.getAnalytics(user.id, period ?? 'week');
    return { ...analytics, ordersByStatus: JSON.stringify(analytics.ordersByStatus) };
  }

  @Query(() => [ProMessageType])
  public async proMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ): Promise<ProMessageType[]> {
    const result = await this.proService.getMessages(user.id, page ?? 1);
    return result.items;
  }

  @Mutation(() => PromoType)
  public async createPromo(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreatePromoInput,
  ): Promise<PromoType> {
    return this.proService.createPromo(user.id, input);
  }

  @Mutation(() => ProOrderSummaryType)
  public async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Args('orderId') orderId: string,
    @Args('status', { type: () => OrderStatus }) status: OrderStatus,
  ): Promise<ProOrderSummaryType> {
    const order = await this.proService.updateOrderStatus(user.id, orderId, status);
    return {
      id: order.id,
      ref: order.ref,
      clientName: '',
      status: order.status,
      totalXAF: order.totalXAF,
      createdAt: order.createdAt,
    };
  }

  @Mutation(() => PayoutType)
  public async requestPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Args('amountXAF', { type: () => Int }) amountXAF: number,
  ): Promise<PayoutType> {
    return this.proService.requestPayout(user.id, amountXAF);
  }
}
