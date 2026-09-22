-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN     "checkedInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pro_messages" ADD COLUMN     "senderId" TEXT;

-- AlterTable
ALTER TABLE "restaurant_follows" ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "pro_messages" ADD CONSTRAINT "pro_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
