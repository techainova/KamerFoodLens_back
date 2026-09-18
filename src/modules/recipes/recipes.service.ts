import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Prisma, Recipe as PrismaRecipe } from '@prisma/client';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanResult, ScanResultDocument } from '../scan/schemas/scan-result.schema';
import { SearchRecipesDto } from './dto/search-recipes.dto';

type RecipeWithRelations = Prisma.RecipeGetPayload<{ include: { ingredients: true; steps: true } }>;

export interface RecipeIngredientView {
  id: string;
  name: string;
  nameEN?: string;
  quantity: string;
  unit?: string;
}

export interface RecipeStepView {
  id: string;
  order: number;
  title?: string;
  description: string;
  durationMin?: number;
  imageUrl?: string;
}

export interface RecipeView {
  id: string;
  name: string;
  nameEN?: string;
  region: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration: number;
  servings: number;
  difficulty: PrismaRecipe['difficulty'];
  calories?: number;
  rating: number;
  ratingCount: number;
  spiceLevel: number;
  cookType: string;
  tags: string[];
  ingredients: RecipeIngredientView[];
  steps: RecipeStepView[];
}

export interface TrendingDishView {
  rank: number;
  dishId: string;
  name: string;
  nameEN?: string;
  scansWeek: number;
  region: string;
  imageUrl?: string;
}

const RECIPE_INCLUDE = {
  ingredients: { orderBy: { order: Prisma.SortOrder.asc } },
  steps: { orderBy: { order: Prisma.SortOrder.asc } },
} as const;

const POPULAR_LIMIT = 20;
const SIMILAR_LIMIT = 6;
const TRENDING_LIMIT = 10;
const TRENDING_WINDOW_DAYS = 7;

@Injectable()
export class RecipesService {
  public constructor(
    private readonly prisma: PrismaService,
    @InjectModel(ScanResult.name) private readonly scanResultModel: Model<ScanResultDocument>,
  ) {}

  public async search(dto: SearchRecipesDto): Promise<RecipeView[]> {
    const where: Prisma.RecipeWhereInput = {};

    if (dto.q) {
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { nameEN: { contains: dto.q, mode: 'insensitive' } },
        { tags: { has: dto.q.toLowerCase() } },
      ];
    }

    if (dto.region) {
      where.region = { equals: dto.region, mode: 'insensitive' };
    }

    const recipes = await this.prisma.recipe.findMany({
      where,
      include: RECIPE_INCLUDE,
      orderBy: { rating: 'desc' },
    });

    return recipes.map((recipe) => this.toRecipeView(recipe));
  }

  public async getPopular(): Promise<RecipeView[]> {
    const recipes = await this.prisma.recipe.findMany({
      include: RECIPE_INCLUDE,
      orderBy: [{ rating: 'desc' }, { ratingCount: 'desc' }],
      take: POPULAR_LIMIT,
    });

    return recipes.map((recipe) => this.toRecipeView(recipe));
  }

  public async getDetail(recipeId: string): Promise<RecipeView> {
    // Accepte l'UUID Prisma classique OU le slug partagé avec le corpus du
    // Scanner (ex. "ndole", "jollof-ghana") — voir dish-matcher.ts (kfl_back).
    const recipe = await this.prisma.recipe.findFirst({
      where: { OR: [{ id: recipeId }, { slug: recipeId }] },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return this.toRecipeView(recipe);
  }

  public async getSimilar(recipeId: string): Promise<RecipeView[]> {
    const recipe = await this.prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const recipes = await this.prisma.recipe.findMany({
      where: {
        id: { not: recipeId },
        OR: [{ region: recipe.region }, { tags: { hasSome: recipe.tags } }],
      },
      include: RECIPE_INCLUDE,
      orderBy: { rating: 'desc' },
      take: SIMILAR_LIMIT,
    });

    return recipes.map((r) => this.toRecipeView(r));
  }

  public async searchByIngredients(ingredients: string[]): Promise<RecipeView[]> {
    const normalized = ingredients.map((ingredient) => ingredient.trim().toLowerCase()).filter(Boolean);
    if (normalized.length === 0) {
      return [];
    }

    const recipes = await this.prisma.recipe.findMany({
      where: {
        ingredients: {
          some: {
            OR: normalized.map((name) => ({ name: { contains: name, mode: Prisma.QueryMode.insensitive } })),
          },
        },
      },
      include: RECIPE_INCLUDE,
    });

    const scored = recipes.map((recipe) => {
      const matchCount = recipe.ingredients.filter((ingredient) =>
        normalized.some((name) => ingredient.name.toLowerCase().includes(name)),
      ).length;
      return { recipe, matchCount };
    });

    scored.sort((a, b) => b.matchCount - a.matchCount);

    return scored.map(({ recipe }) => this.toRecipeView(recipe));
  }

  public async getTrendingDishes(): Promise<TrendingDishView[]> {
    const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const aggregation = await this.scanResultModel
      .aggregate<{ _id: string; dishName: string; imageUrl?: string; count: number }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$dishId',
            dishName: { $first: '$dishName' },
            imageUrl: { $first: '$imageUrl' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: TRENDING_LIMIT },
      ])
      .exec();

    return aggregation.map((entry, index) => ({
      rank: index + 1,
      dishId: entry._id,
      name: entry.dishName,
      nameEN: entry.dishName,
      scansWeek: entry.count,
      region: '',
      imageUrl: entry.imageUrl,
    }));
  }

  private toRecipeView(recipe: RecipeWithRelations): RecipeView {
    return {
      id: recipe.id,
      name: recipe.name,
      nameEN: recipe.nameEN ?? undefined,
      region: recipe.region,
      description: recipe.description ?? undefined,
      imageUrl: recipe.imageUrl ?? undefined,
      videoUrl: recipe.videoUrl ?? undefined,
      duration: recipe.duration,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      calories: recipe.calories ?? undefined,
      rating: recipe.rating,
      ratingCount: recipe.ratingCount,
      spiceLevel: recipe.spiceLevel,
      cookType: recipe.cookType ?? '',
      tags: recipe.tags,
      ingredients: recipe.ingredients
        .sort((a, b) => a.order - b.order)
        .map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          nameEN: ingredient.nameEN ?? undefined,
          quantity: ingredient.quantity,
          unit: ingredient.unit ?? undefined,
        })),
      steps: recipe.steps
        .sort((a, b) => a.order - b.order)
        .map((step) => ({
          id: step.id,
          order: step.order,
          title: step.title ?? undefined,
          description: step.description,
          durationMin: step.durationMin ?? undefined,
          imageUrl: step.imageUrl ?? undefined,
        })),
    };
  }
}
