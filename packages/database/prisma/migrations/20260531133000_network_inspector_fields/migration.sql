-- AlterTable
ALTER TABLE "NetworkRequest"
ADD COLUMN "requestHeaders" JSONB,
ADD COLUMN "requestBody" TEXT,
ADD COLUMN "responseHeaders" JSONB,
ADD COLUMN "responseBody" TEXT,
ADD COLUMN "error" TEXT;
