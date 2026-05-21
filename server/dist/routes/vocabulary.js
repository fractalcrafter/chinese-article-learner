import { Router } from 'express';
import { db, updateVocabulary } from '../db.js';
import { getPinyin, translateText } from '../services/ai.js';
const router = Router();
// Get all vocabulary
router.get('/', (req, res) => {
    try {
        const vocabulary = db.prepare('SELECT * FROM vocabulary ORDER BY created_at DESC').all();
        res.json(vocabulary);
    }
    catch (error) {
        console.error('Error fetching vocabulary:', error);
        res.status(500).json({ error: 'Failed to fetch vocabulary' });
    }
});
// Get single vocabulary item
router.get('/:id', (req, res) => {
    try {
        const vocab = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(parseInt(req.params.id));
        if (!vocab) {
            return res.status(404).json({ error: 'Vocabulary not found' });
        }
        res.json(vocab);
    }
    catch (error) {
        console.error('Error fetching vocabulary:', error);
        res.status(500).json({ error: 'Failed to fetch vocabulary' });
    }
});
// Update vocabulary item
router.put('/:id', async (req, res) => {
    try {
        const { chinese, pinyin, english, example_sentence, emoji } = req.body;
        const id = parseInt(req.params.id);
        if (typeof chinese === 'string' && chinese.trim()) {
            const trimmed = chinese.trim();
            const existing = db.prepare('SELECT chinese FROM vocabulary WHERE id = ?').get(id);
            if (!existing) {
                return res.status(404).json({ error: 'Vocabulary not found' });
            }
            if (trimmed !== existing.chinese) {
                const conflict = db.prepare('SELECT id FROM vocabulary WHERE chinese = ? AND id != ?').get(trimmed, id);
                if (conflict) {
                    return res.status(409).json({ error: 'Another term with this Chinese text already exists' });
                }
                const newPinyin = getPinyin(trimmed);
                let newEnglish = '';
                try {
                    newEnglish = await translateText(trimmed);
                }
                catch (e) {
                    console.error('Translation failed during edit:', e);
                }
                db.prepare('UPDATE vocabulary SET chinese = ?, pinyin = ?, english = ? WHERE id = ?').run(trimmed, newPinyin, newEnglish, id);
                const refreshed = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(id);
                return res.json(refreshed);
            }
        }
        updateVocabulary(id, { pinyin, english, example_sentence, emoji });
        const updated = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(id);
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating vocabulary:', error);
        res.status(500).json({ error: 'Failed to update vocabulary' });
    }
});
// Generate pinyin for a word
router.post('/pinyin', (req, res) => {
    try {
        const { chinese } = req.body;
        const pinyinResult = getPinyin(chinese);
        res.json({ pinyin: pinyinResult });
    }
    catch (error) {
        console.error('Error generating pinyin:', error);
        res.status(500).json({ error: 'Failed to generate pinyin' });
    }
});
// Translate text
router.post('/translate', async (req, res) => {
    try {
        const { text, from = 'zh-CN', to = 'en' } = req.body;
        const translation = await translateText(text, from, to);
        res.json({ translation });
    }
    catch (error) {
        console.error('Error translating:', error);
        res.status(500).json({ error: 'Failed to translate' });
    }
});
export default router;
