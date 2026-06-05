CREATE TABLE "ManualReport" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "screenshotData" TEXT,
    "annotations" JSONB,
    "url" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualReport_issueId_createdAt_idx" ON "ManualReport"("issueId", "createdAt");
CREATE INDEX "ManualReport_createdByUserId_idx" ON "ManualReport"("createdByUserId");
ALTER TABLE "ManualReport" ADD CONSTRAINT "ManualReport_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualReport" ADD CONSTRAINT "ManualReport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
