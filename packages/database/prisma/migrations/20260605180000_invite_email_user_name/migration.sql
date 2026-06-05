ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "userId" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "email" TEXT;
ALTER TABLE "ProjectInvite" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
