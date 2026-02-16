require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// Middleware
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

// Routes
const excelRoutes = require("./routes/excel/excel.routes");
const converterRoutes = require("./routes/converter/converter.routes");
const pdfRoutes = require("./routes/pdf/pdf.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/excel", excelRoutes);
app.use("/api/converter", converterRoutes);
app.use("/api/pdf", pdfRoutes);

// 404 Handler
app.use(notFound);

// Error Handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
