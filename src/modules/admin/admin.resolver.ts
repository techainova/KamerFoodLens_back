import {
  Args,
  Field,
  Float,
  ID,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  registerEnumType,
} from '@nestjs/graphql';
import { LogLevel, OrderStatus, ProRequestStatus } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

registerEnumType(ProRequestStatus, { name: 'ProRequestStatus' });
registerEnumType(LogLevel, { name: 'LogLevel' });

@ObjectType()
class AdminDashboardType {
  @Field(() => Int)
  public totalUsers!: number;

  @Field(() => Int)
  public totalProUsers!: number;

  @Field(() => Int)
  public totalRestaurants!: number;

  @Field(() => Int)
  public totalOrders!: number;

  @Field(() => Int)
  public totalRevenueXAF!: number;

  @Field(() => Int)
  public pendingProRequests!: number;

  @Field(() => Int)
  public pendingPayouts!: number;
}

@ObjectType()
class AdminUserType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public email!: string;

  @Field()
  public firstName!: string;

  @Field()
  public lastName!: string;

  @Field()
  public role!: string;

  @Field()
  public isActive!: boolean;

  @Field()
  public isBanned!: boolean;
}

@ObjectType()
class AdminUsersPageType {
  @Field(() => [AdminUserType])
  public items!: AdminUserType[];

  @Field(() => Int)
  public total!: number;
}

@ObjectType()
class AdminProRequestType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public userId!: string;

  @Field()
  public businessName!: string;

  @Field()
  public status!: string;
}

const AdminOrderStatusAlias = OrderStatus;

@ObjectType()
class AdminOrderType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public ref!: string;

  @Field(() => AdminOrderStatusAlias)
  public status!: OrderStatus;

  @Field(() => Int)
  public totalXAF!: number;
}

@ObjectType()
class AdminOrdersPageType {
  @Field(() => [AdminOrderType])
  public items!: AdminOrderType[];

  @Field(() => Int)
  public total!: number;
}

@ObjectType()
class AdminFinanceType {
  @Field(() => Int)
  public totalRevenueXAF!: number;

  @Field(() => Int)
  public totalKflFeesXAF!: number;

  @Field(() => Int)
  public totalPayoutsXAF!: number;

  @Field(() => Int)
  public pendingPayoutsXAF!: number;
}

@ObjectType()
class AdminLogType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public level!: string;

  @Field()
  public message!: string;

  @Field()
  public createdAt!: Date;
}

@ObjectType()
class AdminLogsPageType {
  @Field(() => [AdminLogType])
  public items!: AdminLogType[];

  @Field(() => Int)
  public total!: number;
}

@ObjectType()
class ProRequestMutationResultType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public status!: string;
}

@ObjectType()
class UserMutationResultType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public isActive!: boolean;

  @Field()
  public isBanned!: boolean;
}

@ObjectType()
class PayoutMutationResultType {
  @Field(() => ID)
  public id!: string;

  @Field()
  public status!: string;
}

@ObjectType()
class PushMutationResultType {
  @Field()
  public queued!: boolean;
}

@ObjectType()
class SettingsMutationResultType {
  @Field()
  public maintenanceMode!: boolean;

  @Field(() => Float)
  public commissionPct!: number;
}

@Resolver()
@Roles('admin')
export class AdminResolver {
  public constructor(private readonly adminService: AdminService) {}

  @Query(() => AdminDashboardType)
  public async adminDashboard(): Promise<AdminDashboardType> {
    return this.adminService.getDashboard();
  }

  @Query(() => AdminUsersPageType)
  public async adminUsers(
    @Args('filter', { nullable: true }) filter?: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ): Promise<AdminUsersPageType> {
    const result = await this.adminService.getUsers(filter, page ?? 1);
    return { items: result.items, total: result.total };
  }

  @Query(() => [AdminProRequestType])
  public async adminProList(
    @Args('status', { type: () => ProRequestStatus, nullable: true }) status?: ProRequestStatus,
  ): Promise<AdminProRequestType[]> {
    return this.adminService.getProRequests(status);
  }

  @Query(() => AdminOrdersPageType)
  public async adminOrders(
    @Args('status', { type: () => AdminOrderStatusAlias, nullable: true }) status?: OrderStatus,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ): Promise<AdminOrdersPageType> {
    const result = await this.adminService.getOrders(status, page ?? 1);
    return { items: result.items, total: result.total };
  }

  @Query(() => AdminFinanceType)
  public async adminFinance(): Promise<AdminFinanceType> {
    return this.adminService.getFinance();
  }

  @Query(() => AdminLogsPageType)
  public async adminLogs(
    @Args('level', { type: () => LogLevel, nullable: true }) level?: LogLevel,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ): Promise<AdminLogsPageType> {
    const result = await this.adminService.getLogs(level, page ?? 1);
    return { items: result.items, total: result.total };
  }

  @Mutation(() => ProRequestMutationResultType)
  public async approveProRequest(@Args('userId') userId: string): Promise<ProRequestMutationResultType> {
    const request = await this.adminService.approveProRequestByUserId(userId);
    return { id: request.id, status: request.status };
  }

  @Mutation(() => ProRequestMutationResultType)
  public async rejectProRequest(
    @Args('userId') userId: string,
    @Args('reason') reason: string,
  ): Promise<ProRequestMutationResultType> {
    const request = await this.adminService.rejectProRequestByUserId(userId, reason);
    return { id: request.id, status: request.status };
  }

  @Mutation(() => UserMutationResultType)
  public async suspendUser(
    @Args('userId') userId: string,
    @Args('days', { type: () => Int }) days: number,
  ): Promise<UserMutationResultType> {
    const user = await this.adminService.suspendUser(userId, days);
    return { id: user.id, isActive: user.isActive, isBanned: user.isBanned };
  }

  @Mutation(() => UserMutationResultType)
  public async banUser(@Args('userId') userId: string): Promise<UserMutationResultType> {
    const user = await this.adminService.banUser(userId);
    return { id: user.id, isActive: user.isActive, isBanned: user.isBanned };
  }

  @Mutation(() => PayoutMutationResultType)
  public async approvePayout(@Args('payoutId') payoutId: string): Promise<PayoutMutationResultType> {
    const payout = await this.adminService.approvePayout(payoutId);
    return { id: payout.id, status: payout.status };
  }

  @Mutation(() => PushMutationResultType)
  public async sendPushNotification(
    @Args('target') target: string,
    @Args('title') title: string,
    @Args('body') body: string,
  ): Promise<PushMutationResultType> {
    return this.adminService.sendPush(target, title, body);
  }

  @Mutation(() => SettingsMutationResultType)
  public async setMaintenanceMode(@Args('enabled') enabled: boolean): Promise<SettingsMutationResultType> {
    const settings = await this.adminService.setMaintenanceMode(enabled);
    return { maintenanceMode: settings.maintenanceMode, commissionPct: settings.commissionPct };
  }

  @Mutation(() => SettingsMutationResultType)
  public async setCommissionRate(
    @Args('percent', { type: () => Float }) percent: number,
  ): Promise<SettingsMutationResultType> {
    const settings = await this.adminService.setCommissionRate(percent);
    return { maintenanceMode: settings.maintenanceMode, commissionPct: settings.commissionPct };
  }
}
