import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import articlesRouter from './routes/articles.js';
import vocabularyRouter from './routes/vocabulary.js';
// Load environment variables
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
// Initialize database
initDatabase();
// API Routes
app.use('/api/articles', articlesRouter);
app.use('/api/vocabulary', vocabularyRouter);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Serve static files from React build (for production)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));
// Handle React routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});
// Start server
app.listen(PORT, () => {
    console.log(`🐵 Monkey server running on http://localhost:${PORT}`);
});
