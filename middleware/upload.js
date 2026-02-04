const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { ValidationError } = require("../utils/errors");

// Ensure upload directories exist
const uploadDir = path.join(__dirname, "../uploads/excel/temp");
fs.ensureDirSync(uploadDir);

/**
 * Configure storage for excel files
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
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
  // Allowed extensions
  const allowedExtensions = [".xlsx", ".xls", ".csv", ".xlsm", ".xlsb"];
  const ext = path.extname(file.originalname).toLocaleLowerCase();

  // Allowed MIME types
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv", // .csv
    "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12", // .xlsb
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
          receiveExtension: ext,
          receiveMimeType: file.mimetype,
        }
      ),
      false
    );
  }
};

/**
 * Multer upload configuration for excel files
 */
const uploadExcel = multer({
  storage: storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
}).single("file"); // 'file' is the field name in form data

module.exports = {
  uploadExcel,
};
