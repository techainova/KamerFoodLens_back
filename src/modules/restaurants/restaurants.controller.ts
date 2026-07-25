import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Review } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import {
  MenuItemView,
  RestaurantReviewView,
  RestaurantsService,
  RestaurantView,
} from './restaurants.service';

interface ListResult<T> {
  data: T[];
  meta: { page: number; total: number };
}

@ApiTags('restaurants')
@Controller('restaurants')
export class RestaurantsController {
  public constructor(private readonly restaurantsService: RestaurantsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search restaurants by geo-location, cuisine, and pagination' })
  @ApiResponse({ status: 200, description: 'Restaurant list' })
  public async search(@Query() dto: SearchRestaurantsDto): Promise<ListResult<RestaurantView>> {
    return this.restaurantsService.search(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant details' })
  @ApiResponse({ status: 200, description: 'Restaurant details' })
  public async findById(@Param('id') id: string): Promise<RestaurantView> {
    return this.restaurantsService.findById(id);
  }

  @Public()
  @Get(':id/menu')
  @ApiOperation({ summary: 'Get restaurant menu items' })
  @ApiResponse({ status: 200, description: 'Menu items' })
  public async getMenu(@Param('id') id: string): Promise<MenuItemView[]> {
    return this.restaurantsService.getMenu(id);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Post(':id/menu')
  @ApiOperation({ summary: 'Create a menu item for an owned restaurant' })
  @ApiResponse({ status: 201, description: 'Menu item created' })
  public async createMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateMenuItemDto,
  ): Promise<MenuItemView> {
    return this.restaurantsService.createMenuItem(user.id, id, dto);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Patch(':id/menu/:itemId')
  @ApiOperation({ summary: 'Update a menu item for an owned restaurant' })
  @ApiResponse({ status: 200, description: 'Menu item updated' })
  public async updateMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemView> {
    return this.restaurantsService.updateMenuItem(user.id, id, itemId, dto);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Delete(':id/menu/:itemId')
  @ApiOperation({ summary: 'Delete a menu item for an owned restaurant' })
  @ApiResponse({ status: 200, description: 'Menu item deleted' })
  public async deleteMenuItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<{ message: string }> {
    return this.restaurantsService.deleteMenuItem(user.id, id, itemId);
  }

  @Roles('standard', 'pro', 'admin')
  @ApiBearerAuth()
  @Post(':id/reviews')
  @ApiOperation({ summary: 'Create a restaurant review' })
  @ApiResponse({ status: 201, description: 'Review created' })
  public async createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.restaurantsService.createReview(user.id, id, dto);
  }

  @Public()
  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get paginated restaurant reviews' })
  @ApiResponse({ status: 200, description: 'Restaurant reviews' })
  public async getReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
  ): Promise<ListResult<RestaurantReviewView>> {
    return this.restaurantsService.getReviews(id, page ? parseInt(page, 10) : 1);
  }
}
