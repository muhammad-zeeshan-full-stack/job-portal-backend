import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// ========================
// CRITICAL: Load environment variables FIRST
// ========================
console.log("🔍 [DEBUG] ===== LOADING ENVIRONMENT VARIABLES =====");
dotenv.config({ path: ".env" });

// Debug all critical env vars
console.log("✅ [DEBUG] Environment variables loaded:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "***SET***" : "MISSING");
console.log("SMTP_USER:", process.env.SMTP_USER ? "***SET***" : "MISSING");
console.log("SMTP_PASS:", process.env.SMTP_PASS ? "***SET***" : "MISSING");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "***SET***" : "MISSING");

// ========================
// Now import other modules AFTER env vars are loaded
// ========================
import connectDB from "./config/db.js";
import errorHandler from "./middleware/error.js";
import authRoutes from "./routes/auth.js";

// Connect to DB
console.log("\n🔍 [DEBUG] ===== CONNECTING TO DATABASE =====");
connectDB().catch((err) => {
  console.error("❌ [DEBUG] MongoDB connection failed:", err.message);
  process.exit(1);
});

const app = express();

// ✅ CORS Configuration
const allowedOrigins = [
  "https://job-portal-frontend-lovat-alpha.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

console.log("\n🔍 [DEBUG] CORS Allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log(`✅ [DEBUG] CORS allowed for origin: ${origin}`);
        callback(null, true);
      } else {
        console.log(`❌ [DEBUG] CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Handle preflight requests
app.options("*", cors());

// Request logging middleware
// Add detailed request logging
app.use((req, res, next) => {
  console.log(`\n📨 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('📦 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Query:', JSON.stringify(req.query, null, 2));
  
  // Clone body to avoid issues with JSON parsing
  const bodyClone = { ...req.body };
  if (bodyClone.password) bodyClone.password = '***HIDDEN***';
  console.log('📦 Body:', JSON.stringify(bodyClone, null, 2));
  
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware
app.use(mongoSanitize());
app.use(helmet());
app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later",
});
app.use("/api/", limiter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "job-portal-backend",
    environment: process.env.NODE_ENV,
    node_version: process.version,
    email_configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

// Test endpoints
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
    env_vars: {
      smtp_user: process.env.SMTP_USER ? "set" : "missing",
      smtp_pass: process.env.SMTP_PASS ? "set" : "missing",
    },
  });
});

// Test email endpoint
app.get("/api/test-email", async (req, res) => {
  try {
    // Dynamically import email module AFTER env vars are loaded
    const { default: sendEmail } = await import("./config/email.js");

    const result = await sendEmail({
      email: "test@example.com",
      subject: "Test Email",
      message: "This is a test email from Job Portal Backend",
    });

    res.json({
      success: true,
      message: "Email test completed",
      result: result,
    });
  } catch (error) {
    console.error("Email test error:", error);
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error.message,
    });
  }
});

// Test database endpoint
app.get("/api/test-db", async (req, res) => {
  try {
    const User = (await import("./models/User.js")).default;
    const userCount = await User.countDocuments();
    res.json({
      success: true,
      message: "Database connection successful",
      userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// API Routes
app.use("/api/auth", authRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n✅ [DEBUG] ===== SERVER STARTED =====`);
  console.log(`✅ [DEBUG] Server running on port ${PORT}`);
  console.log(`✅ [DEBUG] Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ [DEBUG] CORS enabled for: ${allowedOrigins.join(", ")}`);
  console.log(
    `✅ [DEBUG] Email configured: ${!!(
      process.env.SMTP_USER && process.env.SMTP_PASS
    )}`
  );
});

process.on("unhandledRejection", (err) => {
  console.error("❌ [DEBUG] Unhandled Rejection:", err.message);
  server.close(() => process.exit(1));
});
