-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileType" ADD VALUE 'IMAGE';
ALTER TYPE "FileType" ADD VALUE 'DOCUMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperationType" ADD VALUE 'PDF_COMPRESS';
ALTER TYPE "OperationType" ADD VALUE 'PDF_WATERMARK';
ALTER TYPE "OperationType" ADD VALUE 'PDF_TO_IMAGES';
ALTER TYPE "OperationType" ADD VALUE 'DOC_TO_PDF';
