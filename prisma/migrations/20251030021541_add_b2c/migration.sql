-- CreateEnum
CREATE TYPE "public"."B2CTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."B2CCommandType" AS ENUM ('SalaryPayment', 'BusinessPayment', 'PromotionPayment');

-- CreateTable
CREATE TABLE "public"."b2c_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "originatorConversationId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "commandID" "public"."B2CCommandType" NOT NULL,
    "responseCode" TEXT NOT NULL,
    "responseDescription" TEXT NOT NULL,
    "status" "public"."B2CTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "resultCode" INTEGER,
    "resultDesc" TEXT,
    "transactionId" TEXT,
    "transactionReceipt" TEXT,
    "recipientRegistered" TEXT,
    "charges" DOUBLE PRECISION,
    "transactionCompletedDateTime" TEXT,
    "receiverPartyPublicName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2c_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transaction_status_queries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "conversationId" TEXT,
    "queryResponse" JSONB,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_status_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account_balance_queries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "workingBalance" DOUBLE PRECISION,
    "utilityBalance" DOUBLE PRECISION,
    "chargesPaidBalance" DOUBLE PRECISION,
    "unClearedBalance" DOUBLE PRECISION,
    "queryResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balance_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "b2c_transactions_conversationId_key" ON "public"."b2c_transactions"("conversationId");

-- CreateIndex
CREATE INDEX "b2c_transactions_userId_idx" ON "public"."b2c_transactions"("userId");

-- CreateIndex
CREATE INDEX "b2c_transactions_conversationId_idx" ON "public"."b2c_transactions"("conversationId");

-- CreateIndex
CREATE INDEX "b2c_transactions_status_idx" ON "public"."b2c_transactions"("status");

-- CreateIndex
CREATE INDEX "transaction_status_queries_userId_idx" ON "public"."transaction_status_queries"("userId");

-- CreateIndex
CREATE INDEX "transaction_status_queries_transactionId_idx" ON "public"."transaction_status_queries"("transactionId");

-- CreateIndex
CREATE INDEX "account_balance_queries_userId_idx" ON "public"."account_balance_queries"("userId");
