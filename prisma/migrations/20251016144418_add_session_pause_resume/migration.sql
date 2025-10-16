-- AlterTable
ALTER TABLE "public"."chat_sessions" ADD COLUMN     "isPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "resumedAt" TIMESTAMP(3),
ADD COLUMN     "usedMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0;
