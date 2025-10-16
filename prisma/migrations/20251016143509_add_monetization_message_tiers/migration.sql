/*
  Warnings:

  - You are about to drop the column `messagePrice` on the `user_monetization_settings` table. All the data in the column will be lost.
  - Added the required column `sessionId` to the `content_charges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."content_charges" ADD COLUMN     "sessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."user_monetization_settings" DROP COLUMN "messagePrice";

-- CreateTable
CREATE TABLE "public"."chat_time_tiers" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_time_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chat_sessions" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_time_tiers_settingsId_idx" ON "public"."chat_time_tiers"("settingsId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_time_tiers_settingsId_durationMinutes_key" ON "public"."chat_time_tiers"("settingsId", "durationMinutes");

-- CreateIndex
CREATE INDEX "chat_sessions_buyerId_isActive_idx" ON "public"."chat_sessions"("buyerId", "isActive");

-- CreateIndex
CREATE INDEX "chat_sessions_sellerId_isActive_idx" ON "public"."chat_sessions"("sellerId", "isActive");

-- CreateIndex
CREATE INDEX "chat_sessions_buyerId_sellerId_isActive_idx" ON "public"."chat_sessions"("buyerId", "sellerId", "isActive");

-- CreateIndex
CREATE INDEX "content_charges_sessionId_idx" ON "public"."content_charges"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."chat_time_tiers" ADD CONSTRAINT "chat_time_tiers_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "public"."user_monetization_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_charges" ADD CONSTRAINT "content_charges_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
