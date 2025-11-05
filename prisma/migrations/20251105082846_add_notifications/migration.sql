-- CreateEnum
CREATE TYPE "public"."ServiceType" AS ENUM ('CHAT', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "public"."ServiceRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('SERVICE_REQUEST', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'REQUEST_EXPIRED', 'SESSION_STARTED', 'SESSION_ENDING', 'SESSION_ENDED', 'PAYMENT_RECEIVED', 'PAYMENT_PENDING');

-- CreateEnum
CREATE TYPE "public"."PendingBalanceStatus" AS ENUM ('LOCKED', 'RELEASED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."ServiceTransactionType" AS ENUM ('PAYMENT', 'EARNING', 'REFUND', 'LOCK', 'RELEASE');

-- CreateTable
CREATE TABLE "public"."service_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceType" "public"."ServiceType" NOT NULL,
    "duration" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "public"."ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "notificationType" "public"."NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_sessions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceType" "public"."ServiceType" NOT NULL,
    "duration" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "usedMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "connectionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pending_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "public"."PendingBalanceStatus" NOT NULL DEFAULT 'LOCKED',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,
    "sessionId" TEXT,
    "transactionType" "public"."ServiceTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_sessionId_key" ON "public"."service_requests"("sessionId");

-- CreateIndex
CREATE INDEX "service_requests_requesterId_status_idx" ON "public"."service_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "service_requests_providerId_status_idx" ON "public"."service_requests"("providerId", "status");

-- CreateIndex
CREATE INDEX "service_requests_status_createdAt_idx" ON "public"."service_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "service_notifications_userId_isRead_idx" ON "public"."service_notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "service_notifications_requestId_idx" ON "public"."service_notifications"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "service_sessions_requestId_key" ON "public"."service_sessions"("requestId");

-- CreateIndex
CREATE INDEX "service_sessions_requesterId_isActive_idx" ON "public"."service_sessions"("requesterId", "isActive");

-- CreateIndex
CREATE INDEX "service_sessions_providerId_isActive_idx" ON "public"."service_sessions"("providerId", "isActive");

-- CreateIndex
CREATE INDEX "service_sessions_isActive_serviceType_idx" ON "public"."service_sessions"("isActive", "serviceType");

-- CreateIndex
CREATE INDEX "pending_balances_userId_status_idx" ON "public"."pending_balances"("userId", "status");

-- CreateIndex
CREATE INDEX "pending_balances_sourceType_sourceId_idx" ON "public"."pending_balances"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "pending_balances_status_createdAt_idx" ON "public"."pending_balances"("status", "createdAt");

-- CreateIndex
CREATE INDEX "service_transactions_userId_transactionType_idx" ON "public"."service_transactions"("userId", "transactionType");

-- CreateIndex
CREATE INDEX "service_transactions_requestId_idx" ON "public"."service_transactions"("requestId");

-- CreateIndex
CREATE INDEX "service_transactions_sessionId_idx" ON "public"."service_transactions"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."service_notifications" ADD CONSTRAINT "service_notifications_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_sessions" ADD CONSTRAINT "service_sessions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
