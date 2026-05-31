-- CreateTable
CREATE TABLE "ReplayChunk" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplayChunk_eventId_key" ON "ReplayChunk"("eventId");

-- AddForeignKey
ALTER TABLE "ReplayChunk" ADD CONSTRAINT "ReplayChunk_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
