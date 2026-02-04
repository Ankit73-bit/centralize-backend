const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs-extra");
const {
  ValidationError,
  NotFoundError,
  FileProcessingError,
} = require("../../utils/errors");

class ExcelService {
  /**
   * Read Excel file and convert to JSON
   * @param {String} filePath - Path to Excel file
   * @returns {Object} - Excel data in JSON format
   */
  async readExcelFile(filePath) {
    try {
      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("File", filePath);
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const result = {
        fileName: path.basename(filePath),
        sheets: [],
        metadata: {
          totalSheets: workbook.worksheets.length,
          // creator: workbook.creator,
          // lastModifiedBy: workbook.lastModifiedBy,
          created: workbook.created,
          modified: workbook.modified,
        },
      };

      // Process each worksheet
      workbook.eachSheet((worksheet, sheetId) => {
        const sheetData = {
          id: sheetId,
          name: worksheet.name,
          rowCount: worksheet.rowCount,
          columnCount: worksheet.columnCount,
          data: [],
          mergedCells: [],
          formatting: [],
        };

        // Get all rows including empty ones
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          const rowData = [];

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const cellData = {
              value: this.getCellValue(cell),
              address: cell.address,
              row: rowNumber,
              col: colNumber,
              type: cell.type,
            };

            // Preserve formatting
            if (cell.style) {
              cellData.style = {
                font: cell.font,
                alignment: cell.alignment,
                fill: cell.fill,
                border: cell.border,
                numFmt: cell.numFmt,
              };
            }

            rowData.push(cellData);
          });

          sheetData.data.push(rowData);
        });

        // Get merged cells info
        if (worksheet.model.merges) {
          sheetData.mergedCells = worksheet.model.merges;
        }

        result.sheets.push(sheetData);
      });

      return result;
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      throw new FileProcessingError(
        `Failed to read Excel file: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Get cell value handling different types
   */
  getCellValue(cell) {
    if (cell.value === null || cell.value === undefined) {
      return null;
    }

    // Handle formula cells
    if (cell.type === ExcelJS.ValueType.Formula) {
      return cell.result || cell.value.result;
    }

    // Handle rich text
    if (cell.type === ExcelJS.ValueType.RichText) {
      return cell.value.richText.map((t) => t.text).join("");
    }

    // Handle hyperlinks
    if (cell.type === ExcelJS.ValueType.Hyperlink) {
      return cell.value.text || cell.value.hyperlink;
    }

    // Handle dates
    if (cell.type === ExcelJS.ValueType.Date) {
      return cell.value.toISOString();
    }

    return cell.value;
  }

  /**
   * Write JSON data to Excel file
   * @param {String} filePath - Path to existing Excel file
   * @param {Object} data - JSON data to write
   * @param {String} outputPath - Path to save updated file
   * @returns {Object} - Updated file info
   */
  async writeExcelFile(filePath, data, outputPath) {
    try {
      // Check if source file exists
      if (!(await fs.pathExists(filePath))) {
        throw new NotFoundError("File", filePath);
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Update each sheet
      if (data.sheets && Array.isArray(data.sheets)) {
        data.sheets.forEach((sheetData) => {
          const worksheet = workbook.getWorksheet(
            sheetData.name || sheetData.id,
          );

          if (!worksheet) {
            throw new ValidationError(
              `Sheet '${sheetData.name || sheetData.id}' not found`,
              { availableSheets: workbook.worksheets.map((ws) => ws.name) },
            );
          }

          // Clear existing data (optional - based on your needs)
          // worksheet.spliceRows(1, worksheet.rowCount);

          // Write new data
          if (sheetData.data && Array.isArray(sheetData.data)) {
            sheetData.data.forEach((row, rowIndex) => {
              const excelRow = worksheet.getRow(rowIndex + 1);

              row.forEach((cellData, colIndex) => {
                const cell = excelRow.getCell(colIndex + 1);

                // Set value
                if (cellData.value !== undefined && cellData.value !== null) {
                  cell.value = cellData.value;
                }

                // Apply formatting if provided
                if (cellData.style) {
                  cell.style = cellData.style;
                }
              });

              excelRow.commit();
            });
          }
        });
      }

      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));

      // Save the workbook
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
        `Failed to write Excel file: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Create new Excel file from JSON data
   * @param {Object} data - JSON data
   * @param {String} outputPath - Path to save new file
   * @returns {Object} - File info
   */
  async createExcelFile(data, outputPath) {
    try {
      const workbook = new ExcelJS.Workbook();

      // Set workbook properties
      workbook.creator = "Excel Editor Service";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Create sheets
      if (data.sheets && Array.isArray(data.sheets)) {
        data.sheets.forEach((sheetData) => {
          const worksheet = workbook.addWorksheet(sheetData.name || "Sheet1");

          // Write data
          if (sheetData.data && Array.isArray(sheetData.data)) {
            sheetData.data.forEach((row, rowIndex) => {
              const excelRow = worksheet.getRow(rowIndex + 1);

              row.forEach((cellData, colIndex) => {
                const cell = excelRow.getCell(colIndex + 1);
                cell.value = cellData.value || cellData;

                if (cellData.style) {
                  cell.style = cellData.style;
                }
              });

              excelRow.commit();
            });
          }
        });
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
      throw new FileProcessingError(
        `Failed to create Excel file: ${error.message}`,
        { originalError: error.message },
      );
    }
  }
}

module.exports = new ExcelService();
