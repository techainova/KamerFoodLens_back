-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "allergens" TEXT[],
ADD COLUMN     "nameEN" TEXT;

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "city" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "hoursLabel" TEXT,
ADD COLUMN     "isOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceRange" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "specialties" TEXT[];
