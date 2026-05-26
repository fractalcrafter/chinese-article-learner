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
 * Seed the database with any bundled study sets that don't already exist.
 * Loads every `seed-data*.json` file next to this module. Idempotent —
 * safe to call on every boot.
 */
export function seedInitialData() {
  try {
    const seedFiles = fs
      .readdirSync(__dirname)
      .filter((f) => /^seed-data.*\.json$/.test(f))
      .sort();

    if (seedFiles.length === 0) {
      console.log('🌱 No seed-data*.json files found, skipping seed');
      return;
    }

    for (const file of seedFiles) {
      seedOne(path.join(__dirname, file));
    }
  } catch (e) {
    console.error('🌱 Seed failed (continuing):', e);
  }
}

function seedOne(seedPath: string) {
  try {
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
    console.error(`🌱 Seed failed for ${seedPath} (continuing):`, e);
  }
}
