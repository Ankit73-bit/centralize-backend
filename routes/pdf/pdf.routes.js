const express = require("express");
const router = express.Router();
const pdfController = require("../../controllers/pdf/pdf.controller");
const {
  uploadPdf,
  uploadMultiplePdfs,
  uploadPdfOrDoc,
} = require("../../middleware/upload");

/**
 * PDF Service Routes
 * Base path: /api/pdf
 */

// Merge multiple PDFs
router.post("/merge", uploadMultiplePdfs, pdfController.mergePdfs);

// Split PDF into separate pages
router.post("/split/pages", uploadPdf, pdfController.splitPdfToPages);

// Split PDF by custom ranges
router.post("/split/range", uploadPdf, pdfController.splitPdfByRange);

// Split PDF by fixed page count
router.post("/split/fixed", uploadPdf, pdfController.splitPdfByFixed);

// Extract specific pages
router.post("/extract", uploadPdf, pdfController.extractPages);

// Compress PDF
router.post("/compress", uploadPdf, pdfController.compressPdf);

// Add watermark to PDF
router.post("/watermark", uploadPdf, pdfController.addWatermark);

// Convert document to PDF
router.post("/doc-to-pdf", uploadPdfOrDoc, pdfController.docToPdf);

// Download PDF file
router.get("/download/:fileId", pdfController.downloadFile);

// Get operation info
router.get("/:operationId", pdfController.getOperation);

// Delete operation
router.delete("/:operationId", pdfController.deleteOperation);

module.exports = router;
