-- CreateEnum
CREATE TYPE "PdfOperationType" AS ENUM ('MERGE', 'SPLIT_PAGES', 'SPLIT_RANGE', 'SPLIT_FIXED', 'EXTRACT_PAGES', 'COMPRESS', 'ADD_WATERMARK', 'TO_IMAGES', 'DOC_TO_PDF');

-- CreateTable
CREATE TABLE "PdfOperation" (
    "id" TEXT NOT NULL,
    "operationType" "PdfOperationType" NOT NULL,
    "sourceFileId" TEXT,
    "outputFileId" TEXT,
    "status" "ProcessStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "options" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "PdfOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfOperation_operationType_idx" ON "PdfOperation"("operationType");

-- CreateIndex
CREATE INDEX "PdfOperation_status_idx" ON "PdfOperation"("status");

-- CreateIndex
CREATE INDEX "PdfOperation_createdAt_idx" ON "PdfOperation"("createdAt");

-- AddForeignKey
ALTER TABLE "PdfOperation" ADD CONSTRAINT "PdfOperation_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfOperation" ADD CONSTRAINT "PdfOperation_outputFileId_fkey" FOREIGN KEY ("outputFileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
