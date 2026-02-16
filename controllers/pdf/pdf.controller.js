const asyncHandler = require("../../middleware/asyncHandler");
const pdfService = require("../../services/pdf/pdf.service");
const fileService = require("../../services/database/file.service");
const ResponseFormatter = require("../../utils/response");
const { ValidationError, NotFoundError } = require("../../utils/errors");
const path = require("path");
const fs = require("fs-extra");
const prisma = require("../../config/database");

class PdfController {
  /**
   * Merge multiple PDFs
   * POST /api/pdf/merge
   */
  mergePdfs = asyncHandler(async (req, res) => {
    // Check if files were uploaded
    if (!req.files || req.files.length < 2) {
      throw new ValidationError(
        "At least 2 PDF files are required for merging",
      );
    }

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "MERGE",
        status: "PROCESSING",
        options: { fileCount: req.files.length },
      },
    });

    try {
      // Get file paths
      const filePaths = req.files.map((file) => file.path);

      // Merge PDFs
      const outputDir = path.join(__dirname, "../../uploads/pdf/merged");
      await fs.ensureDir(outputDir);
      const outputFileName = `merged-${Date.now()}.pdf`;
      const outputPath = path.join(outputDir, outputFileName);

      const result = await pdfService.mergePdfs(filePaths, outputPath);

      // Save output file to database
      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "PDF",
        fileSize: result.size,
        mimeType: "application/pdf",
        metadata: {
          operationType: "MERGE",
          sourceFiles: req.files.map((f) => f.originalname),
          pageCount: result.pageCount,
        },
        processed: true,
      });

      // Update operation
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          outputFileId: outputFile.id,
          status: "COMPLETED",
          options: {
            fileCount: req.files.length,
            totalPages: result.pageCount,
          },
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            size: outputFile.fileSize,
            pageCount: result.pageCount,
            downloadUrl: `/api/pdf/download/${outputFile.id}`,
          },
        },
        "PDFs merged successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Split PDF into separate pages
   * POST /api/pdf/split/pages
   */
  splitPdfToPages = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("PDF file is required");
    }

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "SPLIT_PAGES",
        status: "PROCESSING",
      },
    });

    try {
      const outputDir = path.join(
        __dirname,
        "../../uploads/pdf/split",
        `split-${Date.now()}`,
      );
      const result = await pdfService.splitPdfToPages(req.file.path, outputDir);

      // Save source file
      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "PDF",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      // Update operation
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          status: "COMPLETED",
          options: {
            totalPages: result.totalPages,
            outputFiles: result.outputFiles.length,
            outputDir: result.outputDir,
          },
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          totalPages: result.totalPages,
          outputFiles: result.outputFiles,
          outputDir: result.outputDir,
        },
        "PDF split into pages successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Split PDF by custom ranges
   * POST /api/pdf/split/range
   */
  splitPdfByRange = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("PDF file is required");
    }

    const { ranges } = req.body;
    if (!ranges) {
      throw new ValidationError(
        'Ranges are required (e.g., [{"start":1,"end":3},{"start":5,"end":7}])',
      );
    }

    const parsedRanges =
      typeof ranges === "string" ? JSON.parse(ranges) : ranges;

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "SPLIT_RANGE",
        status: "PROCESSING",
        options: { ranges: parsedRanges },
      },
    });

    try {
      const outputDir = path.join(
        __dirname,
        "../../uploads/pdf/split",
        `range-${Date.now()}`,
      );
      const result = await pdfService.splitPdfByRange(
        req.file.path,
        parsedRanges,
        outputDir,
      );

      // Save source file
      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "PDF",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          status: "COMPLETED",
          options: {
            totalPages: result.totalPages,
            ranges: parsedRanges,
            outputFiles: result.outputFiles.length,
          },
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          totalPages: result.totalPages,
          outputFiles: result.outputFiles,
        },
        "PDF split by range successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Split PDF by fixed page count
   * POST /api/pdf/split/fixed
   */
  splitPdfByFixed = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("PDF file is required");
    }

    const { pagesPerSplit } = req.body;
    if (!pagesPerSplit || isNaN(pagesPerSplit)) {
      throw new ValidationError(
        "pagesPerSplit is required and must be a number",
      );
    }

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "SPLIT_FIXED",
        status: "PROCESSING",
        options: { pagesPerSplit: parseInt(pagesPerSplit) },
      },
    });

    try {
      const outputDir = path.join(
        __dirname,
        "../../uploads/pdf/split",
        `fixed-${Date.now()}`,
      );
      const result = await pdfService.splitPdfByFixedRange(
        req.file.path,
        parseInt(pagesPerSplit),
        outputDir,
      );

      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "PDF",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          status: "COMPLETED",
          options: {
            totalPages: result.totalPages,
            totalParts: result.totalParts,
            pagesPerSplit: result.pagesPerSplit,
          },
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          totalPages: result.totalPages,
          totalParts: result.totalParts,
          pagesPerSplit: result.pagesPerSplit,
          outputFiles: result.outputFiles,
        },
        "PDF split by fixed range successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Extract specific pages
   * POST /api/pdf/extract
   */
  extractPages = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("PDF file is required");
    }

    const { pages } = req.body;
    if (!pages) {
      throw new ValidationError(
        'Pages are required (e.g., [1,3,5] or "1,3,5")',
      );
    }

    const pageNumbers =
      typeof pages === "string"
        ? pages.split(",").map((p) => parseInt(p.trim()))
        : pages;

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "EXTRACT_PAGES",
        status: "PROCESSING",
        options: { pages: pageNumbers },
      },
    });

    try {
      const outputDir = path.join(__dirname, "../../uploads/pdf/extracted");
      await fs.ensureDir(outputDir);
      const outputFileName = `extracted-${Date.now()}.pdf`;
      const outputPath = path.join(outputDir, outputFileName);

      const result = await pdfService.extractPages(
        req.file.path,
        pageNumbers,
        outputPath,
      );

      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "PDF",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "PDF",
        fileSize: result.size,
        mimeType: "application/pdf",
        metadata: {
          extractedPages: pageNumbers,
          originalPageCount: result.originalPageCount,
        },
        processed: true,
      });

      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          outputFileId: outputFile.id,
          status: "COMPLETED",
          options: {
            extractedPages: pageNumbers,
            pageCount: result.pageCount,
          },
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            size: result.size,
            extractedPages: pageNumbers,
            pageCount: result.pageCount,
            downloadUrl: `/api/pdf/download/${outputFile.id}`,
          },
        },
        "Pages extracted successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Compress PDF
   * POST /api/pdf/compress
   */
  compressPdf = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("PDF file is required");
    }

    const { level } = req.body;
    const compressionLevel = level || "recommended";

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "COMPRESS",
        status: "PROCESSING",
        options: { level: compressionLevel },
      },
    });

    try {
      const outputDir = path.join(__dirname, "../../uploads/pdf/compressed");
      await fs.ensureDir(outputDir);
      const outputFileName = `compressed-${Date.now()}.pdf`;
      const outputPath = path.join(outputDir, outputFileName);

      const result = await pdfService.compressPdf(
        req.file.path,
        compressionLevel,
        outputPath,
      );

      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "PDF",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "PDF",
        fileSize: result.compressedSize,
        mimeType: "application/pdf",
        metadata: {
          originalSize: result.originalSize,
          compressionRatio: result.compressionRatio,
          level: compressionLevel,
        },
        processed: true,
      });

      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          outputFileId: outputFile.id,
          status: "COMPLETED",
          options: {
            level: compressionLevel,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
          },
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            savedBytes: result.savedBytes,
            compressionRatio: result.compressionRatio,
            downloadUrl: `/api/pdf/download/${outputFile.id}`,
          },
        },
        "PDF compressed successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Add watermark to PDF
   * POST /api/pdf/watermark
   */
  addWatermark = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("PDF file is required");
    }

    const { text, opacity, fontSize, rotation, position } = req.body;

    if (!text) {
      throw new ValidationError("Watermark text is required");
    }

    const options = {
      opacity: opacity ? parseFloat(opacity) : 0.1,
      fontSize: fontSize ? parseInt(fontSize) : 200,
      rotation: rotation ? parseInt(rotation) : 45,
      position: position || "diagonal",
    };

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "ADD_WATERMARK",
        status: "PROCESSING",
        options: { text, ...options },
      },
    });

    try {
      const outputDir = path.join(__dirname, "../../uploads/pdf/watermarked");
      await fs.ensureDir(outputDir);
      const outputFileName = `watermarked-${Date.now()}.pdf`;
      const outputPath = path.join(outputDir, outputFileName);

      const result = await pdfService.addWatermark(
        req.file.path,
        text,
        options,
        outputPath,
      );

      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "PDF",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "PDF",
        fileSize: result.size,
        mimeType: "application/pdf",
        metadata: {
          watermarkText: text,
          watermarkOptions: options,
        },
        processed: true,
      });

      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          outputFileId: outputFile.id,
          status: "COMPLETED",
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            size: result.size,
            pageCount: result.pageCount,
            downloadUrl: `/api/pdf/download/${outputFile.id}`,
          },
        },
        "Watermark added successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Convert document to PDF
   * POST /api/pdf/doc-to-pdf
   */
  docToPdf = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("Document file is required");
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const supportedFormats = [".docx", ".txt"];

    if (!supportedFormats.includes(fileExtension)) {
      throw new ValidationError(
        `Unsupported file format. Supported: ${supportedFormats.join(", ")}`,
      );
    }

    const operation = await prisma.pdfOperation.create({
      data: {
        operationType: "DOC_TO_PDF",
        status: "PROCESSING",
        options: { sourceFormat: fileExtension },
      },
    });

    try {
      const outputDir = path.join(__dirname, "../../uploads/pdf/converted");
      await fs.ensureDir(outputDir);
      const outputFileName = `${path.parse(req.file.originalname).name}-${Date.now()}.pdf`;
      const outputPath = path.join(outputDir, outputFileName);

      let result;
      if (fileExtension === ".docx") {
        result = await pdfService.docxToPdf(req.file.path, outputPath);
      } else if (fileExtension === ".txt") {
        result = await pdfService.textToPdf(req.file.path, outputPath);
      }

      const sourceFile = await fileService.createFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileType: "DOCUMENT",
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        processed: true,
      });

      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "PDF",
        fileSize: result.size,
        mimeType: "application/pdf",
        metadata: {
          convertedFrom: fileExtension,
        },
        processed: true,
      });

      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          sourceFileId: sourceFile.id,
          outputFileId: outputFile.id,
          status: "COMPLETED",
        },
      });

      return ResponseFormatter.success(
        res,
        {
          operationId: operation.id,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            size: result.size,
            sourceFormat: fileExtension,
            downloadUrl: `/api/pdf/download/${outputFile.id}`,
          },
        },
        "Document converted to PDF successfully",
      );
    } catch (error) {
      await prisma.pdfOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Download PDF file
   * GET /api/pdf/download/:fileId
   */
  downloadFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    const file = await fileService.getFileById(fileId);

    if (!(await fs.pathExists(file.filePath))) {
      throw new NotFoundError("File on disk", file.filePath);
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}"`,
    );

    const fileStream = fs.createReadStream(file.filePath);
    fileStream.pipe(res);
  });

  /**
   * Get operation info
   * GET /api/pdf/:operationId
   */
  getOperation = asyncHandler(async (req, res) => {
    const { operationId } = req.params;

    const operation = await prisma.pdfOperation.findUnique({
      where: { id: operationId },
      include: {
        sourceFile: true,
        outputFile: true,
      },
    });

    if (!operation) {
      throw new NotFoundError("PDF operation", operationId);
    }

    return ResponseFormatter.success(
      res,
      operation,
      "Operation retrieved successfully",
    );
  });

  /**
   * Delete operation and files
   * DELETE /api/pdf/:operationId
   */
  deleteOperation = asyncHandler(async (req, res) => {
    const { operationId } = req.params;

    const operation = await prisma.pdfOperation.findUnique({
      where: { id: operationId },
      include: {
        sourceFile: true,
        outputFile: true,
      },
    });

    if (!operation) {
      throw new NotFoundError("PDF operation", operationId);
    }

    // Delete files from disk
    if (
      operation.sourceFile &&
      (await fs.pathExists(operation.sourceFile.filePath))
    ) {
      await fs.remove(operation.sourceFile.filePath);
    }

    if (
      operation.outputFile &&
      (await fs.pathExists(operation.outputFile.filePath))
    ) {
      await fs.remove(operation.outputFile.filePath);
    }

    // Delete operation (will cascade delete file records)
    await prisma.pdfOperation.delete({
      where: { id: operationId },
    });

    return ResponseFormatter.success(
      res,
      null,
      "Operation deleted successfully",
    );
  });
}

module.exports = new PdfController();
