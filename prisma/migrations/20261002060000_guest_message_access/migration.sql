-- Expand only. Apply before activating the guest-mailbox proof API.
-- No existing conversations, users, orders or financial records are rewritten.
CREATE TABLE "GuestMessageAccess" (
    "id" TEXT NOT NULL DEFAULT nanoid(12),
    "email" TEXT NOT NULL,
    "verificationHash" TEXT,
    "tokenHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestMessageAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestMessageAccess_tokenHash_key" ON "GuestMessageAccess"("tokenHash");
CREATE INDEX "GuestMessageAccess_email_expiresAt_idx" ON "GuestMessageAccess"("email", "expiresAt");
CREATE INDEX "GuestMessageAccess_expiresAt_idx" ON "GuestMessageAccess"("expiresAt");
