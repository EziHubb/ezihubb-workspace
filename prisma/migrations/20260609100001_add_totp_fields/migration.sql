-- AlterTable: Add TOTP 2FA fields to User
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
