-- CreateTable
CREATE TABLE "public"."user_monetization_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "messagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voiceNotePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monetizeVoiceNotes" BOOLEAN NOT NULL DEFAULT false,
    "monetizeImages" BOOLEAN NOT NULL DEFAULT false,
    "monetizeVideos" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_monetization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_charges" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "contentType" "public"."MessageType" NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_monetization_settings_userId_key" ON "public"."user_monetization_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "content_charges_messageId_key" ON "public"."content_charges"("messageId");

-- CreateIndex
CREATE INDEX "content_charges_recipientId_isPaid_idx" ON "public"."content_charges"("recipientId", "isPaid");

-- CreateIndex
CREATE INDEX "content_charges_senderId_isPaid_idx" ON "public"."content_charges"("senderId", "isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "user_balances_userId_key" ON "public"."user_balances"("userId");

-- AddForeignKey
ALTER TABLE "public"."content_charges" ADD CONSTRAINT "content_charges_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
