/*
  Warnings:

  - Added the required column `userId` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."payments" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "public"."payments"("userId");
