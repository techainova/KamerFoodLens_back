-- AlterTable
ALTER TABLE "forum_replies" ADD COLUMN     "likes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "forum_threads" ADD COLUMN     "likes" TEXT[] DEFAULT ARRAY[]::TEXT[];
