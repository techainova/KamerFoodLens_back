-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "acceptsDelivery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "acceptsReservations" BOOLEAN NOT NULL DEFAULT true;
