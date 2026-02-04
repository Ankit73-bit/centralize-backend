const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Middleware
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

// Routes
const excelRoutes = require("./routes/excel/excel.routes");
const converterRoutes = require("./routes/converter/converter.routes");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

console.log(typeof process.env.DATABASE_URL);
console.log(process.env.DATABASE_URL);

// middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increased limit for JSON data
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files (for serving uploaded files if needed)
app.use("./uploads", express.static(path.join(__dirname, "uploads")));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timeStamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/excel", excelRoutes);
app.use("/api/converter", converterRoutes);

// 404 Handler - Must be after all routes
app.use(notFound);

// Error Handler - Must be lasrt
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
