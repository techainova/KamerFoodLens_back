-- CreateTable
CREATE TABLE "restaurant_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restaurant_follows_restaurantId_idx" ON "restaurant_follows"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_follows_userId_restaurantId_key" ON "restaurant_follows"("userId", "restaurantId");

-- AddForeignKey
ALTER TABLE "restaurant_follows" ADD CONSTRAINT "restaurant_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_follows" ADD CONSTRAINT "restaurant_follows_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
