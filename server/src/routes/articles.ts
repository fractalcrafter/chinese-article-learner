import { Router } from 'express';
import { 
  db, 
  createArticle, 
  getArticleById, 
  updateArticle,
  getOrCreateVocabulary,
  updateVocabulary,
  linkVocabularyToArticle,
  getVocabularyForArticle
} from '../db.js';
import { generateSummary, processSentences, extractVocabulary } from '../services/ai.js';

const router = Router();

// Get all articles
router.get('/', (req, res) => {
  try {
    const articles = db.prepare('SELECT id, title, created_at FROM articles ORDER BY created_at DESC').all();
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get single article with vocabulary
router.get('/:id', (req, res) => {
  try {
    const article = getArticleById(parseInt(req.params.id)) as any;
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const vocabulary = getVocabularyForArticle(parseInt(req.params.id));
    
    res.json({
      ...article,
      sentences: article.sentences_json ? JSON.parse(article.sentences_json) : [],
      vocabulary
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Create new article from transcription
router.post('/', async (req, res) => {
  try {
    const { transcription, title } = req.body;
    
    if (!transcription) {
      return res.status(400).json({ error: 'Transcription is required' });
    }

    // Create the article
    const articleId = createArticle({
      title: title || 'Untitled Article',
      transcription_original: transcription
    });

    res.json({ 
      id: articleId,
      message: 'Article created successfully'
    });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// Update article transcription
router.put('/:id/transcription', (req, res) => {
  try {
    const { transcription } = req.body;
    const id = parseInt(req.params.id);

    updateArticle(id, { transcription_edited: transcription });
    
    res.json({ message: 'Transcription updated' });
  } catch (error) {
    console.error('Error updating transcription:', error);
    res.status(500).json({ error: 'Failed to update transcription' });
  }
});

// Process article - generate summary, sentences, vocabulary
router.post('/:id/process', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const article = getArticleById(id) as any;
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const text = article.transcription_edited || article.transcription_original;

    // Generate summary (gracefully handle failures)
    console.log('Generating summary...');
    let summary = '';
    try {
      summary = await generateSummary(text);
    } catch (e) {
      console.error('Summary generation failed, continuing without it');
      summary = '(Summary unavailable - check Gemini API key)';
    }

    // Process sentences (this should work even without Gemini)
    console.log('Processing sentences...');
    const sentences = await processSentences(text);

    // Extract vocabulary (gracefully handle failures)
    console.log('Extracting vocabulary...');
    let vocabularyItems: any[] = [];
    try {
      vocabularyItems = await extractVocabulary(text);
    } catch (e) {
      console.error('Vocabulary extraction failed, continuing without it');
    }

    // Save vocabulary to database and link to article
    for (const item of vocabularyItems) {
      const vocab = getOrCreateVocabulary(item.chinese) as any;
      updateVocabulary(vocab.id, {
        pinyin: item.pinyin,
        english: item.english,
        example_sentence: item.example,
        emoji: item.emoji
      });
      linkVocabularyToArticle(id, vocab.id);
    }

    // Update article with processed data
    updateArticle(id, {
      summary,
      sentences_json: JSON.stringify(sentences)
    });

    // Get updated vocabulary
    const vocabulary = getVocabularyForArticle(id);

    res.json({
      summary,
      sentences,
      vocabulary
    });
  } catch (error) {
    console.error('Error processing article:', error);
    res.status(500).json({ error: 'Failed to process article' });
  }
});

export default router;
