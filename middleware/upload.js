const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { ValidationError } = require("../utils/errors");

// Ensure upload directories exist
const excelUploadDir = path.join(__dirname, "../uploads/excel/temp");
const pdfUploadDir = path.join(__dirname, "../uploads/pdf/temp");
fs.ensureDirSync(excelUploadDir);
fs.ensureDirSync(pdfUploadDir);

/**
 * Configure storage for Excel files
 */
const excelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, excelUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

/**
 * Configure storage for PDF files
 */
const pdfStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, pdfUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter - only allow Excel files
 */
const excelFileFilter = (req, file, cb) => {
  const allowedExtensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];
  const ext = path.extname(file.originalname).toLowerCase();

  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
  ];

  if (
    allowedExtensions.includes(ext) ||
    allowedMimeTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        "Invalid file type. Only Excel files (.xlsx, .xls, .csv, .xlsm, .xlsb) are allowed",
        {
          receivedExtension: ext,
          receivedMimeType: file.mimetype,
        },
      ),
      false,
    );
  }
};

/**
 * File filter - only allow PDF files
 */
const pdfFileFilter = (req, file, cb) => {
  const allowedExtensions = [".pdf"];
  const ext = path.extname(file.originalname).toLowerCase();

  const allowedMimeTypes = ["application/pdf"];

  if (
    allowedExtensions.includes(ext) ||
    allowedMimeTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      new ValidationError("Invalid file type. Only PDF files are allowed", {
        receivedExtension: ext,
        receivedMimeType: file.mimetype,
      }),
      false,
    );
  }
};

/**
 * File filter - allow PDF and document files
 */
const pdfAndDocFileFilter = (req, file, cb) => {
  const allowedExtensions = [".pdf", ".docx", ".txt"];
  const ext = path.extname(file.originalname).toLowerCase();

  const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  if (
    allowedExtensions.includes(ext) ||
    allowedMimeTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        "Invalid file type. Only PDF, DOCX, and TXT files are allowed",
        {
          receivedExtension: ext,
          receivedMimeType: file.mimetype,
        },
      ),
      false,
    );
  }
};

/**
 * Multer upload configuration for Excel files
 */
const uploadExcel = multer({
  storage: excelStorage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single("file");

/**
 * Multer upload configuration for single PDF
 */
const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
}).single("file");

/**
 * Multer upload configuration for multiple PDFs
 */
const uploadMultiplePdfs = multer({
  storage: pdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 20, // Maximum 20 files
  },
}).array("files", 20);

/**
 * Multer upload configuration for PDF and document files
 */
const uploadPdfOrDoc = multer({
  storage: pdfStorage,
  fileFilter: pdfAndDocFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single("file");

module.exports = {
  uploadExcel,
  uploadPdf,
  uploadMultiplePdfs,
  uploadPdfOrDoc,
};
