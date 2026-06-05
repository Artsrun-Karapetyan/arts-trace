CREATE TABLE "IssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IssueComment_issueId_createdAt_idx" ON "IssueComment"("issueId", "createdAt");
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
