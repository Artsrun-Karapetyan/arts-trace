-- CreateTable
CREATE TABLE "Breadcrumb" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breadcrumb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" INTEGER,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Breadcrumb_eventId_createdAt_idx" ON "Breadcrumb"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "NetworkRequest_eventId_createdAt_idx" ON "NetworkRequest"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "Breadcrumb" ADD CONSTRAINT "Breadcrumb_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkRequest" ADD CONSTRAINT "NetworkRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
