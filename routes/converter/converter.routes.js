const express = require("express");
const router = express.Router();
const converterController = require("../../controllers/converter/converter.controller");
const { uploadExcel } = require("../../middleware/upload");

/**
 * Converter Service Routes
 * Base path: /api/converter
 */

// Convert JSON to Excel
router.post("/json-to-excel", converterController.jsonToExcel);

// Convert Excel to JSON
router.post("/excel-to-json", uploadExcel, converterController.excelToJson);

// Download converted file
router.get("/download/:fileId", converterController.downloadFile);

// Get conversion info
router.get("/:conversionId", converterController.getConversion);

// Delete conversion
router.delete("/:conversionId", converterController.deleteConversion);

module.exports = router;
