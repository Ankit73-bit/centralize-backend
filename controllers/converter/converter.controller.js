const asyncHandler = require("../../middleware/asyncHandler");
const converterService = require("../../services/converter/converter.service");
const fileService = require("../../services/database/file.service");
const ResponseFormatter = require("../../utils/response");
const { ValidationError } = require("../../utils/errors");
const path = require("path");
const fs = require("fs-extra");
const prisma = require("../../config/database");

class ConverterController {
  /**
   * Convert JSON to Excel
   * POST /api/converter/json-to-excel
   */
  jsonToExcel = asyncHandler(async (req, res) => {
    const { jsonData, fileName } = req.body;

    // Validate input
    if (!jsonData) {
      throw new ValidationError("JSON data is required");
    }

    // Parse JSON if it's a string
    let parsedData;
    try {
      parsedData =
        typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
    } catch (error) {
      throw new ValidationError("Invalid JSON format");
    }

    // Create conversion record
    const conversion = await prisma.Conversion.create({
      data: {
        conversionType: "JSON_TO_EXCEL",
        status: "PROCESSING",
        options: {},
      },
    });

    try {
      // Generate output file path
      const outputDir = path.join(__dirname, "../../uploads/conversions");
      await fs.ensureDir(outputDir);

      // const outputFileName = fileName
      //   ? `${path.parse(fileName).name}.xlsx`
      //   : `converted-${Date.now()}.xlsx`;

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const baseName = fileName ? path.parse(fileName).name : "converted";
      const outputFileName = `${baseName}-${uniqueSuffix}.xlsx`;

      const outputPath = path.join(outputDir, outputFileName);

      // Convert JSON to Excel
      const result = await converterService.jsonToExcel(parsedData, outputPath);

      // Save output file to database
      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "EXCEL",
        fileSize: result.size,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        metadata: {
          convertedFrom: "JSON",
          conversionId: conversion.id,
        },
        processed: true,
      });

      // Update conversion record
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          outputFileId: outputFile.id,
          status: "COMPLETED",
        },
      });

      return ResponseFormatter.success(
        res,
        {
          conversionId: conversion.id,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            size: outputFile.fileSize,
            downloadUrl: `/api/converter/download/${outputFile.id}`,
          },
        },
        "JSON converted to Excel successfully",
      );
    } catch (error) {
      // Update conversion record with error
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Convert Excel to JSON
   * POST /api/converter/excel-to-json
   */
  excelToJson = asyncHandler(async (req, res) => {
    // Check if file was uploaded
    if (!req.file) {
      throw new ValidationError("Excel file is required");
    }

    const { file } = req;

    // Create conversion record
    const conversion = await prisma.conversion.create({
      data: {
        conversionType: "EXCEL_TO_JSON",
        status: "PROCESSING",
        options: {},
      },
    });

    try {
      // Save source file to database
      const sourceFile = await fileService.createFile({
        originalName: file.originalname,
        storedName: file.filename,
        filePath: file.path,
        fileType: "EXCEL",
        fileSize: file.size,
        mimeType: file.mimetype,
        metadata: {
          convertedTo: "JSON",
          conversionId: conversion.id,
        },
        processed: false,
      });

      // Convert Excel to JSON
      const jsonData = await converterService.excelToJson(file.path);

      // Save JSON to file
      const outputDir = path.join(__dirname, "../../uploads/conversions");
      await fs.ensureDir(outputDir);

      // const outputFileName = `${path.parse(file.originalname).name}.json`;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const baseName = path.parse(file.originalname).name;
      const outputFileName = `${baseName}-${uniqueSuffix}.json`;

      const outputPath = path.join(outputDir, outputFileName);

      await fs.writeJSON(outputPath, jsonData, { spaces: 2 });

      // Save output file to database
      const outputFile = await fileService.createFile({
        originalName: outputFileName,
        storedName: outputFileName,
        filePath: outputPath,
        fileType: "JSON",
        fileSize: (await fs.stat(outputPath)).size,
        mimeType: "application/json",
        metadata: {
          convertedFrom: "EXCEL",
          conversionId: conversion.id,
        },
        processed: true,
      });

      // Update conversion record
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          sourceFileId: sourceFile.id,
          outputFileId: outputFile.id,
          status: "COMPLETED",
        },
      });

      return ResponseFormatter.success(
        res,
        {
          conversionId: conversion.id,
          jsonData: jsonData,
          file: {
            id: outputFile.id,
            name: outputFile.originalName,
            size: outputFile.fileSize,
            downloadUrl: `/api/converter/download/${outputFile.id}`,
          },
        },
        "Excel converted to JSON successfully",
      );
    } catch (error) {
      // Update conversion record with error
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });
      throw error;
    }
  });

  /**
   * Download converted file
   * GET /api/converter/download/:fileId
   */
  downloadFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    // Get file from database
    const file = await fileService.getFileById(fileId);

    // Check if file exists on disk
    if (!(await fs.pathExists(file.filePath))) {
      throw new NotFoundError("File on disk", file.filePath);
    }

    // Set headers for download
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}"`,
    );

    // Stream file to response
    const fileStream = fs.createReadStream(file.filePath);
    fileStream.pipe(res);
  });

  /**
   * Get conversion info
   * GET /api/converter/:conversionId
   */
  getConversion = asyncHandler(async (req, res) => {
    const { conversionId } = req.params;

    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: {
        sourceFile: true,
        outputFile: true,
      },
    });

    if (!conversion) {
      throw new NotFoundError("Conversion", conversionId);
    }

    return ResponseFormatter.success(
      res,
      conversion,
      "Conversion retrieved successfully",
    );
  });

  /**
   * Delete conversion and files
   * DELETE /api/converter/:conversionId
   */
  deleteConversion = asyncHandler(async (req, res) => {
    const { conversionId } = req.params;

    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: {
        sourceFile: true,
        outputFile: true,
      },
    });

    if (!conversion) {
      throw new NotFoundError("Conversion", conversionId);
    }

    // Delete files from disk
    if (
      conversion.sourceFile &&
      (await fs.pathExists(conversion.sourceFile.filePath))
    ) {
      await fs.remove(conversion.sourceFile.filePath);
    }

    if (
      conversion.outputFile &&
      (await fs.pathExists(conversion.outputFile.filePath))
    ) {
      await fs.remove(conversion.outputFile.filePath);
    }

    // Delete conversion (will cascade delete file records)
    await prisma.conversion.delete({
      where: { id: conversionId },
    });

    return ResponseFormatter.success(
      res,
      null,
      "Conversion deleted successfully",
    );
  });
}

module.exports = new ConverterController();
