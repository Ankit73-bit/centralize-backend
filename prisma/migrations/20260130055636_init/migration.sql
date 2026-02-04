-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'EXCEL', 'JSON', 'OTHER');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('UPLOAD', 'EXCEL_TO_JSON', 'JSON_TO_EXCEL', 'PDF_GENERATE', 'PDF_RENAME', 'PDF_MERGE', 'PDF_SPLIT', 'PDF_EXTRACT', 'DELETE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('JSON_TO_EXCEL', 'EXCEL_TO_JSON');

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "outputFileId" TEXT,
    "conversionType" "ConversionType" NOT NULL,
    "status" "ProcessStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "options" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "status" "ProcessStatus" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "errorMessage" TEXT,
    "details" JSONB,

    CONSTRAINT "ProcessingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileTag" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_storedName_key" ON "File"("storedName");

-- CreateIndex
CREATE INDEX "File_fileType_idx" ON "File"("fileType");

-- CreateIndex
CREATE INDEX "File_uploadDate_idx" ON "File"("uploadDate");

-- CreateIndex
CREATE INDEX "File_processed_idx" ON "File"("processed");

-- CreateIndex
CREATE INDEX "Conversion_conversionType_idx" ON "Conversion"("conversionType");

-- CreateIndex
CREATE INDEX "Conversion_status_idx" ON "Conversion"("status");

-- CreateIndex
CREATE INDEX "Conversion_createdAt_idx" ON "Conversion"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessingLog_fileId_idx" ON "ProcessingLog"("fileId");

-- CreateIndex
CREATE INDEX "ProcessingLog_operationType_idx" ON "ProcessingLog"("operationType");

-- CreateIndex
CREATE INDEX "ProcessingLog_status_idx" ON "ProcessingLog"("status");

-- CreateIndex
CREATE INDEX "ProcessingLog_startTime_idx" ON "ProcessingLog"("startTime");

-- CreateIndex
CREATE INDEX "FileTag_tag_idx" ON "FileTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "FileTag_fileId_tag_key" ON "FileTag"("fileId", "tag");

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_outputFileId_fkey" FOREIGN KEY ("outputFileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingLog" ADD CONSTRAINT "ProcessingLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTag" ADD CONSTRAINT "FileTag_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
