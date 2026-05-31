-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "SourceMap" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "release" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceMap_projectId_release_idx" ON "SourceMap"("projectId", "release");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMap_projectId_release_fileName_key" ON "SourceMap"("projectId", "release", "fileName");

-- AddForeignKey
ALTER TABLE "SourceMap" ADD CONSTRAINT "SourceMap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
