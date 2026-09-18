-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");
