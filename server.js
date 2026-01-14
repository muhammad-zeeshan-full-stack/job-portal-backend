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
import authRoutes from './routes/auth.js';
import logger from './middleware/logger.js';

dotenv.config();
connectDB();

const app = express();

// ✅ CORS (سب سے اوپر)
app.use(cors({
  origin: 'https://job-portal-frontend-lovat-alpha.vercel.app',
  credentials: true,
}));
app.options('*', cors());

// Parsers
app.use(express.json());
app.use(cookieParser());

// Security
app.use(mongoSanitize());
app.use(helmet());
app.use(xss());
app.use(logger);
// Rate limit
app.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
}));

// Routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('MERN Backend Running');
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
