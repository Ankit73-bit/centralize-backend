const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const fs = require("fs-extra");
const path = require("path");
const mammoth = require("mammoth");
const PDFDocument2 = require("pdfkit");
const {
  ValidationError,
  NotFoundError,
  FileProcessingError,
} = require("../../utils/errors");

class PdfService {
  /**
   * Merge multiple PDFs into one
   * @param {Array<String>} filePaths - Array of PDF file paths
   * @param {String} outputPath - Output file path
   */
  async mergePdfs(filePaths, outputPath) {
    try {
      if (!filePaths || filePaths.length < 2) {
        throw new ValidationError(
          "At least 2 PDF files are required for merging",
        );
      }

      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();

      // Process each PDF
      for (const filePath of filePaths) {
        if (!(await fs.pathExists(filePath))) {
          throw new NotFoundError("PDF file", filePath);
        }

        const pdfBytes = await fs.readFile(filePath);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices(),
        );

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      // Save merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, mergedPdfBytes);

      return {
        filePath: outputPath,
        fileName: path.basename(outputPath),
        pageCount: mergedPdf.getPageCount(),
        size: mergedPdfBytes.length,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(`Failed to merge PDFs: ${error.message}`, {
        originalError: error.message,
      });
    }
  }

  /**
   * Split PDF into separate pages
   * @param {String} filePath - PDF file path
   * @param {String} outputDir - Output directory
   */
  async splitPdfToPages(filePath, outputDir) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();

      await fs.ensureDir(outputDir);
      const outputFiles = [];

      for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);

        const pdfBytes = await newPdf.save();
        const outputFileName = `page_${String(i + 1).padStart(3, "0")}.pdf`;
        const outputPath = path.join(outputDir, outputFileName);

        await fs.writeFile(outputPath, pdfBytes);

        outputFiles.push({
          fileName: outputFileName,
          filePath: outputPath,
          pageNumber: i + 1,
          size: pdfBytes.length,
        });
      }

      return {
        totalPages,
        outputFiles,
        outputDir,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(`Failed to split PDF: ${error.message}`, {
        originalError: error.message,
      });
    }
  }

  /**
   * Split PDF by custom page ranges
   * @param {String} filePath - PDF file path
   * @param {Array} ranges - Array of ranges e.g., [{start: 1, end: 3}, {start: 5, end: 7}]
   * @param {String} outputDir - Output directory
   */
  async splitPdfByRange(filePath, ranges, outputDir) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      if (!ranges || ranges.length === 0) {
        throw new ValidationError("At least one range is required");
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();

      await fs.ensureDir(outputDir);
      const outputFiles = [];

      for (let i = 0; i < ranges.length; i++) {
        const { start, end } = ranges[i];

        // Validate range
        if (start < 1 || end > totalPages || start > end) {
          throw new ValidationError(
            `Invalid range: ${start}-${end}. Total pages: ${totalPages}`,
          );
        }

        const newPdf = await PDFDocument.create();
        const pageIndices = Array.from(
          { length: end - start + 1 },
          (_, idx) => start - 1 + idx,
        );

        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        const outputFileName = `range_${start}-${end}.pdf`;
        const outputPath = path.join(outputDir, outputFileName);

        await fs.writeFile(outputPath, pdfBytes);

        outputFiles.push({
          fileName: outputFileName,
          filePath: outputPath,
          range: `${start}-${end}`,
          pageCount: end - start + 1,
          size: pdfBytes.length,
        });
      }

      return {
        totalPages,
        outputFiles,
        outputDir,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to split PDF by range: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Split PDF by fixed page count
   * @param {String} filePath - PDF file path
   * @param {Number} pagesPerSplit - Number of pages per split
   * @param {String} outputDir - Output directory
   */
  async splitPdfByFixedRange(filePath, pagesPerSplit, outputDir) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      if (!pagesPerSplit || pagesPerSplit < 1) {
        throw new ValidationError("Pages per split must be at least 1");
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();

      await fs.ensureDir(outputDir);
      const outputFiles = [];

      let splitNumber = 1;
      for (let i = 0; i < totalPages; i += pagesPerSplit) {
        const newPdf = await PDFDocument.create();
        const endPage = Math.min(i + pagesPerSplit, totalPages);
        const pageIndices = Array.from(
          { length: endPage - i },
          (_, idx) => i + idx,
        );

        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        const outputFileName = `part_${String(splitNumber).padStart(3, "0")}.pdf`;
        const outputPath = path.join(outputDir, outputFileName);

        await fs.writeFile(outputPath, pdfBytes);

        outputFiles.push({
          fileName: outputFileName,
          filePath: outputPath,
          partNumber: splitNumber,
          startPage: i + 1,
          endPage: endPage,
          pageCount: endPage - i,
          size: pdfBytes.length,
        });

        splitNumber++;
      }

      return {
        totalPages,
        totalParts: outputFiles.length,
        pagesPerSplit,
        outputFiles,
        outputDir,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to split PDF by fixed range: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Extract specific pages from PDF
   * @param {String} filePath - PDF file path
   * @param {Array<Number>} pageNumbers - Page numbers to extract (1-indexed)
   * @param {String} outputPath - Output file path
   */
  async extractPages(filePath, pageNumbers, outputPath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      if (!pageNumbers || pageNumbers.length === 0) {
        throw new ValidationError("At least one page number is required");
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();

      // Validate page numbers
      const invalidPages = pageNumbers.filter((p) => p < 1 || p > totalPages);
      if (invalidPages.length > 0) {
        throw new ValidationError(
          `Invalid page numbers: ${invalidPages.join(", ")}. Total pages: ${totalPages}`,
        );
      }

      const newPdf = await PDFDocument.create();
      const pageIndices = pageNumbers.map((p) => p - 1); // Convert to 0-indexed
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);

      copiedPages.forEach((page) => newPdf.addPage(page));

      const extractedPdfBytes = await newPdf.save();
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, extractedPdfBytes);

      return {
        filePath: outputPath,
        fileName: path.basename(outputPath),
        extractedPages: pageNumbers,
        pageCount: pageNumbers.length,
        originalPageCount: totalPages,
        size: extractedPdfBytes.length,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to extract pages: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Compress PDF
   * @param {String} filePath - PDF file path
   * @param {String} level - Compression level: 'extreme', 'recommended', 'low'
   * @param {String} outputPath - Output file path
   */
  async compressPdf(filePath, level, outputPath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      const validLevels = ["extreme", "recommended", "low"];
      if (!validLevels.includes(level)) {
        throw new ValidationError(
          `Invalid compression level. Must be: ${validLevels.join(", ")}`,
        );
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Save with compression settings
      // pdf-lib does basic compression with useObjectStreams
      const compressedPdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      });

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, compressedPdfBytes);

      const originalSize = pdfBytes.length;
      const compressedSize = compressedPdfBytes.length;
      const savedBytes = originalSize - compressedSize;
      const compressionRatio =
        savedBytes > 0
          ? ((savedBytes / originalSize) * 100).toFixed(2)
          : "0.00";

      return {
        filePath: outputPath,
        fileName: path.basename(outputPath),
        originalSize,
        compressedSize,
        savedBytes,
        compressionRatio: `${compressionRatio}%`,
        level,
        pageCount: pdfDoc.getPageCount(),
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to compress PDF: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Add text watermark to PDF
   * @param {String} filePath - PDF file path
   * @param {String} watermarkText - Watermark text
   * @param {Object} options - Watermark options
   * @param {String} outputPath - Output file path
   */
  async addWatermark(filePath, watermarkText, options, outputPath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      if (!watermarkText) {
        throw new ValidationError("Watermark text is required");
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const {
        opacity = 0.3,
        fontSize = 48,
        rotation = -45,
        color = { r: 0.5, g: 0.5, b: 0.5 },
        position = "center", // 'center', 'diagonal', 'top', 'bottom'
      } = options || {};

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = fontSize;

        let x, y, angle;

        switch (position) {
          case "diagonal":
            x = (width - textWidth) / 2;
            y = height / 2;
            angle = rotation;
            break;
          case "top":
            x = (width - textWidth) / 2;
            y = height - textHeight - 20;
            angle = 0;
            break;
          case "bottom":
            x = (width - textWidth) / 2;
            y = 20;
            angle = 0;
            break;
          case "center":
          default:
            x = (width - textWidth) / 2;
            y = (height - textHeight) / 2;
            angle = 0;
        }

        page.drawText(watermarkText, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(angle),
        });
      });

      const watermarkedPdfBytes = await pdfDoc.save();
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, watermarkedPdfBytes);

      return {
        filePath: outputPath,
        fileName: path.basename(outputPath),
        pageCount: pages.length,
        watermarkText,
        options: { opacity, fontSize, rotation, position },
        size: watermarkedPdfBytes.length,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to add watermark: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Convert PDF pages to images (placeholder - requires external tools)
   * @param {String} filePath - PDF file path
   * @param {String} format - Image format ('png' or 'jpg')
   * @param {Number} dpi - DPI quality (default: 150)
   * @param {String} outputDir - Output directory
   */
  async pdfToImages(filePath, format = "png", dpi = 150, outputDir) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      // Note: This is a placeholder
      // In production, you would use:
      // - pdf-poppler (requires poppler-utils installed)
      // - pdf2pic library
      // - ImageMagick
      // - Puppeteer for rendering

      throw new FileProcessingError(
        "PDF to images conversion requires additional system dependencies (poppler-utils or ImageMagick). This feature will be implemented when system tools are available.",
        {
          feature: "pdf-to-images",
          requiredTools: ["poppler-utils", "ImageMagick"],
          status: "coming_soon",
        },
      );
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to convert PDF to images: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Convert DOCX to PDF
   * @param {String} filePath - DOCX file path
   * @param {String} outputPath - Output PDF path
   */
  async docxToPdf(filePath, outputPath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("DOCX file", filePath);
      }

      // Convert DOCX to HTML first
      const result = await mammoth.convertToHtml({ path: filePath });
      const html = result.value;

      // Create PDF from HTML using PDFKit
      await fs.ensureDir(path.dirname(outputPath));

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument2({
          margins: {
            top: 72,
            bottom: 72,
            left: 72,
            right: 72,
          },
        });

        const writeStream = fs.createWriteStream(outputPath);

        doc.pipe(writeStream);

        // Simple HTML parsing and rendering
        // Remove HTML tags for basic conversion
        const plainText = html
          .replace(/<style[^>]*>.*?<\/style>/gs, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"');

        doc.fontSize(12).text(plainText, {
          align: "left",
          width: 470,
        });

        doc.end();

        writeStream.on("finish", async () => {
          const stats = await fs.stat(outputPath);
          resolve({
            filePath: outputPath,
            fileName: path.basename(outputPath),
            size: stats.size,
            format: "pdf",
            sourceFormat: "docx",
          });
        });

        writeStream.on("error", reject);
      });
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to convert DOCX to PDF: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Convert TXT to PDF
   * @param {String} filePath - TXT file path
   * @param {String} outputPath - Output PDF path
   */
  async textToPdf(filePath, outputPath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("Text file", filePath);
      }

      const textContent = await fs.readFile(filePath, "utf-8");
      await fs.ensureDir(path.dirname(outputPath));

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument2({
          margins: {
            top: 72,
            bottom: 72,
            left: 72,
            right: 72,
          },
        });

        const writeStream = fs.createWriteStream(outputPath);

        doc.pipe(writeStream);

        doc.fontSize(12).font("Courier").text(textContent, {
          align: "left",
          width: 470,
        });

        doc.end();

        writeStream.on("finish", async () => {
          const stats = await fs.stat(outputPath);
          resolve({
            filePath: outputPath,
            fileName: path.basename(outputPath),
            size: stats.size,
            format: "pdf",
            sourceFormat: "txt",
          });
        });

        writeStream.on("error", reject);
      });
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to convert text to PDF: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Get PDF metadata
   * @param {String} filePath - PDF file path
   */
  async getPdfInfo(filePath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("PDF file", filePath);
      }

      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const pageCount = pdfDoc.getPageCount();
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      return {
        pageCount,
        dimensions: {
          width,
          height,
        },
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        creator: pdfDoc.getCreator(),
        producer: pdfDoc.getProducer(),
        fileSize: pdfBytes.length,
      };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new FileProcessingError(
        `Failed to get PDF info: ${error.message}`,
        { originalError: error.message },
      );
    }
  }
}

module.exports = new PdfService();
