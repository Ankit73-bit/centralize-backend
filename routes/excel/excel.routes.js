const express = require("express");
const router = express.Router();
const excelController = require("../../controllers/excel/excel.controller.js");
const { uploadExcel } = require("../../middleware/upload");

/**
 * Excel Service Routes
 * Base path: /api/excel
 */

// Upload Excel file
router.post("/upload", uploadExcel, excelController.uploadExcel);

// Read Excel file data
router.get("/:fileId/read", excelController.readExcel);

// Update Excel file data
router.put("/:fileId/write", excelController.writeExcel);

// Download Excel file
router.get("/:fileId/download", excelController.downloadExcel);

// Delete Excel file
router.delete("/:fileId", excelController.deleteExcel);

// Get file info/metadata
router.get("/:fileId/info", excelController.getFileInfo);

module.exports = router;
