-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'wallet',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';
