-- New primary keys use the same compact, case-sensitive alphanumeric shape
-- as Product IDs. ALTER COLUMN ... SET DEFAULT only affects future inserts;
-- existing CUID and 10-character Product NanoID values remain untouched.
CREATE OR REPLACE FUNCTION nanoid(size integer DEFAULT 12)
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT string_agg(
    substr(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      floor(random() * 62)::integer + 1,
      1
    ),
    ''
  )
  FROM generate_series(1, size);
$$;

ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "FcmToken" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "RefreshToken" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "EmailVerification" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "PasswordReset" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Address" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "WishlistItem" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Store" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreFaq" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreSubscription" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreBankAccount" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreBillingCard" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreTaxInfo" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreFollow" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreOrder" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "OrderProgressStep" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "SellerPayout" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "SellerLedgerEntry" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreLinkClick" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "TargetedOfferCampaign" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreSocialConnection" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "SocialPost" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Category" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Collection" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Tag" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Product" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProductVariant" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProductImage" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProductVideo" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "DigitalFile" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "VariationGroup" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "VariationOption" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "VariationSettings" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProcessingProfile" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ShippingProfile" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ShippingProfileMethod" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ShopSection" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProductionPartner" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "CustomizationDraft" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Cart" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "CartItem" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Order" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "OrderItem" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "DigitalDownloadLog" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Payment" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "GiftCard" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "GiftCardUsage" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Promotion" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "PromotionProduct" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "PromotionUsage" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "BundleOffer" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "BundleOfferProduct" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreOfferListing" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "BuyerOffer" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Review" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProductQuestion" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Notification" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AttributeValue" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Conversation" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ConversationLabel" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "BuyerNote" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "MessageSnippet" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Message" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AuditLog" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AffiliateAccount" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AffiliateClick" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AffiliateCommission" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AffiliatePayout" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "AppSettings" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "EmailTemplateOverride" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Translation" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ModerationLog" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ModerationRule" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StrikeRecord" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "OrderTracking" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "TrackingEvent" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreFulfillmentConnection" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ProductFulfillmentMapping" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "StoreOrderFulfillment" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ApiKey" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "Campaign" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "SearchTermDailyStat" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "SavedSearchTerm" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "RelatedTermFeedback" ALTER COLUMN "id" SET DEFAULT nanoid(12);
ALTER TABLE "ConversationReport" ALTER COLUMN "id" SET DEFAULT nanoid(12);
