import { Router } from 'express';
import { db, getOrCreateVocabulary, updateVocabulary } from '../db.js';
import { batchEnrichWords } from '../services/ai.js';

const router = Router();

type VocabularyRow = {
  id: number;
  chinese: string;
  pinyin: string | null;
  english: string | null;
  example_sentence?: string | null;
  emoji?: string | null;
  position?: number;
};

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

function uniqueVocabularyRows(rows: VocabularyRow[]): VocabularyRow[] {
  const byChinese = new Map<string, VocabularyRow>();
  for (const row of rows) {
    if (!byChinese.has(row.chinese)) byChinese.set(row.chinese, row);
  }
  return [...byChinese.values()];
}

function enrichVocabularyInBackground(rows: VocabularyRow[]) {
  const vocabularyRows = uniqueVocabularyRows(rows);
  if (vocabularyRows.length === 0) return;

  void (async () => {
    const enriched = await batchEnrichWords(vocabularyRows.map(row => row.chinese));
    const rowsByChinese = new Map(vocabularyRows.map(row => [row.chinese, row]));
    const currentStmt = db.prepare('SELECT chinese, pinyin, english FROM vocabulary WHERE id = ?');

    for (const item of enriched) {
      const row = rowsByChinese.get(item.chinese);
      if (!row) continue;

      const current = currentStmt.get(row.id) as VocabularyRow | undefined;
      if (!current || current.chinese !== item.chinese) continue;

      const updates: { pinyin?: string; english?: string } = {};
      if (current.pinyin === row.pinyin) updates.pinyin = item.pinyin;
      if (current.english === row.english) updates.english = item.english;
      updateVocabulary(row.id, updates);
    }
  })().catch(error => {
    console.error('Background vocabulary enrichment failed:', error);
  });
}

const createSetWithVocabulary = db.transaction((
  title: string,
  description: string | null,
  words: string[]
) => {
  const result = db.prepare(
    'INSERT INTO study_sets (title, description) VALUES (?, ?)'
  ).run(title, description);
  const setId = Number(result.lastInsertRowid);
  const linkStmt = db.prepare(
    'INSERT OR IGNORE INTO study_set_vocab (set_id, vocabulary_id, position) VALUES (?, ?, ?)'
  );
  const vocabularyRows: VocabularyRow[] = [];

  for (let i = 0; i < words.length; i++) {
    const vocab = getOrCreateVocabulary(words[i]) as VocabularyRow;
    linkStmt.run(setId, vocab.id, i);
    vocabularyRows.push(vocab);
  }

  return { setId, vocabularyRows };
});

const addVocabularyToSet = db.transaction((setId: number, words: string[]) => {
  const maxPos = (db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS m FROM study_set_vocab WHERE set_id = ?'
  ).get(setId) as { m: number }).m;
  const linkStmt = db.prepare(
    'INSERT OR IGNORE INTO study_set_vocab (set_id, vocabulary_id, position) VALUES (?, ?, ?)'
  );
  const vocabularyRows: VocabularyRow[] = [];
  const added: VocabularyRow[] = [];
  let pos = maxPos + 1;

  for (const chinese of words) {
    const vocab = getOrCreateVocabulary(chinese) as VocabularyRow;
    const position = pos;
    const result = linkStmt.run(setId, vocab.id, position);
    vocabularyRows.push(vocab);
    if (result.changes > 0) {
      added.push({ ...vocab, position });
      pos++;
    }
  }

  return { vocabularyRows, added };
});

// GET /api/sets - list all sets with item counts
router.get('/', (req, res) => {
  try {
    const sets = db.prepare(`
      SELECT s.id, s.title, s.description, s.created_at,
        (SELECT COUNT(*) FROM study_set_vocab sv WHERE sv.set_id = s.id) AS item_count
      FROM study_sets s
      WHERE s.hidden = 0
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
router.post('/', (req, res) => {
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

    const { setId, vocabularyRows } = createSetWithVocabulary(
      title.trim(),
      description?.trim() || null,
      words
    );
    enrichVocabularyInBackground(vocabularyRows);

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
    const { title, description, hidden } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (hidden !== undefined) { fields.push('hidden = ?'); values.push(hidden ? 1 : 0); }
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
router.post('/:id/items', (req, res) => {
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

    const { vocabularyRows, added } = addVocabularyToSet(id, words);
    enrichVocabularyInBackground(vocabularyRows);

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
