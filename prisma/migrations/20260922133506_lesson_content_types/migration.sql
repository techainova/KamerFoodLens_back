-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('video', 'document', 'text');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "textContent" TEXT,
ADD COLUMN     "textImageUrl" TEXT,
ADD COLUMN     "type" "LessonType" NOT NULL DEFAULT 'video';
