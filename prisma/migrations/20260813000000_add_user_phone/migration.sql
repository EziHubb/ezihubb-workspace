-- Add the phone column the User model was always missing — UserResponseDto
-- and the profile-edit form already had a `phone` field, but nothing ever
-- persisted it since the column never existed.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
