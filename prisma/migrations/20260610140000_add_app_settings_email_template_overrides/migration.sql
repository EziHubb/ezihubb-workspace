-- CreateTable: key-value store for admin settings (store, email, notifications, seo)
CREATE TABLE "AppSettings" (
  "id"        TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");

-- CreateTable: per-slug overrides for Handlebars email templates
CREATE TABLE "EmailTemplateOverride" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailTemplateOverride_slug_key" ON "EmailTemplateOverride"("slug");

-- AlterTable: track last successful login time on User
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
