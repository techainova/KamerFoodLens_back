-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "availableDays" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[];
