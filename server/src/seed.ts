import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SeedItem {
  chinese: string;
  pinyin: string | null;
  english: string | null;
  example_sentence: string | null;
  emoji: string | null;
  position: number;
}

interface SeedSet {
  title: string;
  description: string | null;
  items: SeedItem[];
}

/**
 * Seed the database with the bundled study set if it doesn't already exist.
 * Idempotent — safe to call on every boot.
 */
export function seedInitialData() {
  try {
    const seedPath = path.join(__dirname, 'seed-data.json');
    if (!fs.existsSync(seedPath)) {
      console.log('🌱 No seed-data.json found, skipping seed');
      return;
    }

    const seed: SeedSet = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

    const existing = db.prepare('SELECT id FROM study_sets WHERE title = ?').get(seed.title) as any;
    if (existing) {
      console.log(`🌱 Seed set "${seed.title}" already exists (id=${existing.id}), skipping`);
      return;
    }

    const insertSet = db.prepare(
      'INSERT INTO study_sets (title, description) VALUES (?, ?)'
    );
    const getVocabByChinese = db.prepare('SELECT * FROM vocabulary WHERE chinese = ?');
    const insertVocab = db.prepare('INSERT INTO vocabulary (chinese) VALUES (?)');
    const updateVocab = db.prepare(
      'UPDATE vocabulary SET pinyin = ?, english = ?, example_sentence = ?, emoji = ? WHERE id = ?'
    );
    const linkItem = db.prepare(
      'INSERT OR IGNORE INTO study_set_vocab (set_id, vocabulary_id, position) VALUES (?, ?, ?)'
    );

    const tx = db.transaction(() => {
      const setResult = insertSet.run(seed.title, seed.description);
      const setId = Number(setResult.lastInsertRowid);

      for (const item of seed.items) {
        let vocab = getVocabByChinese.get(item.chinese) as any;
        if (!vocab) {
          const r = insertVocab.run(item.chinese);
          vocab = getVocabByChinese.get(item.chinese);
          if (!vocab) {
            vocab = { id: Number(r.lastInsertRowid) };
          }
        }
        updateVocab.run(
          item.pinyin ?? vocab.pinyin ?? null,
          item.english ?? vocab.english ?? null,
          item.example_sentence ?? vocab.example_sentence ?? null,
          item.emoji ?? vocab.emoji ?? null,
          vocab.id
        );
        linkItem.run(setId, vocab.id, item.position);
      }

      return setId;
    });

    const setId = tx();
    console.log(`🌱 Seeded "${seed.title}" with ${seed.items.length} items (set id=${setId})`);
  } catch (e) {
    console.error('🌱 Seed failed (continuing):', e);
  }
}
