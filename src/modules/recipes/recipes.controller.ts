import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SearchRecipesDto } from './dto/search-recipes.dto';
import { SearchByIngredientsDto } from './dto/search-by-ingredients.dto';
import { RecipesService, RecipeView, TrendingDishView } from './recipes.service';

@ApiTags('recipes')
@Controller()
export class RecipesController {
  public constructor(private readonly recipesService: RecipesService) {}

  @Public()
  @Get('dishes/trending')
  @ApiOperation({ summary: 'Get the most-scanned dishes over the last 7 days' })
  @ApiResponse({ status: 200, description: 'Trending dishes' })
  public async getTrendingDishes(): Promise<TrendingDishView[]> {
    return this.recipesService.getTrendingDishes();
  }

  @Public()
  @Get('recipes/popular')
  @ApiOperation({ summary: 'Get the highest-rated recipes' })
  @ApiResponse({ status: 200, description: 'Popular recipes' })
  public async getPopular(): Promise<RecipeView[]> {
    return this.recipesService.getPopular();
  }

  @Public()
  @Post('recipes/by-ingredients')
  @ApiOperation({ summary: 'Find recipes matching a list of available ingredients' })
  @ApiResponse({ status: 201, description: 'Matching recipes, best match first' })
  public async searchByIngredients(@Body() dto: SearchByIngredientsDto): Promise<RecipeView[]> {
    return this.recipesService.searchByIngredients(dto.ingredients);
  }

  @Public()
  @Get('recipes/:id/similar')
  @ApiOperation({ summary: 'Get recipes similar to a given recipe' })
  @ApiResponse({ status: 200, description: 'Similar recipes' })
  public async getSimilar(@Param('id') id: string): Promise<RecipeView[]> {
    return this.recipesService.getSimilar(id);
  }

  @Public()
  @Get('recipes/:id')
  @ApiOperation({ summary: 'Get recipe details with ingredients and steps' })
  @ApiResponse({ status: 200, description: 'Recipe details' })
  public async getDetail(@Param('id') id: string): Promise<RecipeView> {
    return this.recipesService.getDetail(id);
  }

  @Public()
  @Get('recipes')
  @ApiOperation({ summary: 'Search recipes by name, tag, or region' })
  @ApiResponse({ status: 200, description: 'Matching recipes' })
  public async search(@Query() dto: SearchRecipesDto): Promise<RecipeView[]> {
    return this.recipesService.search(dto);
  }
}
