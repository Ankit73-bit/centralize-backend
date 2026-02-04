const prisma = require("../../config/database");
const { DatabaseError, NotFoundError } = require("../../utils/errors");

class FileService {
  /**
   * Create a new file record in database
   */
  async createFile(fileData) {
    try {
      const file = await prisma.file.create({
        data: {
          originalName: fileData.originalName,
          storedName: fileData.storedName,
          filePath: fileData.filePath,
          fileType: fileData.fileType,
          fileSize: fileData.fileSize,
          mimeType: fileData.mimeType,
          metadata: fileData.metadata || {},
          processed: fileData.processed || false,
        },
      });

      return file;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create file record: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId) {
    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
        include: {
          processLogs: {
            orderBy: { startTime: "desc" },
            take: 10,
          },
          tags: true,
        },
      });

      if (!file) {
        throw new NotFoundError("File", fileId);
      }

      return file;
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      throw new DatabaseError(`Failed to retrieve file: ${error.message}`, {
        fileId,
        originalError: error.message,
      });
    }
  }

  /**
   * Get file by stored name
   */
  async getFileByStoredName(storedName) {
    try {
      const file = await prisma.file.findUnique({
        where: { storedName },
        include: {
          processLogs: {
            orderBy: { startTime: "desc" },
            take: 10,
          },
          tags: true,
        },
      });

      if (!file) {
        throw new NotFoundError("File", storedName);
      }

      return file;
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      throw new DatabaseError(`Failed to retrieve file: ${error.message}`, {
        storedName,
        originalError: error.message,
      });
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(fileId, updateData) {
    try {
      const file = await prisma.file.update({
        where: { id: fileId },
        data: updateData,
      });

      return file;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("File", fileId);
      }
      throw new DatabaseError(`Failed to update file: ${error.message}`, {
        fileId,
        originalError: error.message,
      });
    }
  }

  /**
   * Delete file record
   */
  async deleteFile(fileId) {
    try {
      const file = await prisma.file.delete({
        where: { id: fileId },
      });

      return file;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("File", fileId);
      }
      throw new DatabaseError(`Failed to delete file: ${error.message}`, {
        fileId,
        originalError: error.message,
      });
    }
  }

  /**
   * Get all files with filters
   */
  async getFiles(filters = {}) {
    try {
      const {
        fileType,
        processed,
        page = 1,
        limit = 10,
        sortBy = "uploadDate",
        sortOrder = "desc",
      } = filters;

      const where = {};
      if (fileType) where.fileType = fileType;
      if (processed !== undefined) where.processed = processed;

      const [files, total] = await Promise.all([
        prisma.file.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            tags: true,
          },
        }),
        prisma.file.count({ where }),
      ]);

      return {
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(`Failed to retrieve files: ${error.message}`, {
        filters,
        originalError: error.message,
      });
    }
  }

  /**
   * Create processing log
   */
  async createProcessLog(logData) {
    try {
      const log = await prisma.processingLog.create({
        data: {
          fileId: logData.fileId,
          operationType: logData.operationType,
          status: logData.status,
          startTime: logData.startTime || new Date(),
          endTime: logData.endTime,
          errorMessage: logData.errorMessage,
          details: logData.details || {},
        },
      });

      return log;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create processing log: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /**
   * Update processing log
   */
  async updateProcessLog(logId, updateData) {
    try {
      const log = await prisma.processingLog.update({
        where: { id: logId },
        data: updateData,
      });

      return log;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Processing log", logId);
      }
      throw new DatabaseError(
        `Failed to update processing log: ${error.message}`,
        { logId, originalError: error.message },
      );
    }
  }

  /**
   * Add tag to file
   */
  async addTag(fileId, tag) {
    try {
      const fileTag = await prisma.fileTag.create({
        data: {
          fileId,
          tag,
        },
      });

      return fileTag;
    } catch (error) {
      if (error.code === "P2002") {
        throw new DatabaseError("Tag already exists for this file", {
          fileId,
          tag,
        });
      }
      throw new DatabaseError(`Failed to add tag: ${error.message}`, {
        fileId,
        tag,
        originalError: error.message,
      });
    }
  }

  /**
   * Remove tag from file
   */
  async removeTag(fileId, tag) {
    try {
      await prisma.fileTag.deleteMany({
        where: {
          fileId,
          tag,
        },
      });

      return true;
    } catch (error) {
      throw new DatabaseError(`Failed to remove tag: ${error.message}`, {
        fileId,
        tag,
        originalError: error.message,
      });
    }
  }
}

module.exports = new FileService();
