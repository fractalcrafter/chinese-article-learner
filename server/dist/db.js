import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
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
// Simple password hashing (for family use - not production grade)
export function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
export function verifyPassword(password, hash) {
    return hashPassword(password) === hash;
}
// Initialize database schema
export function initDatabase() {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    // Create tables
    db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_emoji TEXT DEFAULT '🐵',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Articles table
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      transcription_original TEXT,
      transcription_edited TEXT,
      summary TEXT,
      sentences_json TEXT,
      created_by INTEGER REFERENCES users(id),
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

    -- User article progress
    CREATE TABLE IF NOT EXISTS user_article_progress (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      completed BOOLEAN DEFAULT FALSE,
      sentences_read INTEGER DEFAULT 0,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, article_id)
    );

    -- User vocabulary progress  
    CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'learning',  -- 'learning', 'reviewing', 'mastered'
      times_reviewed INTEGER DEFAULT 0,
      times_correct INTEGER DEFAULT 0,
      last_reviewed DATETIME,
      PRIMARY KEY (user_id, vocabulary_id)
    );
  `);
    console.log('📚 Database initialized');
}
// ============ User functions ============
export function createUser(name, password, avatarEmoji = '🐵') {
    const hash = hashPassword(password);
    const stmt = db.prepare(`
    INSERT INTO users (name, password_hash, avatar_emoji)
    VALUES (?, ?, ?)
  `);
    const result = stmt.run(name, hash, avatarEmoji);
    return result.lastInsertRowid;
}
export function getUserByName(name) {
    return db.prepare('SELECT * FROM users WHERE name = ?').get(name);
}
export function getUserById(id) {
    return db.prepare('SELECT id, name, avatar_emoji, created_at FROM users WHERE id = ?').get(id);
}
export function getAllUsers() {
    return db.prepare('SELECT id, name, avatar_emoji, created_at FROM users').all();
}
export function authenticateUser(name, password) {
    const user = getUserByName(name);
    if (!user)
        return null;
    if (!verifyPassword(password, user.password_hash))
        return null;
    return { id: user.id, name: user.name, avatar_emoji: user.avatar_emoji };
}
// ============ Progress functions ============
export function updateArticleProgress(userId, articleId, data) {
    // Upsert progress
    const existing = db.prepare('SELECT * FROM user_article_progress WHERE user_id = ? AND article_id = ?').get(userId, articleId);
    if (existing) {
        const fields = ['last_accessed = CURRENT_TIMESTAMP'];
        const values = [];
        if (data.completed !== undefined) {
            fields.push('completed = ?');
            values.push(data.completed ? 1 : 0);
        }
        if (data.sentences_read !== undefined) {
            fields.push('sentences_read = ?');
            values.push(data.sentences_read);
        }
        values.push(userId, articleId);
        db.prepare(`
      UPDATE user_article_progress SET ${fields.join(', ')}
      WHERE user_id = ? AND article_id = ?
    `).run(...values);
    }
    else {
        db.prepare(`
      INSERT INTO user_article_progress (user_id, article_id, completed, sentences_read)
      VALUES (?, ?, ?, ?)
    `).run(userId, articleId, data.completed ? 1 : 0, data.sentences_read || 0);
    }
}
export function getArticleProgress(userId, articleId) {
    return db.prepare('SELECT * FROM user_article_progress WHERE user_id = ? AND article_id = ?').get(userId, articleId);
}
export function getUserProgress(userId) {
    const articleProgress = db.prepare(`
    SELECT 
      COUNT(*) as total_articles,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_articles,
      SUM(sentences_read) as total_sentences_read
    FROM user_article_progress
    WHERE user_id = ?
  `).get(userId);
    const vocabProgress = db.prepare(`
    SELECT 
      COUNT(*) as total_vocab,
      SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered_vocab,
      SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing_vocab,
      SUM(times_reviewed) as total_reviews
    FROM user_vocabulary_progress
    WHERE user_id = ?
  `).get(userId);
    return {
        articles: articleProgress,
        vocabulary: vocabProgress
    };
}
export function updateVocabularyProgress(userId, vocabularyId, correct) {
    const existing = db.prepare('SELECT * FROM user_vocabulary_progress WHERE user_id = ? AND vocabulary_id = ?').get(userId, vocabularyId);
    if (existing) {
        const timesReviewed = existing.times_reviewed + 1;
        const timesCorrect = existing.times_correct + (correct ? 1 : 0);
        // Determine status based on accuracy
        const accuracy = timesCorrect / timesReviewed;
        let status = 'learning';
        if (timesReviewed >= 3 && accuracy >= 0.8) {
            status = 'mastered';
        }
        else if (timesReviewed >= 2 && accuracy >= 0.5) {
            status = 'reviewing';
        }
        db.prepare(`
      UPDATE user_vocabulary_progress 
      SET times_reviewed = ?, times_correct = ?, status = ?, last_reviewed = CURRENT_TIMESTAMP
      WHERE user_id = ? AND vocabulary_id = ?
    `).run(timesReviewed, timesCorrect, status, userId, vocabularyId);
    }
    else {
        db.prepare(`
      INSERT INTO user_vocabulary_progress (user_id, vocabulary_id, times_reviewed, times_correct, status, last_reviewed)
      VALUES (?, ?, 1, ?, 'learning', CURRENT_TIMESTAMP)
    `).run(userId, vocabularyId, correct ? 1 : 0);
    }
}
// Helper function to get article by ID
export function getArticleById(id) {
    return db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
}
// Helper function to create article
export function createArticle(data) {
    const stmt = db.prepare(`
    INSERT INTO articles (title, transcription_original, transcription_edited)
    VALUES (?, ?, ?)
  `);
    const result = stmt.run(data.title || null, data.transcription_original, data.transcription_edited || data.transcription_original);
    return result.lastInsertRowid;
}
// Helper function to update article
export function updateArticle(id, data) {
    const fields = [];
    const values = [];
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
    if (fields.length === 0)
        return;
    values.push(id);
    const stmt = db.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}
// Helper function to get or create vocabulary
export function getOrCreateVocabulary(chinese) {
    let vocab = db.prepare('SELECT * FROM vocabulary WHERE chinese = ?').get(chinese);
    if (!vocab) {
        const stmt = db.prepare('INSERT INTO vocabulary (chinese) VALUES (?)');
        const result = stmt.run(chinese);
        vocab = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(result.lastInsertRowid);
    }
    return vocab;
}
// Helper function to update vocabulary
export function updateVocabulary(id, data) {
    const fields = [];
    const values = [];
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
    if (fields.length === 0)
        return;
    values.push(id);
    const stmt = db.prepare(`UPDATE vocabulary SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}
// Link vocabulary to article
export function linkVocabularyToArticle(articleId, vocabularyId) {
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO article_vocabulary (article_id, vocabulary_id)
    VALUES (?, ?)
  `);
    stmt.run(articleId, vocabularyId);
}
// Get vocabulary for article
export function getVocabularyForArticle(articleId) {
    return db.prepare(`
    SELECT v.* FROM vocabulary v
    JOIN article_vocabulary av ON v.id = av.vocabulary_id
    WHERE av.article_id = ?
  `).all(articleId);
}
