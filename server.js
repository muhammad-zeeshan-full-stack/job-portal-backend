import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import errorHandler from './middleware/error.js';

// Routes
import authRoutes from './routes/auth.js';

// Load env variables
dotenv.config();

// Connect Database
connectDB();

const app = express();

/* =========================
   ✅ CORS (سب سے اوپر)
========================= */
app.use(cors({
  origin: 'https://job-portal-frontend-lovat-alpha.vercel.app',
  credentials: true,
}));

// ✅ Preflight request allow (بہت ضروری)
app.options('*', cors());

/* =========================
   Middlewares
========================= */

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Security
app.use(mongoSanitize());
app.use(helmet());
app.use(xss());

// Rate Limiter
app.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
}));

/* =========================
   Routes
========================= */
app.use('/api/auth', authRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('MERN Backend Running');
});

/* =========================
   Error Handler
========================= */
app.use(errorHandler);

/* =========================
   Server Start
========================= */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/* =========================
   Unhandled Rejection
========================= */
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
