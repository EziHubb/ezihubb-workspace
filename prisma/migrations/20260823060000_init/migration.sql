-- Squashed baseline. Replaces the 32 migrations dated 2026-08-11 → 2026-08-23,
-- which were collapsed when production was reset: nothing was running on the
-- old history any more, so keeping 31 incremental steps only preserved the
-- order in which a schema nobody had shipped yet was discovered.
--
-- Generated from prisma/schema.prisma with
--   prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- so it is the schema itself, not a replay of how the schema was reached.
--
-- Any database created before 2026-08-23 cannot apply this file — it is an
-- empty-to-current script and every CREATE would collide. Those databases are
-- gone; if one turns up, restore it from a snapshot rather than migrating it.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('EMAIL', 'GOOGLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'PAYPAL', 'GIFT_CARD', 'MIXED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('SHOP_WIDE', 'SPECIFIC_LISTINGS');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "WhoMadeIt" AS ENUM ('I_DID', 'SHOP_MEMBER', 'ANOTHER_COMPANY');

-- CreateEnum
CREATE TYPE "HowItWasMade" AS ENUM ('MADE_TO_ORDER', 'HANDMADE', 'ASSEMBLED', 'ALTERED', 'CURATED_SET', 'NATURAL_MATERIAL');

-- CreateEnum
CREATE TYPE "RenewalType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProcessingProfileType" AS ENUM ('MADE_TO_ORDER', 'READY_TO_SHIP');

-- CreateEnum
CREATE TYPE "ShippingChargeType" AS ENUM ('FIXED', 'FREE');

-- CreateEnum
CREATE TYPE "ReturnPolicy" AS ENUM ('NO_RETURNS', 'RETURNS_ACCEPTED', 'EXCHANGES_ONLY');

-- CreateEnum
CREATE TYPE "DimensionUnit" AS ENUM ('CM', 'IN', 'MM', 'M');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SellerLedgerEntryType" AS ENUM ('SALE', 'TRANSACTION_FEE', 'PAYMENT_PROCESSING_FEE', 'REGULATORY_FEE', 'LISTING_FEE', 'ADJUSTMENT', 'VAT', 'DEPOSIT_FEE', 'SHARE_SAVE_REFUND', 'OFFSITE_ADS_FEE');

-- CreateEnum
CREATE TYPE "LinkClickKind" AS ENUM ('SHARE_SAVE', 'OFFSITE_AD');

-- CreateEnum
CREATE TYPE "TargetedOfferTrigger" AS ENUM ('INTERESTED_SHOPPER', 'THANK_YOU', 'ABANDONED_BASKET', 'FAVOURITED_ITEM');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'PINTEREST', 'X');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "BuyerOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'COUNTERED');

-- CreateEnum
CREATE TYPE "OffersScope" AS ENUM ('ALL_LISTINGS', 'SPECIFIC_LISTINGS');

-- CreateEnum
CREATE TYPE "DepositSchedule" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SellerPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "CategoryScope" AS ENUM ('PLATFORM', 'STORE');

-- CreateEnum
CREATE TYPE "StoreSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StoreSubscriptionCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('MOCKUP', 'PRINT_FILE');

-- CreateEnum
CREATE TYPE "PrintSide" AS ENUM ('FRONT', 'BACK', 'SLEEVE', 'HOOD');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "WhenMade" AS ENUM ('RECENTLY_MADE', 'VINTAGE');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'SPAM');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'SHOP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'CLEAN', 'FLAGGED', 'REJECTED', 'APPEALED', 'APPROVED');

-- CreateEnum
CREATE TYPE "TrackingStage" AS ENUM ('ORDER_CONFIRMED', 'SENT_TO_FULFILLMENT', 'IN_PRODUCTION', 'QUALITY_CHECK', 'PACKAGED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "FulfillmentProviderType" AS ENUM ('PRINTIFY', 'MERCHIZE');

-- CreateEnum
CREATE TYPE "StoreFulfillmentMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "FulfillmentConnectionStatus" AS ENUM ('ACTIVE', 'INVALID', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'IN_PRODUCTION', 'FULFILLED', 'FAILED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CampaignSeason" AS ENUM ('spring', 'summer', 'autumn', 'winter');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "provider" "Provider" NOT NULL DEFAULT 'EMAIL',
    "providerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cartEmailToken" TEXT,
    "cartEmailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpVerifiedAt" TIMESTAMP(3),
    "backupCodes" TEXT[],
    "isSeller" BOOLEAN NOT NULL DEFAULT false,
    "storeId" TEXT,
    "permissions" JSONB,
    "wishlistShareToken" TEXT,
    "wishlistIsPublic" BOOLEAN NOT NULL DEFAULT false,
    "wishlistName" VARCHAR(100),
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminNotes" TEXT,
    "adminTags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FcmToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "StoreStatus" NOT NULL DEFAULT 'PENDING',
    "country" VARCHAR(2),
    "adminNotes" TEXT,
    "rejectedReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "fulfillmentMode" "StoreFulfillmentMode" NOT NULL DEFAULT 'AUTOMATIC',
    "processesOnSaturday" BOOLEAN NOT NULL DEFAULT false,
    "processesOnSunday" BOOLEAN NOT NULL DEFAULT false,
    "deliveryUpgradesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "lastModeratedAt" TIMESTAMP(3),
    "strikeCount" INTEGER NOT NULL DEFAULT 0,
    "performanceScore" INTEGER,
    "scoreShipping" INTEGER,
    "scoreRefund" INTEGER,
    "scoreReview" INTEGER,
    "scoreResponse" INTEGER,
    "scoreBadge" TEXT,
    "scoreLastCalculatedAt" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stripeCustomerId" TEXT,
    "autoBillingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shareSaveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shareSaveJoinedAt" TIMESTAMP(3),
    "offsiteAdsOptedOut" BOOLEAN NOT NULL DEFAULT false,
    "offersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "offersScope" "OffersScope" NOT NULL DEFAULT 'ALL_LISTINGS',
    "offersMaxDiscountPercent" DECIMAL(5,2),
    "tagline" TEXT,
    "location" TEXT,
    "colorTheme" TEXT,
    "announcement" TEXT,
    "announcementUpdatedAt" TIMESTAMP(3),
    "aboutHeadline" TEXT,
    "aboutVideoUrl" TEXT,
    "aboutPhotoUrls" TEXT[],
    "ownerBio" TEXT,
    "featuredProductIds" TEXT[],
    "featuredLayout" TEXT,
    "socialLinks" JSONB,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFaq" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSubscription" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "StoreSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cycle" "StoreSubscriptionCycle" NOT NULL,
    "priceAtPurchase" DECIMAL(10,2) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "paymentProvider" TEXT DEFAULT 'MANUAL',
    "externalSubscriptionId" TEXT,
    "grantedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBankAccount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "depositSchedule" "DepositSchedule" NOT NULL DEFAULT 'WEEKLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBillingCard" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreBillingCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreTaxInfo" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sellerType" "SellerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "fullLegalName" TEXT NOT NULL,
    "taxpayerIdEncrypted" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "country" VARCHAR(2) NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "flatOther" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "postCode" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreTaxInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "sellerEarnings" DECIMAL(10,2) NOT NULL,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "carrier" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "sellerNotes" TEXT,
    "deliveryUpgradeRequested" BOOLEAN NOT NULL DEFAULT false,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "visitorId" TEXT,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayout" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SellerPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "processedById" TEXT,
    "paymentMethod" TEXT,
    "paymentDetail" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerLedgerEntry" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeOrderId" TEXT,
    "type" "SellerLedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreLinkClick" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "LinkClickKind" NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sharerId" TEXT,
    "productId" TEXT,
    "source" TEXT,
    "convertedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetedOfferCampaign" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "trigger" "TargetedOfferTrigger" NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "expiresAfterDays" INTEGER NOT NULL DEFAULT 3,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetedOfferCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSocialConnection" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "connectedAt" TIMESTAMP(3),

    CONSTRAINT "StoreSocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "platforms" "SocialPlatform"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "transactionFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.065,
    "paymentProcessingFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "paymentProcessingFixedFee" DECIMAL(10,2) NOT NULL DEFAULT 0.25,
    "listingFee" DECIMAL(10,2) NOT NULL DEFAULT 0.20,
    "regulatoryFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.0124,
    "regulatoryFeeCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vatOnFeesRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "offsiteAdsFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "platformName" TEXT NOT NULL DEFAULT 'EziHubb',
    "allowPublicRegistration" BOOLEAN NOT NULL DEFAULT false,
    "minPayoutAmount" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "payoutSchedule" TEXT NOT NULL DEFAULT 'monthly',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "plusMonthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "plusAnnualPrice" DECIMAL(10,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "scope" "CategoryScope" NOT NULL DEFAULT 'PLATFORM',
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "occasion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionProduct" (
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("collectionId","productId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "search_vector" tsvector,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    "isPersonalizable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "giftWrappingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "processingDays" INTEGER NOT NULL DEFAULT 3,
    "categoryId" TEXT NOT NULL,
    "customizationConfig" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "lastModeratedAt" TIMESTAMP(3),
    "storeId" TEXT,
    "titleCharCount" INTEGER,
    "primaryColors" TEXT[],
    "secondaryColors" TEXT[],
    "materials" TEXT[],
    "occasions" TEXT[],
    "holidayTags" TEXT[],
    "recipientTags" TEXT[],
    "styles" TEXT[],
    "sustainability" TEXT[],
    "width" DECIMAL(8,2),
    "height" DECIMAL(8,2),
    "dimensionUnit" "DimensionUnit",
    "domesticGlobalPricing" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "lowStockThreshold" INTEGER,
    "returnPolicy" "ReturnPolicy" NOT NULL DEFAULT 'NO_RETURNS',
    "processingProfileId" TEXT,
    "shippingProfileId" TEXT,
    "whoMadeIt" "WhoMadeIt",
    "howItWasMade" "HowItWasMade",
    "whenMade" "WhenMade",
    "toolsUsed" TEXT[],
    "productionPartnerIds" TEXT[],
    "hsCode" TEXT,
    "featuredRelatedIds" TEXT[],
    "shopSectionId" TEXT,
    "isAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "renewalType" "RenewalType" NOT NULL DEFAULT 'AUTOMATIC',
    "expiresAt" TIMESTAMP(3),
    "videoUrls" TEXT[],
    "thumbnailCropData" JSONB,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "price" DECIMAL(10,2),
    "quantity" INTEGER,
    "sku" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "ProductImageType" NOT NULL DEFAULT 'MOCKUP',
    "printSide" "PrintSide",

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVideo" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "posterUrl" TEXT,
    "posterSquareUrl" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalFile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayType" TEXT NOT NULL DEFAULT 'dropdown',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VariationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "colorHex" TEXT,
    "imageUrl" TEXT,
    "imageId" TEXT,
    "priceDelta" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VariationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationSettings" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "enableVariations" BOOLEAN NOT NULL DEFAULT false,
    "variesBy" TEXT[],
    "skuPrefix" TEXT,
    "photoGroupId" TEXT,

    CONSTRAINT "VariationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProcessingProfileType" NOT NULL DEFAULT 'MADE_TO_ORDER',
    "minDays" INTEGER NOT NULL DEFAULT 3,
    "maxDays" INTEGER NOT NULL DEFAULT 7,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeListings" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "originCountry" VARCHAR(2) NOT NULL DEFAULT 'VN',
    "originPostalCode" TEXT NOT NULL DEFAULT '',
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProfileMethod" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "carrierService" TEXT NOT NULL DEFAULT 'OTHER',
    "carrierName" TEXT,
    "chargeType" "ShippingChargeType" NOT NULL DEFAULT 'FIXED',
    "minDays" INTEGER NOT NULL,
    "maxDays" INTEGER NOT NULL,
    "price" DECIMAL(10,2),
    "extraItemPrice" DECIMAL(10,2),

    CONSTRAINT "ShippingProfileMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "templateId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "previewUrl" TEXT,
    "uploadedImages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CustomizationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "couponCode" TEXT,
    "discountAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "abandonedEmailSentAt" TIMESTAMP(3),

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "customizationData" JSONB,
    "previewUrl" TEXT,
    "searchTerm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "isDigital" BOOLEAN NOT NULL DEFAULT false,
    "shippingName" TEXT,
    "shippingPhone" TEXT,
    "shippingAddress" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingZip" TEXT,
    "shippingCountry" TEXT DEFAULT 'US',
    "shippingMethod" TEXT,
    "shippingCost" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "couponCode" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "carrier" TEXT,
    "trackerId" TEXT,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "giftMessage" VARCHAR(500),
    "giftReceipt" BOOLEAN NOT NULL DEFAULT false,
    "giftWrapping" BOOLEAN NOT NULL DEFAULT false,
    "giftFrom" VARCHAR(100),
    "note" TEXT,
    "privateNote" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "affiliateId" TEXT,
    "affiliateDiscountAmount" DECIMAL(10,2),
    "easypostShipmentId" TEXT,
    "labelUrl" TEXT,
    "labelPurchasedAt" TIMESTAMP(3),
    "labelCost" DECIMAL(10,2),
    "shippingRateId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "customizationData" JSONB,
    "previewUrl" TEXT,
    "searchTerm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "productSlug" TEXT,
    "productImageUrl" TEXT,
    "variantSnapshot" JSONB,
    "sku" TEXT,
    "storeId" TEXT,
    "storeOrderId" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalDownloadLog" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalDownloadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "giftCardCode" TEXT,
    "giftCardAmount" DECIMAL(10,2),
    "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "providerEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialValue" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "personalMessage" TEXT,
    "purchasedByUserId" TEXT,
    "stripePaymentIntentId" TEXT,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardUsage" (
    "id" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minOrderAmount" DECIMAL(10,2),
    "maxUses" INTEGER,
    "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "description" TEXT,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "scope" "PromotionScope" NOT NULL DEFAULT 'SHOP_WIDE',
    "country" TEXT,
    "termsAndConditions" TEXT,
    "targetUserId" TEXT,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionProduct" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionUsage" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleOffer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleOfferProduct" (
    "id" TEXT NOT NULL,
    "bundleOfferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "BundleOfferProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOfferListing" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreOfferListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerOffer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "offeredPrice" DECIMAL(10,2) NOT NULL,
    "counterPrice" DECIMAL(10,2),
    "status" "BuyerOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "sellerReply" TEXT,
    "sellerRepliedAt" TIMESTAMP(3),
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "askedByName" VARCHAR(100) NOT NULL,
    "askedByEmail" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "guestEmail" TEXT,
    "guestName" TEXT,
    "storeId" TEXT,
    "subject" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadByAdmin" INTEGER NOT NULL DEFAULT 0,
    "unreadByCustomer" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "attachmentUrls" TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'CLEAN',

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "buyerDiscountRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "cookieDays" INTEGER NOT NULL DEFAULT 30,
    "minPayoutAmount" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "lockDays" INTEGER NOT NULL DEFAULT 14,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "website" TEXT,
    "promoDescription" TEXT,
    "userId" TEXT,
    "referralCode" TEXT NOT NULL,
    "referralUrl" TEXT,
    "commissionRate" DECIMAL(5,4),
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adminNotes" TEXT,
    "rejectedReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "landingPage" TEXT NOT NULL,
    "referrer" TEXT,
    "convertedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentMethod" TEXT NOT NULL,
    "paymentDetail" TEXT NOT NULL,
    "adminNotes" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplateOverride" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isAutoTranslated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT,
    "contentHash" TEXT NOT NULL,
    "verdict" "ModerationStatus" NOT NULL,
    "severity" TEXT NOT NULL,
    "categories" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "sellerMessage" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'claude',
    "modelVersion" TEXT,
    "latencyMs" INTEGER,
    "cost" DECIMAL(10,6),
    "triggeredBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "moderateProductText" BOOLEAN NOT NULL DEFAULT true,
    "moderateStoreText" BOOLEAN NOT NULL DEFAULT true,
    "moderateReviews" BOOLEAN NOT NULL DEFAULT true,
    "moderateMessages" BOOLEAN NOT NULL DEFAULT true,
    "moderateImages" BOOLEAN NOT NULL DEFAULT true,
    "autoCriticalBlock" BOOLEAN NOT NULL DEFAULT true,
    "autoHighFlag" BOOLEAN NOT NULL DEFAULT true,
    "autoMediumFlag" BOOLEAN NOT NULL DEFAULT true,
    "autoLowWarn" BOOLEAN NOT NULL DEFAULT true,
    "cacheCleanResultDays" INTEGER NOT NULL DEFAULT 30,
    "strikeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "strikeLimitHigh" INTEGER NOT NULL DEFAULT 3,
    "strikeLimitCritical" INTEGER NOT NULL DEFAULT 1,
    "strikeWindowDays" INTEGER NOT NULL DEFAULT 30,
    "maxDailyApiCalls" INTEGER NOT NULL DEFAULT 500,
    "maxCostPerDayUsd" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applyTo" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrikeRecord" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrikeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTracking" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currentStage" "TrackingStage" NOT NULL DEFAULT 'ORDER_CONFIRMED',
    "carrierTrackingNumber" TEXT,
    "carrierName" TEXT,
    "estimatedDeliveryMin" TIMESTAMP(3),
    "estimatedDeliveryMax" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "rawCarrierData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "stage" "TrackingStage" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFulfillmentConnection" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" "FulfillmentProviderType" NOT NULL,
    "status" "FulfillmentConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalShopId" TEXT NOT NULL,
    "externalShopName" TEXT,
    "encryptedApiKey" TEXT NOT NULL,
    "webhookToken" TEXT,
    "externalWebhookIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "encryptedWebhookSecret" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreFulfillmentConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFulfillmentMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFulfillmentMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderFulfillment" (
    "id" TEXT NOT NULL,
    "storeOrderId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrderFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" "CampaignSeason",
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "bannerText" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT 'Shop now',
    "ctaHref" TEXT NOT NULL DEFAULT '/products',
    "countdownEnd" TIMESTAMP(3),
    "gradient" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "accentColor" TEXT NOT NULL DEFAULT '#000000',
    "bgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchTermDailyStat" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchTermDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearchTerm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearchTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatedTermFeedback" (
    "id" TEXT NOT NULL,
    "sourceTerm" TEXT NOT NULL,
    "relatedTerm" TEXT NOT NULL,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatedTermFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cartEmailToken_key" ON "User"("cartEmailToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_wishlistShareToken_key" ON "User"("wishlistShareToken");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FcmToken_token_key" ON "FcmToken"("token");

-- CreateIndex
CREATE INDEX "FcmToken_userId_idx" ON "FcmToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_token_key" ON "EmailVerification"("token");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "PasswordReset_email_idx" ON "PasswordReset"("email");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_ownerId_key" ON "Store"("ownerId");

-- CreateIndex
CREATE INDEX "Store_slug_idx" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_status_idx" ON "Store"("status");

-- CreateIndex
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");

-- CreateIndex
CREATE INDEX "StoreFaq_storeId_idx" ON "StoreFaq"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSubscription_storeId_key" ON "StoreSubscription"("storeId");

-- CreateIndex
CREATE INDEX "StoreSubscription_status_currentPeriodEnd_idx" ON "StoreSubscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "StoreSubscription_grantedByUserId_idx" ON "StoreSubscription"("grantedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBankAccount_storeId_key" ON "StoreBankAccount"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBillingCard_stripePaymentMethodId_key" ON "StoreBillingCard"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "StoreBillingCard_storeId_idx" ON "StoreBillingCard"("storeId");

-- CreateIndex
CREATE INDEX "StoreBillingCard_storeId_fingerprint_idx" ON "StoreBillingCard"("storeId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTaxInfo_storeId_key" ON "StoreTaxInfo"("storeId");

-- CreateIndex
CREATE INDEX "StoreFollow_storeId_idx" ON "StoreFollow"("storeId");

-- CreateIndex
CREATE INDEX "StoreFollow_userId_idx" ON "StoreFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFollow_userId_storeId_key" ON "StoreFollow"("userId", "storeId");

-- CreateIndex
CREATE INDEX "StoreOrder_orderId_idx" ON "StoreOrder"("orderId");

-- CreateIndex
CREATE INDEX "StoreOrder_storeId_idx" ON "StoreOrder"("storeId");

-- CreateIndex
CREATE INDEX "StoreOrder_status_idx" ON "StoreOrder"("status");

-- CreateIndex
CREATE INDEX "StoreOrder_visitorId_idx" ON "StoreOrder"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_orderId_storeId_key" ON "StoreOrder"("orderId", "storeId");

-- CreateIndex
CREATE INDEX "SellerPayout_storeId_idx" ON "SellerPayout"("storeId");

-- CreateIndex
CREATE INDEX "SellerPayout_status_idx" ON "SellerPayout"("status");

-- CreateIndex
CREATE INDEX "SellerPayout_period_idx" ON "SellerPayout"("period");

-- CreateIndex
CREATE INDEX "SellerLedgerEntry_storeId_payoutId_idx" ON "SellerLedgerEntry"("storeId", "payoutId");

-- CreateIndex
CREATE INDEX "SellerLedgerEntry_storeId_productId_type_idx" ON "SellerLedgerEntry"("storeId", "productId", "type");

-- CreateIndex
CREATE INDEX "StoreLinkClick_storeId_kind_createdAt_idx" ON "StoreLinkClick"("storeId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "StoreLinkClick_visitorId_createdAt_idx" ON "StoreLinkClick"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "TargetedOfferCampaign_isActive_idx" ON "TargetedOfferCampaign"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TargetedOfferCampaign_storeId_trigger_key" ON "TargetedOfferCampaign"("storeId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSocialConnection_storeId_platform_key" ON "StoreSocialConnection"("storeId", "platform");

-- CreateIndex
CREATE INDEX "SocialPost_storeId_createdAt_idx" ON "SocialPost"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_slug_idx" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_level_isVisible_idx" ON "Category"("level", "isVisible");

-- CreateIndex
CREATE INDEX "Category_storeId_idx" ON "Category"("storeId");

-- CreateIndex
CREATE INDEX "ProductCategory_productId_idx" ON "ProductCategory"("productId");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_slug_idx" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_isActive_idx" ON "Collection"("isActive");

-- CreateIndex
CREATE INDEX "CollectionProduct_collectionId_idx" ON "CollectionProduct"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionProduct_productId_idx" ON "CollectionProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Product_isActive_isFeatured_idx" ON "Product"("isActive", "isFeatured");

-- CreateIndex
CREATE INDEX "Product_isActive_soldCount_idx" ON "Product"("isActive", "soldCount");

-- CreateIndex
CREATE INDEX "Product_processingProfileId_idx" ON "Product"("processingProfileId");

-- CreateIndex
CREATE INDEX "Product_shippingProfileId_idx" ON "Product"("shippingProfileId");

-- CreateIndex
CREATE INDEX "Product_shopSectionId_idx" ON "Product"("shopSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_storeId_key" ON "Product"("slug", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_type_printSide_idx" ON "ProductImage"("productId", "type", "printSide");

-- CreateIndex
CREATE INDEX "ProductVideo_productId_idx" ON "ProductVideo"("productId");

-- CreateIndex
CREATE INDEX "DigitalFile_productId_idx" ON "DigitalFile"("productId");

-- CreateIndex
CREATE INDEX "VariationGroup_productId_idx" ON "VariationGroup"("productId");

-- CreateIndex
CREATE INDEX "VariationOption_groupId_idx" ON "VariationOption"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "VariationSettings_productId_key" ON "VariationSettings"("productId");

-- CreateIndex
CREATE INDEX "ProcessingProfile_storeId_idx" ON "ProcessingProfile"("storeId");

-- CreateIndex
CREATE INDEX "ShippingProfile_storeId_idx" ON "ShippingProfile"("storeId");

-- CreateIndex
CREATE INDEX "ShippingProfileMethod_profileId_idx" ON "ShippingProfileMethod"("profileId");

-- CreateIndex
CREATE INDEX "ShopSection_storeId_idx" ON "ShopSection"("storeId");

-- CreateIndex
CREATE INDEX "CustomizationDraft_userId_productId_idx" ON "CustomizationDraft"("userId", "productId");

-- CreateIndex
CREATE INDEX "CustomizationDraft_sessionId_idx" ON "CustomizationDraft"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sessionId_key" ON "Cart"("sessionId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_affiliateId_idx" ON "Order"("affiliateId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_storeOrderId_idx" ON "OrderItem"("storeOrderId");

-- CreateIndex
CREATE INDEX "OrderItem_storeId_idx" ON "OrderItem"("storeId");

-- CreateIndex
CREATE INDEX "DigitalDownloadLog_orderItemId_idx" ON "DigitalDownloadLog"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paypalOrderId_key" ON "Payment"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerEventId_key" ON "Payment"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_stripePaymentIntentId_key" ON "GiftCard"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "GiftCardUsage_giftCardId_idx" ON "GiftCardUsage"("giftCardId");

-- CreateIndex
CREATE INDEX "GiftCardUsage_orderId_idx" ON "GiftCardUsage"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_isActive_idx" ON "Promotion"("isActive");

-- CreateIndex
CREATE INDEX "Promotion_storeId_idx" ON "Promotion"("storeId");

-- CreateIndex
CREATE INDEX "Promotion_autoApply_idx" ON "Promotion"("autoApply");

-- CreateIndex
CREATE INDEX "Promotion_targetUserId_idx" ON "Promotion"("targetUserId");

-- CreateIndex
CREATE INDEX "PromotionProduct_productId_idx" ON "PromotionProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionProduct_promotionId_productId_key" ON "PromotionProduct"("promotionId", "productId");

-- CreateIndex
CREATE INDEX "PromotionUsage_promotionId_idx" ON "PromotionUsage"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionUsage_userId_idx" ON "PromotionUsage"("userId");

-- CreateIndex
CREATE INDEX "PromotionUsage_orderId_idx" ON "PromotionUsage"("orderId");

-- CreateIndex
CREATE INDEX "BundleOffer_storeId_idx" ON "BundleOffer"("storeId");

-- CreateIndex
CREATE INDEX "BundleOffer_isActive_idx" ON "BundleOffer"("isActive");

-- CreateIndex
CREATE INDEX "BundleOfferProduct_productId_idx" ON "BundleOfferProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleOfferProduct_bundleOfferId_productId_key" ON "BundleOfferProduct"("bundleOfferId", "productId");

-- CreateIndex
CREATE INDEX "StoreOfferListing_productId_idx" ON "StoreOfferListing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOfferListing_storeId_productId_key" ON "StoreOfferListing"("storeId", "productId");

-- CreateIndex
CREATE INDEX "BuyerOffer_storeId_status_idx" ON "BuyerOffer"("storeId", "status");

-- CreateIndex
CREATE INDEX "BuyerOffer_productId_idx" ON "BuyerOffer"("productId");

-- CreateIndex
CREATE INDEX "BuyerOffer_buyerId_idx" ON "BuyerOffer"("buyerId");

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_storeId_idx" ON "Review"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_orderId_key" ON "Review"("userId", "productId", "orderId");

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_isPublished_idx" ON "ProductQuestion"("productId", "isPublished");

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_createdAt_idx" ON "ProductQuestion"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AttributeValue_type_idx" ON "AttributeValue"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeValue_type_value_key" ON "AttributeValue"("type", "value");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_orderId_idx" ON "Conversation"("orderId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_storeId_idx" ON "Conversation"("storeId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_email_key" ON "AffiliateAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_userId_key" ON "AffiliateAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_referralCode_key" ON "AffiliateAccount"("referralCode");

-- CreateIndex
CREATE INDEX "AffiliateAccount_referralCode_idx" ON "AffiliateAccount"("referralCode");

-- CreateIndex
CREATE INDEX "AffiliateAccount_status_idx" ON "AffiliateAccount"("status");

-- CreateIndex
CREATE INDEX "AffiliateAccount_email_idx" ON "AffiliateAccount"("email");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_idx" ON "AffiliateClick"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateClick_visitorId_idx" ON "AffiliateClick"("visitorId");

-- CreateIndex
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_orderId_key" ON "AffiliateCommission"("orderId");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateId_idx" ON "AffiliateCommission"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");

-- CreateIndex
CREATE INDEX "AffiliateCommission_createdAt_idx" ON "AffiliateCommission"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_idx" ON "AffiliatePayout"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_status_idx" ON "AffiliatePayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateOverride_slug_key" ON "EmailTemplateOverride"("slug");

-- CreateIndex
CREATE INDEX "Translation_entityType_entityId_locale_idx" ON "Translation"("entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "Translation_locale_idx" ON "Translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_entityType_entityId_locale_field_key" ON "Translation"("entityType", "entityId", "locale", "field");

-- CreateIndex
CREATE INDEX "ModerationLog_entityType_entityId_idx" ON "ModerationLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ModerationLog_verdict_idx" ON "ModerationLog"("verdict");

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_contentHash_idx" ON "ModerationLog"("contentHash");

-- CreateIndex
CREATE INDEX "ModerationRule_ruleType_isActive_idx" ON "ModerationRule"("ruleType", "isActive");

-- CreateIndex
CREATE INDEX "StrikeRecord_storeId_createdAt_idx" ON "StrikeRecord"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTracking_orderId_key" ON "OrderTracking"("orderId");

-- CreateIndex
CREATE INDEX "TrackingEvent_trackingId_idx" ON "TrackingEvent"("trackingId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFulfillmentConnection_webhookToken_key" ON "StoreFulfillmentConnection"("webhookToken");

-- CreateIndex
CREATE INDEX "StoreFulfillmentConnection_storeId_idx" ON "StoreFulfillmentConnection"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFulfillmentConnection_storeId_provider_key" ON "StoreFulfillmentConnection"("storeId", "provider");

-- CreateIndex
CREATE INDEX "ProductFulfillmentMapping_connectionId_idx" ON "ProductFulfillmentMapping"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFulfillmentMapping_productId_variantId_key" ON "ProductFulfillmentMapping"("productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrderFulfillment_storeOrderId_connectionId_key" ON "StoreOrderFulfillment"("storeOrderId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrderFulfillment_connectionId_externalOrderId_key" ON "StoreOrderFulfillment"("connectionId", "externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_storeId_idx" ON "ApiKey"("storeId");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "Campaign"("isActive");

-- CreateIndex
CREATE INDEX "Campaign_season_idx" ON "Campaign"("season");

-- CreateIndex
CREATE INDEX "SearchTermDailyStat_date_idx" ON "SearchTermDailyStat"("date");

-- CreateIndex
CREATE INDEX "SearchTermDailyStat_category_date_idx" ON "SearchTermDailyStat"("category", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SearchTermDailyStat_term_date_key" ON "SearchTermDailyStat"("term", "date");

-- CreateIndex
CREATE INDEX "SavedSearchTerm_userId_idx" ON "SavedSearchTerm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearchTerm_userId_term_key" ON "SavedSearchTerm"("userId", "term");

-- CreateIndex
CREATE INDEX "RelatedTermFeedback_sourceTerm_idx" ON "RelatedTermFeedback"("sourceTerm");

-- CreateIndex
CREATE UNIQUE INDEX "RelatedTermFeedback_sourceTerm_relatedTerm_key" ON "RelatedTermFeedback"("sourceTerm", "relatedTerm");

-- AddForeignKey
ALTER TABLE "FcmToken" ADD CONSTRAINT "FcmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFaq" ADD CONSTRAINT "StoreFaq_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSubscription" ADD CONSTRAINT "StoreSubscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSubscription" ADD CONSTRAINT "StoreSubscription_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBankAccount" ADD CONSTRAINT "StoreBankAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBillingCard" ADD CONSTRAINT "StoreBillingCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTaxInfo" ADD CONSTRAINT "StoreTaxInfo_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFollow" ADD CONSTRAINT "StoreFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFollow" ADD CONSTRAINT "StoreFollow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerLedgerEntry" ADD CONSTRAINT "SellerLedgerEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerLedgerEntry" ADD CONSTRAINT "SellerLedgerEntry_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerLedgerEntry" ADD CONSTRAINT "SellerLedgerEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreLinkClick" ADD CONSTRAINT "StoreLinkClick_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetedOfferCampaign" ADD CONSTRAINT "TargetedOfferCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSocialConnection" ADD CONSTRAINT "StoreSocialConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_processingProfileId_fkey" FOREIGN KEY ("processingProfileId") REFERENCES "ProcessingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shippingProfileId_fkey" FOREIGN KEY ("shippingProfileId") REFERENCES "ShippingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopSectionId_fkey" FOREIGN KEY ("shopSectionId") REFERENCES "ShopSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationGroup" ADD CONSTRAINT "VariationGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationOption" ADD CONSTRAINT "VariationOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VariationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationSettings" ADD CONSTRAINT "VariationSettings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingProfile" ADD CONSTRAINT "ProcessingProfile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProfile" ADD CONSTRAINT "ShippingProfile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProfileMethod" ADD CONSTRAINT "ShippingProfileMethod_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ShippingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSection" ADD CONSTRAINT "ShopSection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationDraft" ADD CONSTRAINT "CustomizationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationDraft" ADD CONSTRAINT "CustomizationDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationDraft" ADD CONSTRAINT "CustomizationDraft_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalDownloadLog" ADD CONSTRAINT "DigitalDownloadLog_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardUsage" ADD CONSTRAINT "GiftCardUsage_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardUsage" ADD CONSTRAINT "GiftCardUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUsage" ADD CONSTRAINT "PromotionUsage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUsage" ADD CONSTRAINT "PromotionUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleOffer" ADD CONSTRAINT "BundleOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleOfferProduct" ADD CONSTRAINT "BundleOfferProduct_bundleOfferId_fkey" FOREIGN KEY ("bundleOfferId") REFERENCES "BundleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleOfferProduct" ADD CONSTRAINT "BundleOfferProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOfferListing" ADD CONSTRAINT "StoreOfferListing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOfferListing" ADD CONSTRAINT "StoreOfferListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerOffer" ADD CONSTRAINT "BuyerOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerOffer" ADD CONSTRAINT "BuyerOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerOffer" ADD CONSTRAINT "BuyerOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAccount" ADD CONSTRAINT "AffiliateAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrikeRecord" ADD CONSTRAINT "StrikeRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTracking" ADD CONSTRAINT "OrderTracking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "OrderTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFulfillmentConnection" ADD CONSTRAINT "StoreFulfillmentConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFulfillmentMapping" ADD CONSTRAINT "ProductFulfillmentMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "StoreFulfillmentConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFulfillmentMapping" ADD CONSTRAINT "ProductFulfillmentMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFulfillmentMapping" ADD CONSTRAINT "ProductFulfillmentMapping_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderFulfillment" ADD CONSTRAINT "StoreOrderFulfillment_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "StoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderFulfillment" ADD CONSTRAINT "StoreOrderFulfillment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "StoreFulfillmentConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchTerm" ADD CONSTRAINT "SavedSearchTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

