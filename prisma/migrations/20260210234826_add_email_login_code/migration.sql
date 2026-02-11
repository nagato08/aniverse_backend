-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailLoginCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailLoginCodeHash" TEXT;
