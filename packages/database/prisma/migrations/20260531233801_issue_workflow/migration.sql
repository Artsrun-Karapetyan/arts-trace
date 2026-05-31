-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');

-- AlterTable
ALTER TABLE "Issue"
ADD COLUMN "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "assignee" TEXT;
