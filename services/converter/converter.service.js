const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs-extra");
const {
  ValidationError,
  NotFoundError,
  FileProcessingError,
} = require("../../utils/errors");

class ConverterService {
  /**
   * Convert JSON to Excel
   * @param {Object|Array} jsonData - JSON data to convert
   * @param {String} outputPath - Path to save Excel file
   * @param {Object} options - Conversion options
   * @returns {Object} - File info
   */
  async jsonToExcel(jsonData, outputPath, options = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Converter Service";
      workbook.created = new Date();

      // Handle different JSON structures
      if (Array.isArray(jsonData)) {
        // Simple array of objects
        this.addArrayToWorksheet(workbook, jsonData, "Sheet1", options);
      } else if (typeof jsonData === "object") {
        // Object with multiple arrays (multiple sheets)
        Object.keys(jsonData).forEach((key) => {
          const data = jsonData[key];
          if (Array.isArray(data)) {
            this.addArrayToWorksheet(workbook, data, key, options);
          }
        });
      } else {
        throw new ValidationError(
          "Invalid JSON structure. Expected array or object.",
        );
      }

      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));

      // Save workbook
      await workbook.xlsx.writeFile(outputPath);

      return {
        filePath: outputPath,
        fileName: path.basename(outputPath),
        size: (await fs.stat(outputPath)).size,
      };
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      throw new FileProcessingError(
        `Failed to convert JSON to Excel: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Add array data to worksheet
   */
  addArrayToWorksheet(workbook, data, sheetName, options = {}) {
    if (!data || data.length === 0) {
      const worksheet = workbook.addWorksheet(sheetName);
      worksheet.addRow(["No data"]);
      return;
    }

    const worksheet = workbook.addWorksheet(sheetName);

    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Add header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Add data rows
    data.forEach((item) => {
      const row = headers.map((header) => {
        const value = item[header];

        // Handle nested objects/arrays
        if (typeof value === "object" && value !== null) {
          return JSON.stringify(value);
        }

        return value;
      });
      worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) {
          maxLength = length;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Freeze header row
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  /**
   * Convert Excel to JSON
   * @param {String} filePath - Path to Excel file
   * @param {Object} options - Conversion options
   * @returns {Object|Array} - JSON data
   */
  async excelToJson(filePath, options = {}) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("File", filePath);
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheets = {};
      const singleSheetData = [];

      workbook.eachSheet((worksheet, sheetId) => {
        const sheetData = [];
        let headers = [];

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) {
            headers = row.values.slice(1);
            return;
          }

          const rowData = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1] || `column${colNumber}`;
            let value = cell.value;

            if (cell.type === ExcelJS.ValueType.Formula) {
              value = cell.result;
            } else if (cell.type === ExcelJS.ValueType.Date) {
              value = cell.value.toISOString();
            } else if (cell.type === ExcelJS.ValueType.Hyperlink) {
              value = cell.value.text || cell.value.hyperlink;
            }

            if (
              typeof value === "string" &&
              (value.startsWith("{") || value.startsWith("["))
            ) {
              try {
                value = JSON.parse(value);
              } catch {}
            }

            rowData[header] = value;
          });

          sheetData.push(rowData);
        });

        if (workbook.worksheets.length > 1) {
          sheets[worksheet.name] = sheetData;
        } else {
          singleSheetData.push(...sheetData);
        }
      });

      return workbook.worksheets.length > 1 ? sheets : singleSheetData;
    } catch (error) {
      if (error.isOperational) throw error;

      throw new FileProcessingError(
        `Failed to convert Excel to JSON: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Flatten nested JSON (helper function)
   */
  flattenJson(obj, prefix = "") {
    let result = {};

    for (const key in obj) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        Object.assign(result, this.flattenJson(value, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }
}

module.exports = new ConverterService();
