-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MARKETING', 'QUALITY');

-- CreateEnum
CREATE TYPE "ShopperSessionRevokeReason" AS ENUM ('SIGNED_OUT', 'SIGNED_OUT_EVERYWHERE');

-- CreateEnum
CREATE TYPE "PointsReason" AS ENUM ('PURCHASE_ACCRUAL', 'WALLET_SPENT', 'PACK_SCAN_AWARDED', 'COUPON_UNLOCKED');

-- CreateEnum
CREATE TYPE "LedgerUnit" AS ENUM ('POINTS', 'CENTS', 'STAMPS');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DIGITAL_COUPON', 'FREE_PRODUCT', 'DISCOUNT_VOUCHER', 'BUY_ONE_GET_ONE', 'COMPETITION_ENTRY', 'GIFT', 'EXCLUSIVE_EXPERIENCE', 'SAMPLE_PRODUCT', 'RECOGNITION_BADGE', 'CUSTOM_REWARD');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CouponFraudReason" AS ENUM ('ALREADY_REDEEMED', 'ALREADY_CANCELLED', 'EXPIRED', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "PackCodeStatus" AS ENUM ('UNSCANNED', 'SCANNED', 'VOID');

-- CreateEnum
CREATE TYPE "EarnRuleType" AS ENUM ('FLAT_PER_SCAN', 'PERCENT_OF_SPEND');

-- CreateEnum
CREATE TYPE "WalletSpendStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtp" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopperSession" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "ShopperSessionRevokeReason",

    CONSTRAINT "ShopperSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "firstName" TEXT,
    "suburb" TEXT,
    "consentGivenAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMembership" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "optedOutAt" TIMESTAMP(3),

    CONSTRAINT "BrandMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "brandMembershipId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "unit" "LedgerUnit" NOT NULL DEFAULT 'POINTS',
    "reason" "PointsReason" NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "couponName" TEXT,
    "maxCoupons" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rewardName" TEXT NOT NULL DEFAULT '',
    "rewardDescription" TEXT,
    "rewardType" "RewardType" NOT NULL DEFAULT 'DIGITAL_COUPON',
    "rewardValueRand" DECIMAL(10,2),
    "couponDescription" TEXT,
    "codePrefix" TEXT,
    "couponExpiryDate" TIMESTAMP(3),
    "retailers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetRand" DECIMAL(10,2),

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "brandMembershipId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedByUserId" TEXT,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponFraudEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "couponId" TEXT,
    "reason" "CouponFraudReason" NOT NULL,
    "attemptedByUserId" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponFraudEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackBatch" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackCode" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PackCodeStatus" NOT NULL DEFAULT 'UNSCANNED',
    "scannedAt" TIMESTAMP(3),
    "scannedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarnRule" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "EarnRuleType" NOT NULL DEFAULT 'FLAT_PER_SCAN',
    "unit" "LedgerUnit" NOT NULL DEFAULT 'POINTS',
    "amount" INTEGER NOT NULL,
    "basisPoints" INTEGER,
    "minSpendCents" INTEGER,
    "completesAt" INTEGER,
    "maxPerPersonPerDay" INTEGER,
    "maxScansPerPersonPerDay" INTEGER,
    "maxTotalAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarnRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSpend" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "brandMembershipId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WalletSpendStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "signingSecretEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseScan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "brandMembershipId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "externalTxnId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasSigned" BOOLEAN NOT NULL,

    CONSTRAINT "PurchaseScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_brandId_idx" ON "User"("brandId");

-- CreateIndex
CREATE INDEX "PhoneOtp_phoneHash_idx" ON "PhoneOtp"("phoneHash");

-- CreateIndex
CREATE INDEX "PhoneOtp_expiresAt_idx" ON "PhoneOtp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopperSession_tokenHash_key" ON "ShopperSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ShopperSession_personId_idx" ON "ShopperSession"("personId");

-- CreateIndex
CREATE INDEX "ShopperSession_expiresAt_idx" ON "ShopperSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Person_phoneHash_key" ON "Person"("phoneHash");

-- CreateIndex
CREATE INDEX "BrandMembership_brandId_idx" ON "BrandMembership"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMembership_brandId_personId_key" ON "BrandMembership"("brandId", "personId");

-- CreateIndex
CREATE INDEX "PointsTransaction_brandId_idx" ON "PointsTransaction"("brandId");

-- CreateIndex
CREATE INDEX "PointsTransaction_brandMembershipId_idx" ON "PointsTransaction"("brandMembershipId");

-- CreateIndex
CREATE INDEX "PointsTransaction_campaignId_idx" ON "PointsTransaction"("campaignId");

-- CreateIndex
CREATE INDEX "PointsTransaction_brandMembershipId_createdAt_idx" ON "PointsTransaction"("brandMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_campaignId_key" ON "Reward"("campaignId");

-- CreateIndex
CREATE INDEX "Reward_brandId_idx" ON "Reward"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_brandId_idx" ON "Coupon"("brandId");

-- CreateIndex
CREATE INDEX "Coupon_brandMembershipId_idx" ON "Coupon"("brandMembershipId");

-- CreateIndex
CREATE INDEX "Coupon_campaignId_idx" ON "Coupon"("campaignId");

-- CreateIndex
CREATE INDEX "CouponFraudEvent_brandId_idx" ON "CouponFraudEvent"("brandId");

-- CreateIndex
CREATE INDEX "CouponFraudEvent_couponId_idx" ON "CouponFraudEvent"("couponId");

-- CreateIndex
CREATE INDEX "PackBatch_brandId_idx" ON "PackBatch"("brandId");

-- CreateIndex
CREATE INDEX "PackBatch_campaignId_idx" ON "PackBatch"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "PackCode_code_key" ON "PackCode"("code");

-- CreateIndex
CREATE INDEX "PackCode_brandId_idx" ON "PackCode"("brandId");

-- CreateIndex
CREATE INDEX "PackCode_batchId_idx" ON "PackCode"("batchId");

-- CreateIndex
CREATE INDEX "PackCode_campaignId_idx" ON "PackCode"("campaignId");

-- CreateIndex
CREATE INDEX "PackCode_batchId_status_idx" ON "PackCode"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EarnRule_campaignId_key" ON "EarnRule"("campaignId");

-- CreateIndex
CREATE INDEX "EarnRule_brandId_idx" ON "EarnRule"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSpend_code_key" ON "WalletSpend"("code");

-- CreateIndex
CREATE INDEX "WalletSpend_brandId_idx" ON "WalletSpend"("brandId");

-- CreateIndex
CREATE INDEX "WalletSpend_brandMembershipId_idx" ON "WalletSpend"("brandMembershipId");

-- CreateIndex
CREATE INDEX "WalletSpend_brandMembershipId_status_idx" ON "WalletSpend"("brandMembershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE INDEX "Store_brandId_idx" ON "Store"("brandId");

-- CreateIndex
CREATE INDEX "PurchaseScan_brandId_idx" ON "PurchaseScan"("brandId");

-- CreateIndex
CREATE INDEX "PurchaseScan_brandMembershipId_idx" ON "PurchaseScan"("brandMembershipId");

-- CreateIndex
CREATE INDEX "PurchaseScan_campaignId_idx" ON "PurchaseScan"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseScan_storeId_externalTxnId_key" ON "PurchaseScan"("storeId", "externalTxnId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopperSession" ADD CONSTRAINT "ShopperSession_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_brandMembershipId_fkey" FOREIGN KEY ("brandMembershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_brandMembershipId_fkey" FOREIGN KEY ("brandMembershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_statusChangedByUserId_fkey" FOREIGN KEY ("statusChangedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponFraudEvent" ADD CONSTRAINT "CouponFraudEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponFraudEvent" ADD CONSTRAINT "CouponFraudEvent_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponFraudEvent" ADD CONSTRAINT "CouponFraudEvent_attemptedByUserId_fkey" FOREIGN KEY ("attemptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackBatch" ADD CONSTRAINT "PackBatch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackBatch" ADD CONSTRAINT "PackBatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackBatch" ADD CONSTRAINT "PackBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackCode" ADD CONSTRAINT "PackCode_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackCode" ADD CONSTRAINT "PackCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackCode" ADD CONSTRAINT "PackCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PackBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackCode" ADD CONSTRAINT "PackCode_scannedByMembershipId_fkey" FOREIGN KEY ("scannedByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnRule" ADD CONSTRAINT "EarnRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnRule" ADD CONSTRAINT "EarnRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSpend" ADD CONSTRAINT "WalletSpend_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSpend" ADD CONSTRAINT "WalletSpend_brandMembershipId_fkey" FOREIGN KEY ("brandMembershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSpend" ADD CONSTRAINT "WalletSpend_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseScan" ADD CONSTRAINT "PurchaseScan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseScan" ADD CONSTRAINT "PurchaseScan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseScan" ADD CONSTRAINT "PurchaseScan_brandMembershipId_fkey" FOREIGN KEY ("brandMembershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseScan" ADD CONSTRAINT "PurchaseScan_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
