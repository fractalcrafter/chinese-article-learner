import { Router } from 'express';
import { db, getOrCreateVocabulary, updateVocabulary } from '../db.js';
import { getPinyin, translateText } from '../services/ai.js';

const router = Router();

// Parse pasted input into individual Chinese words.
// Splits on newlines, commas (both ASCII and Chinese), semicolons, tabs, and whitespace.
function parseChineseList(input: string): string[] {
  if (!input) return [];
  const tokens = input.split(/[\n\r,，、;；\t ]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Helper: enrich a vocabulary entry with pinyin + english if missing.
async function ensureVocabularyEnriched(vocab: any) {
  const needsPinyin = !vocab.pinyin;
  const needsEnglish = !vocab.english;
  if (!needsPinyin && !needsEnglish) return vocab;

  const updates: { pinyin?: string; english?: string } = {};
  if (needsPinyin) {
    try {
      updates.pinyin = getPinyin(vocab.chinese);
    } catch (e) {
      console.error('Pinyin failed for', vocab.chinese, e);
    }
  }
  if (needsEnglish) {
    try {
      updates.english = await translateText(vocab.chinese);
    } catch (e) {
      console.error('Translation failed for', vocab.chinese, e);
      updates.english = '(Translation unavailable)';
    }
  }
  updateVocabulary(vocab.id, updates);
  return { ...vocab, ...updates };
}

// GET /api/sets - list all sets with item counts
router.get('/', (req, res) => {
  try {
    const sets = db.prepare(`
      SELECT s.id, s.title, s.description, s.created_at,
        (SELECT COUNT(*) FROM study_set_vocab sv WHERE sv.set_id = s.id) AS item_count
      FROM study_sets s
      ORDER BY s.created_at DESC
    `).all();
    res.json(sets);
  } catch (e) {
    console.error('Error listing sets:', e);
    res.status(500).json({ error: 'Failed to list sets' });
  }
});

// POST /api/sets - create a set from a list of Chinese words
// Body: { title, description?, chineseList?: string[] | rawInput?: string }
router.post('/', async (req, res) => {
  try {
    const { title, description, chineseList, rawInput } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let words: string[] = [];
    if (Array.isArray(chineseList)) {
      words = chineseList.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (typeof rawInput === 'string') {
      words = parseChineseList(rawInput);
    }

    const result = db.prepare(
      'INSERT INTO study_sets (title, description) VALUES (?, ?)'
    ).run(title.trim(), description?.trim() || null);
    const setId = Number(result.lastInsertRowid);

    // Add vocabulary items (auto-generate pinyin + english)
    const linkStmt = db.prepare(
      'INSERT OR IGNORE INTO study_set_vocab (set_id, vocabulary_id, position) VALUES (?, ?, ?)'
    );
    for (let i = 0; i < words.length; i++) {
      const chinese = words[i];
      let vocab = getOrCreateVocabulary(chinese) as any;
      vocab = await ensureVocabularyEnriched(vocab);
      linkStmt.run(setId, vocab.id, i);
    }

    res.json({ id: setId, message: 'Set created' });
  } catch (e) {
    console.error('Error creating set:', e);
    res.status(500).json({ error: 'Failed to create set' });
  }
});

// GET /api/sets/:id - get a set with all items
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const set = db.prepare('SELECT * FROM study_sets WHERE id = ?').get(id) as any;
    if (!set) return res.status(404).json({ error: 'Set not found' });

    const items = db.prepare(`
      SELECT v.id, v.chinese, v.pinyin, v.english, v.example_sentence, v.emoji, sv.position
      FROM study_set_vocab sv
      JOIN vocabulary v ON v.id = sv.vocabulary_id
      WHERE sv.set_id = ?
      ORDER BY sv.position ASC, v.id ASC
    `).all(id);

    res.json({ ...set, items });
  } catch (e) {
    console.error('Error fetching set:', e);
    res.status(500).json({ error: 'Failed to fetch set' });
  }
});

// PUT /api/sets/:id - update title/description
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (fields.length === 0) return res.json({ message: 'No changes' });
    values.push(id);
    db.prepare(`UPDATE study_sets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ message: 'Updated' });
  } catch (e) {
    console.error('Error updating set:', e);
    res.status(500).json({ error: 'Failed to update set' });
  }
});

// DELETE /api/sets/:id
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.prepare('DELETE FROM study_sets WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Set not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Error deleting set:', e);
    res.status(500).json({ error: 'Failed to delete set' });
  }
});

// POST /api/sets/:id/items - add words (rawInput or chineseList)
router.post('/:id/items', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const set = db.prepare('SELECT id FROM study_sets WHERE id = ?').get(id);
    if (!set) return res.status(404).json({ error: 'Set not found' });

    const { chineseList, rawInput } = req.body;
    let words: string[] = [];
    if (Array.isArray(chineseList)) {
      words = chineseList.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (typeof rawInput === 'string') {
      words = parseChineseList(rawInput);
    }

    const maxPos = (db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS m FROM study_set_vocab WHERE set_id = ?'
    ).get(id) as any).m;

    const linkStmt = db.prepare(
      'INSERT OR IGNORE INTO study_set_vocab (set_id, vocabulary_id, position) VALUES (?, ?, ?)'
    );
    let pos = maxPos + 1;
    const added: any[] = [];
    for (const chinese of words) {
      let vocab = getOrCreateVocabulary(chinese) as any;
      vocab = await ensureVocabularyEnriched(vocab);
      const r = linkStmt.run(id, vocab.id, pos);
      if (r.changes > 0) {
        added.push({ ...vocab, position: pos });
        pos++;
      }
    }
    res.json({ added });
  } catch (e) {
    console.error('Error adding items:', e);
    res.status(500).json({ error: 'Failed to add items' });
  }
});

// DELETE /api/sets/:id/items/:vocabId
router.delete('/:id/items/:vocabId', (req, res) => {
  try {
    const setId = parseInt(req.params.id);
    const vocabId = parseInt(req.params.vocabId);
    db.prepare(
      'DELETE FROM study_set_vocab WHERE set_id = ? AND vocabulary_id = ?'
    ).run(setId, vocabId);
    res.json({ success: true });
  } catch (e) {
    console.error('Error removing item:', e);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

export default router;
