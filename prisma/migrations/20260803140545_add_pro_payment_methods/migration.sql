-- AlterTable
ALTER TABLE "pro_profiles" ADD COLUMN     "acceptsCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "acceptsMtn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsOrange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mtnPhone" TEXT,
ADD COLUMN     "orangePhone" TEXT;
