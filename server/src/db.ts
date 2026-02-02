import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use Azure persistent storage if available, otherwise local
const isAzure = process.env.WEBSITE_INSTANCE_ID !== undefined;
const dataDir = isAzure ? '/home/data' : path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'monkey.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
export const db = new Database(dbPath);

// Initialize database schema
export function initDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Articles table
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      transcription_original TEXT,
      transcription_edited TEXT,
      summary TEXT,
      sentences_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Vocabulary table
    CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chinese TEXT NOT NULL UNIQUE,
      pinyin TEXT,
      english TEXT,
      example_sentence TEXT,
      emoji TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Article-Vocabulary junction table
    CREATE TABLE IF NOT EXISTS article_vocabulary (
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, vocabulary_id)
    );
  `);

  console.log('📚 Database initialized');
}

// Helper function to get article by ID
export function getArticleById(id: number) {
  return db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
}

// Helper function to create article
export function createArticle(data: {
  title?: string;
  transcription_original: string;
  transcription_edited?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO articles (title, transcription_original, transcription_edited)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    data.title || null,
    data.transcription_original,
    data.transcription_edited || data.transcription_original
  );
  return result.lastInsertRowid;
}

// Helper function to update article
export function updateArticle(id: number, data: {
  title?: string;
  transcription_edited?: string;
  summary?: string;
  sentences_json?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(data.title);
  }
  if (data.transcription_edited !== undefined) {
    fields.push('transcription_edited = ?');
    values.push(data.transcription_edited);
  }
  if (data.summary !== undefined) {
    fields.push('summary = ?');
    values.push(data.summary);
  }
  if (data.sentences_json !== undefined) {
    fields.push('sentences_json = ?');
    values.push(data.sentences_json);
  }

  if (fields.length === 0) return;

  values.push(id);
  const stmt = db.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

// Helper function to get or create vocabulary
export function getOrCreateVocabulary(chinese: string) {
  let vocab = db.prepare('SELECT * FROM vocabulary WHERE chinese = ?').get(chinese);
  
  if (!vocab) {
    const stmt = db.prepare('INSERT INTO vocabulary (chinese) VALUES (?)');
    const result = stmt.run(chinese);
    vocab = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(result.lastInsertRowid);
  }
  
  return vocab;
}

// Helper function to update vocabulary
export function updateVocabulary(id: number, data: {
  pinyin?: string;
  english?: string;
  example_sentence?: string;
  emoji?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.pinyin !== undefined) {
    fields.push('pinyin = ?');
    values.push(data.pinyin);
  }
  if (data.english !== undefined) {
    fields.push('english = ?');
    values.push(data.english);
  }
  if (data.example_sentence !== undefined) {
    fields.push('example_sentence = ?');
    values.push(data.example_sentence);
  }
  if (data.emoji !== undefined) {
    fields.push('emoji = ?');
    values.push(data.emoji);
  }

  if (fields.length === 0) return;

  values.push(id);
  const stmt = db.prepare(`UPDATE vocabulary SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

// Link vocabulary to article
export function linkVocabularyToArticle(articleId: number, vocabularyId: number) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO article_vocabulary (article_id, vocabulary_id)
    VALUES (?, ?)
  `);
  stmt.run(articleId, vocabularyId);
}

// Get vocabulary for article
export function getVocabularyForArticle(articleId: number) {
  return db.prepare(`
    SELECT v.* FROM vocabulary v
    JOIN article_vocabulary av ON v.id = av.vocabulary_id
    WHERE av.article_id = ?
  `).all(articleId);
}
