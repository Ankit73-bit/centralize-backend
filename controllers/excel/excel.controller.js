const asyncHandler = require("../../middleware/asyncHandler");
const excelService = require("../../services/excel/excel.service");
const ResponseFormatter = require("../../utils/response");
const { ValidationError, NotFoundError } = require("../../utils/errors");
const path = require("path");
const fs = require("fs-extra");

class ExcelController {
  /**
   * Upload Excel file
   * POST /api/excel/upload
   */
  uploadExcel = asyncHandler(async (req, res) => {
    // Check if file was uploaded
    if (!req.file) {
      throw new ValidationError(
        "No file uploaded. Please select an Excel file.",
      );
    }

    const { file } = req;

    // File info
    const fileInfo = {
      id: path.parse(file.filename).name, // Use filename without extension as temp ID
      originalName: file.originalname,
      storedName: file.filename,
      filePath: file.path,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    // TODO: Later we'll save this to database using Prisma
    // For now, just return file info

    return ResponseFormatter.created(
      res,
      fileInfo,
      "Excel file uploaded successfully",
    );
  });

  /**
   * Read Excel file and return JSON data
   * GET /api/excel/:fileId/read
   */
  readExcel = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    // Construct file path
    // For now, assuming fileId is the filename in temp folder
    const filePath = path.join(
      __dirname,
      "../../uploads/excel/temp",
      `${fileId}.xlsx`,
    );

    // Check if file exists (support multiple extensions)
    let actualFilePath = null;
    const extensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];

    for (const ext of extensions) {
      const testPath = path.join(
        __dirname,
        "../../uploads/excel/temp",
        `${fileId}${ext}`,
      );
      if (await fs.pathExists(testPath)) {
        actualFilePath = testPath;
        break;
      }
    }

    if (!actualFilePath) {
      throw new NotFoundError("Excel file", fileId);
    }

    // Read Excel file using service
    const excelData = await excelService.readExcelFile(actualFilePath);

    return ResponseFormatter.success(
      res,
      excelData,
      "Excel file read successfully",
    );
  });

  /**
   * Update Excel file with new data
   * PUT /api/excel/:fileId/write
   */
  writeExcel = asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const { data } = req.body;

    // Validate request body
    if (!data) {
      throw new ValidationError("Data is required in request body");
    }

    // Find source file
    let sourceFilePath = null;
    const extensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];

    for (const ext of extensions) {
      const testPath = path.join(
        __dirname,
        "../../uploads/excel/temp",
        `${fileId}${ext}`,
      );
      if (await fs.pathExists(testPath)) {
        sourceFilePath = testPath;
        break;
      }
    }

    if (!sourceFilePath) {
      throw new NotFoundError("Excel file", fileId);
    }

    // Create output path in processed folder
    const processedDir = path.join(__dirname, "../../uploads/excel/processed");
    await fs.ensureDir(processedDir);

    const outputFileName = `${fileId}-updated-${Date.now()}.xlsx`;
    const outputPath = path.join(processedDir, outputFileName);

    // Write data to Excel file
    const result = await excelService.writeExcelFile(
      sourceFilePath,
      data,
      outputPath,
    );

    return ResponseFormatter.success(
      res,
      {
        ...result,
        fileId: path.parse(outputFileName).name,
      },
      "Excel file updated successfully",
    );
  });

  /**
   * Download Excel file
   * GET /api/excel/:fileId/download
   */
  downloadExcel = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    // Search in both temp and processed folders
    const searchPaths = [
      path.join(__dirname, "../../uploads/excel/temp"),
      path.join(__dirname, "../../uploads/excel/processed"),
    ];

    let filePath = null;
    const extensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];

    // Search for file
    for (const dir of searchPaths) {
      for (const ext of extensions) {
        const testPath = path.join(dir, `${fileId}${ext}`);
        if (await fs.pathExists(testPath)) {
          filePath = testPath;
          break;
        }
      }
      if (filePath) break;
    }

    if (!filePath) {
      throw new NotFoundError("Excel file", fileId);
    }

    // Get original filename
    const originalName = path.basename(filePath);

    // Set headers for download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName}"`,
    );

    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });

  /**
   * Delete Excel file
   * DELETE /api/excel/:fileId
   */
  deleteExcel = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    // Search in both temp and processed folders
    const searchPaths = [
      path.join(__dirname, "../../uploads/excel/temp"),
      path.join(__dirname, "../../uploads/excel/processed"),
    ];

    let filePath = null;
    const extensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];

    // Search for file
    for (const dir of searchPaths) {
      for (const ext of extensions) {
        const testPath = path.join(dir, `${fileId}${ext}`);
        if (await fs.pathExists(testPath)) {
          filePath = testPath;
          break;
        }
      }
      if (filePath) break;
    }

    if (!filePath) {
      throw new NotFoundError("Excel file", fileId);
    }

    // Delete file
    await fs.remove(filePath);

    // TODO: Later delete from database as well

    return ResponseFormatter.success(
      res,
      null,
      "Excel file deleted successfully",
    );
  });

  /**
   * Get file info/metadata
   * GET /api/excel/:fileId/info
   */
  getFileInfo = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    // Search for file
    const searchPaths = [
      path.join(__dirname, "../../uploads/excel/temp"),
      path.join(__dirname, "../../uploads/excel/processed"),
    ];

    let filePath = null;
    const extensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];

    for (const dir of searchPaths) {
      for (const ext of extensions) {
        const testPath = path.join(dir, `${fileId}${ext}`);
        if (await fs.pathExists(testPath)) {
          filePath = testPath;
          break;
        }
      }
      if (filePath) break;
    }

    if (!filePath) {
      throw new NotFoundError("Excel file", fileId);
    }

    // Get file stats
    const stats = await fs.stat(filePath);

    const fileInfo = {
      id: fileId,
      fileName: path.basename(filePath),
      filePath: filePath,
      size: stats.size,
      sizeFormatted: this.formatBytes(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      extension: path.extname(filePath),
    };

    // TODO: Later fetch from database for more metadata

    return ResponseFormatter.success(
      res,
      fileInfo,
      "File info retrieved successfully",
    );
  });

  /**
   * Helper: Format bytes to human readable
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
}

module.exports = new ExcelController();
