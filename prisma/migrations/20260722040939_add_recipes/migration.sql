-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEN" TEXT,
    "region" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "duration" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'easy',
    "calories" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "spiceLevel" INTEGER NOT NULL DEFAULT 1,
    "cookType" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEN" TEXT,
    "quantity" TEXT NOT NULL,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "durationMin" INTEGER,
    "imageUrl" TEXT,

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipes_region_idx" ON "recipes"("region");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipeId_idx" ON "recipe_ingredients"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_steps_recipeId_idx" ON "recipe_steps"("recipeId");

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
