import { ForbiddenException, NotFoundException, Injectable } from '@nestjs/common';
import { MenuItem, Prisma, Restaurant, Review } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { GamesService } from '../games/games.service';

export interface RestaurantView {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  district?: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  priceRange: 1 | 2 | 3;
  imageUrl?: string;
  isOpen: boolean;
  distance?: number;
  specialties: string[];
  phone?: string;
  hoursLabel?: string;
  isVerified: boolean;
  ownerId: string;
}

export interface MenuItemView {
  id: string;
  name: string;
  nameEN?: string;
  category: string;
  description?: string;
  priceXAF: number;
  imageUrl?: string;
  isAvailable: boolean;
  allergens?: string[];
}

export interface RestaurantReviewView {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface ListResult<T> {
  data: T[];
  meta: { page: number; total: number };
}

const PAGE_SIZE = 20;
const DEFAULT_RADIUS_KM = 10;
const EARTH_RADIUS_KM = 6371;

@Injectable()
export class RestaurantsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly gamesService: GamesService,
  ) {}

  public async search(dto: SearchRestaurantsDto): Promise<ListResult<RestaurantView>> {
    const page = dto.page ?? 1;
    const skip = (page - 1) * PAGE_SIZE;

    if (dto.lat !== undefined && dto.lng !== undefined) {
      // radius is provided in meters by clients (map/geo convention); convert to km for the SQL distance calc.
      const radiusKm = (dto.radius ?? DEFAULT_RADIUS_KM * 1000) / 1000;
      return this.searchByGeo(dto.lat, dto.lng, radiusKm, dto.cuisine, page, skip);
    }

    const where: Prisma.RestaurantWhereInput = dto.cuisine
      ? { cuisineType: dto.cuisine, isActive: true }
      : { isActive: true };

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({ where, skip, take: PAGE_SIZE, orderBy: { createdAt: 'desc' } }),
      this.prisma.restaurant.count({ where }),
    ]);

    const data = await Promise.all(restaurants.map((restaurant) => this.toRestaurantView(restaurant)));
    return { data, meta: { page, total } };
  }

  public async findById(id: string): Promise<RestaurantView> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return this.toRestaurantView(restaurant);
  }

  public async getMenu(restaurantId: string): Promise<MenuItemView[]> {
    await this.ensureExists(restaurantId);
    const items = await this.prisma.menuItem.findMany({
      where: { restaurantId },
      orderBy: { category: 'asc' },
    });
    return items.map((item) => this.toMenuItemView(item));
  }

  public async createReview(userId: string, restaurantId: string, dto: CreateReviewDto): Promise<Review> {
    await this.ensureExists(restaurantId);
    const review = await this.prisma.review.create({
      data: { userId, restaurantId, rating: dto.rating, comment: dto.comment },
    });

    await this.gamesService.awardReviewXp(userId);

    return review;
  }

  public async getReviews(restaurantId: string, page: number): Promise<ListResult<RestaurantReviewView>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { restaurantId },
        skip,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.review.count({ where: { restaurantId } }),
    ]);

    const data = reviews.map((review) => ({
      id: review.id,
      authorName: `${review.user.firstName} ${review.user.lastName.charAt(0)}.`,
      rating: review.rating,
      text: review.comment ?? '',
      createdAt: review.createdAt.toISOString(),
    }));

    return { data, meta: { page, total } };
  }

  public async createMenuItem(userId: string, restaurantId: string, dto: CreateMenuItemDto): Promise<MenuItemView> {
    await this.ensureOwner(userId, restaurantId);

    const item = await this.prisma.menuItem.create({
      data: {
        restaurantId,
        name: dto.name,
        nameEN: dto.nameEN,
        description: dto.description,
        priceXAF: dto.priceXAF,
        category: dto.category,
        imageUrl: dto.imageUrl,
        isAvailable: dto.isAvailable ?? true,
        allergens: dto.allergens ?? [],
      },
    });

    return this.toMenuItemView(item);
  }

  public async updateMenuItem(
    userId: string,
    restaurantId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItemView> {
    await this.ensureOwner(userId, restaurantId);
    await this.ensureMenuItemBelongs(restaurantId, itemId);

    const item = await this.prisma.menuItem.update({ where: { id: itemId }, data: dto });
    return this.toMenuItemView(item);
  }

  public async deleteMenuItem(userId: string, restaurantId: string, itemId: string): Promise<{ message: string }> {
    await this.ensureOwner(userId, restaurantId);
    await this.ensureMenuItemBelongs(restaurantId, itemId);

    await this.prisma.menuItem.delete({ where: { id: itemId } });
    return { message: 'Menu item deleted' };
  }

  private async ensureOwner(userId: string, restaurantId: string): Promise<void> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    if (restaurant.ownerId !== userId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
  }

  private async ensureMenuItemBelongs(restaurantId: string, itemId: string): Promise<void> {
    const item = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!item || item.restaurantId !== restaurantId) {
      throw new NotFoundException('Menu item not found');
    }
  }

  private async ensureExists(restaurantId: string): Promise<void> {
    const count = await this.prisma.restaurant.count({ where: { id: restaurantId } });
    if (count === 0) {
      throw new NotFoundException('Restaurant not found');
    }
  }

  private async searchByGeo(
    lat: number,
    lng: number,
    radiusKm: number,
    cuisine: string | undefined,
    page: number,
    skip: number,
  ): Promise<ListResult<RestaurantView>> {
    const rows = await this.prisma.$queryRaw<Array<Restaurant & { distancekm: number }>>`
      SELECT * FROM (
        SELECT *, (
          ${EARTH_RADIUS_KM} * acos(
            LEAST(1.0, cos(radians(${lat})) * cos(radians("lat")) * cos(radians("lng") - radians(${lng}))
            + sin(radians(${lat})) * sin(radians("lat")))
          )
        ) AS distancekm
        FROM "restaurants"
        WHERE "isActive" = true
          AND (${cuisine ?? null}::text IS NULL OR "cuisineType" = ${cuisine ?? null})
      ) AS ranked
      WHERE distancekm <= ${radiusKm}
      ORDER BY distancekm ASC
      OFFSET ${skip} LIMIT ${PAGE_SIZE}
    `;

    const data = await Promise.all(
      rows.map(async (row) => {
        const { distancekm, ...restaurant } = row;
        return this.toRestaurantView(restaurant, distancekm);
      }),
    );

    return { data, meta: { page, total: data.length } };
  }

  private async toRestaurantView(restaurant: Restaurant, distanceKm?: number): Promise<RestaurantView> {
    const aggregate = await this.prisma.review.aggregate({
      where: { restaurantId: restaurant.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      id: restaurant.id,
      name: restaurant.name,
      type: restaurant.cuisineType ?? '',
      address: restaurant.address ?? '',
      city: restaurant.city ?? '',
      district: restaurant.district ?? undefined,
      lat: restaurant.lat,
      lng: restaurant.lng,
      rating: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : 0,
      reviewCount: aggregate._count.rating,
      priceRange: this.toPriceRange(restaurant.priceRange),
      imageUrl: restaurant.coverUrl ?? restaurant.avatar ?? undefined,
      isOpen: restaurant.isOpen,
      distance: distanceKm !== undefined ? Math.round(distanceKm * 10) / 10 : undefined,
      specialties: restaurant.specialties,
      phone: restaurant.phone ?? undefined,
      hoursLabel: restaurant.hoursLabel ?? undefined,
      isVerified: restaurant.isVerified,
      ownerId: restaurant.ownerId,
    };
  }

  private toMenuItemView(item: MenuItem): MenuItemView {
    return {
      id: item.id,
      name: item.name,
      nameEN: item.nameEN ?? undefined,
      category: item.category ?? '',
      description: item.description ?? undefined,
      priceXAF: item.priceXAF,
      imageUrl: item.imageUrl ?? undefined,
      isAvailable: item.isAvailable,
      allergens: item.allergens,
    };
  }

  private toPriceRange(value: number): 1 | 2 | 3 {
    if (value <= 1) return 1;
    if (value >= 3) return 3;
    return 2;
  }
}
