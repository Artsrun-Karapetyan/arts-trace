-- AlterTable
ALTER TABLE "Project" ADD COLUMN "ownerId" TEXT;

-- Preserve existing local projects by assigning them to the oldest account.
UPDATE "Project"
SET "ownerId" = (
    SELECT "id"
    FROM "User"
    ORDER BY "createdAt" ASC
    LIMIT 1
)
WHERE "ownerId" IS NULL;

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
