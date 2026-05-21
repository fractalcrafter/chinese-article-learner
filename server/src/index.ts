import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import { seedInitialData } from './seed.js';
import articlesRouter from './routes/articles.js';
import vocabularyRouter from './routes/vocabulary.js';
import authRouter from './routes/auth.js';
import setsRouter from './routes/sets.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / non-browser (no Origin header), explicit allowlist,
    // and any Azure Web Apps origin (covers monkeymonkey.azurewebsites.net etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (/^https?:\/\/[^/]+\.azurewebsites\.net$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Initialize database
initDatabase();
seedInitialData();

// API Routes
app.use('/api/articles', articlesRouter);
app.use('/api/vocabulary', vocabularyRouter);
app.use('/api/auth', authRouter);
app.use('/api/sets', setsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React build (for production)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Handle React routing - serve index.html for all non-API routes
// Note: Express 5.x requires '/{*splat}' instead of '*' for catch-all routes
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🐵 Monkey server running on http://localhost:${PORT}`);
});
