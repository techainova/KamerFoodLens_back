import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Badge, FavoriteItem, FavoriteType, Notification, NotificationType, User } from '@prisma/client';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { S3UploadService } from '../../common/services/s3-upload.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { JournalEntry, JournalEntryDocument } from './schemas/journal-entry.schema';
import { ScanResult, ScanResultDocument } from '../scan/schemas/scan-result.schema';
import { Post, PostDocument } from '../community/schemas/post.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { AddJournalDto } from './dto/add-journal.dto';
import { UploadAvatarDto } from './dto/upload-avatar.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

export interface BadgeWithStatus extends Badge {
  isEarned: boolean;
  earnedAt: Date | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

export interface JournalEntryView {
  id: string;
  dishName: string;
  dishId?: string;
  imageUrl?: string;
  nutritionFacts?: Record<string, number>;
  mealType: string;
  date: string;
  note?: string;
}

export interface EnrichedFavorite {
  id: string;
  type: FavoriteType;
  itemId: string;
  name: string;
  imageUrl: string | null;
  region: string | null;
  rating: number | null;
  difficulty: string | null;
  durationMin: number | null;
  savedAt: string;
}

export type UserProfile = Omit<User, 'passwordHash' | 'googleId'> & {
  xpPoints: number;
  level: number;
};

export interface UserStats {
  scansCount: number;
  recipesCount: number;
  reviewsCount: number;
  postsCount: number;
}

export interface MyReviewView {
  id: string;
  restaurantId: string;
  restaurantName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

@Injectable()
export class UsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly s3UploadService: S3UploadService,
    @InjectModel(JournalEntry.name) private readonly journalModel: Model<JournalEntryDocument>,
    @InjectModel(ScanResult.name) private readonly scanResultModel: Model<ScanResultDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // Désactivation plutôt que suppression en cascade : les commandes/avis de
  // l'utilisateur restent des enregistrements légitimes pour l'autre partie
  // (restaurant, organisateur...). isActive=false bloque définitivement la
  // connexion (voir AuthService.login/refresh), ce qui est le seul effet
  // observable attendu par l'utilisateur qui "supprime son compte".
  public async deleteAccount(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await this.redis.del(`refresh_token:${userId}`);
    return { message: 'Account deactivated' };
  }

  public async getMe(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserProfile(user);
  }

  public async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.toUserProfile(user);
  }

  public async uploadAvatar(userId: string, dto: UploadAvatarDto): Promise<UserProfile> {
    const avatarUrl = await this.s3UploadService.uploadBase64Image(
      dto.imageBase64,
      dto.mimeType ?? 'image/jpeg',
      'avatars',
    );
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatar: avatarUrl } });
    return this.toUserProfile(user);
  }

  public async getMyStats(userId: string): Promise<UserStats> {
    const [scansCount, recipesCount, reviewsCount, postsCount] = await Promise.all([
      this.scanResultModel.countDocuments({ userId }).exec(),
      this.prisma.favoriteItem.count({ where: { userId, type: 'recipe' } }),
      this.prisma.review.count({ where: { userId } }),
      this.postModel.countDocuments({ userId }).exec(),
    ]);
    return { scansCount, recipesCount, reviewsCount, postsCount };
  }

  public async getMyReviews(userId: string): Promise<MyReviewView[]> {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      include: { restaurant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map((r) => ({
      id: r.id,
      restaurantId: r.restaurantId,
      restaurantName: r.restaurant.name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  public async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto): Promise<{ message: string }> {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform },
      create: { userId, token: dto.token, platform: dto.platform },
    });
    return { message: 'Device token registered' };
  }

  public async unregisterDeviceToken(userId: string, token: string): Promise<{ message: string }> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { message: 'Device token removed' };
  }

  private async toUserProfile(user: User): Promise<UserProfile> {
    const { passwordHash: _passwordHash, googleId: _googleId, ...publicFields } = user;
    const userXp = await this.prisma.userXP.findUnique({ where: { userId: user.id } });

    return {
      ...publicFields,
      xpPoints: userXp?.points ?? 0,
      level: userXp?.level ?? 1,
    };
  }

  public async getBadges(userId: string): Promise<BadgeWithStatus[]> {
    const [badges, userBadges] = await Promise.all([
      this.prisma.badge.findMany(),
      this.prisma.userBadge.findMany({ where: { userId } }),
    ]);

    const earnedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub.earnedAt]));

    return badges.map((badge) => ({
      ...badge,
      isEarned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) ?? null,
    }));
  }

  public async getNotifications(
    userId: string,
    page: number,
    type?: NotificationType,
  ): Promise<PaginatedResult<Notification> & { unreadCount: number }> {
    const skip = (page - 1) * PAGE_SIZE;
    const where = type ? { userId, type } : { userId };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, total, page, unreadCount };
  }

  public async markNotificationRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  }

  public async markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: result.count };
  }

  public async deleteNotification(userId: string, notificationId: string): Promise<{ message: string }> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({ where: { id: notificationId } });
    return { message: 'Notification deleted' };
  }

  public async getFavorites(userId: string): Promise<EnrichedFavorite[]> {
    const favorites = await this.prisma.favoriteItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return Promise.all(favorites.map((favorite) => this.toEnrichedFavorite(favorite)));
  }

  public async addFavorite(userId: string, dto: AddFavoriteDto): Promise<EnrichedFavorite> {
    const favorite = await this.prisma.favoriteItem.upsert({
      where: { userId_type_itemId: { userId, type: dto.type, itemId: dto.itemId } },
      update: {},
      create: { userId, type: dto.type, itemId: dto.itemId },
    });
    return this.toEnrichedFavorite(favorite);
  }

  private async toEnrichedFavorite(favorite: FavoriteItem): Promise<EnrichedFavorite> {
    const base = {
      id: favorite.id,
      type: favorite.type,
      itemId: favorite.itemId,
      savedAt: favorite.createdAt.toISOString(),
    };

    if (favorite.type === 'recipe' || favorite.type === 'dish') {
      const recipe = await this.prisma.recipe.findUnique({ where: { id: favorite.itemId } });
      if (recipe) {
        return {
          ...base,
          name: recipe.name,
          imageUrl: recipe.imageUrl,
          region: recipe.region,
          rating: recipe.rating,
          difficulty: recipe.difficulty,
          durationMin: recipe.duration,
        };
      }

      return {
        ...base,
        name: this.formatItemIdAsName(favorite.itemId),
        imageUrl: null,
        region: null,
        rating: null,
        difficulty: null,
        durationMin: null,
      };
    }

    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: favorite.itemId } });
    if (!restaurant) {
      return {
        ...base,
        name: this.formatItemIdAsName(favorite.itemId),
        imageUrl: null,
        region: null,
        rating: null,
        difficulty: null,
        durationMin: null,
      };
    }

    const aggregate = await this.prisma.review.aggregate({
      where: { restaurantId: restaurant.id },
      _avg: { rating: true },
    });

    return {
      ...base,
      name: restaurant.name,
      imageUrl: restaurant.coverUrl ?? restaurant.avatar,
      region: restaurant.city ?? restaurant.address,
      rating: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : null,
      difficulty: null,
      durationMin: null,
    };
  }

  private formatItemIdAsName(itemId: string): string {
    return itemId
      .split(/[-_]/)
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  public async removeFavorite(userId: string, favoriteId: string): Promise<{ message: string }> {
    const favorite = await this.prisma.favoriteItem.findUnique({ where: { id: favoriteId } });

    if (!favorite || favorite.userId !== userId) {
      throw new ForbiddenException('You cannot remove this favorite');
    }

    await this.prisma.favoriteItem.delete({ where: { id: favoriteId } });
    return { message: 'Favorite removed' };
  }

  public async getJournal(userId: string, date?: string): Promise<JournalEntryView[]> {
    const filter: Record<string, unknown> = { userId };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const entries = await this.journalModel.find(filter).sort({ date: -1 }).exec();
    return entries.map((entry) => this.toJournalEntryView(entry));
  }

  public async addJournalEntry(userId: string, dto: AddJournalDto): Promise<JournalEntryView> {
    const entry = await this.journalModel.create({
      userId,
      dishName: dto.dishName,
      dishId: dto.dishId,
      imageUrl: dto.imageUrl,
      nutritionFacts: dto.nutritionFacts,
      mealType: dto.mealType,
      date: new Date(dto.date),
      note: dto.note,
    });
    return this.toJournalEntryView(entry);
  }

  public async removeJournalEntry(userId: string, entryId: string): Promise<{ message: string }> {
    const entry = await this.journalModel.findById(entryId).exec();

    if (!entry || entry.userId !== userId) {
      throw new ForbiddenException('You cannot remove this journal entry');
    }

    await this.journalModel.findByIdAndDelete(entryId).exec();
    return { message: 'Journal entry removed' };
  }

  private toJournalEntryView(entry: JournalEntryDocument): JournalEntryView {
    return {
      id: String(entry._id),
      dishName: entry.dishName,
      dishId: entry.dishId,
      imageUrl: entry.imageUrl,
      nutritionFacts: entry.nutritionFacts,
      mealType: entry.mealType,
      date: entry.date.toISOString(),
      note: entry.note,
    };
  }
}
