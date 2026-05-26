import { AzureOpenAI } from 'openai';
import translateModule from 'google-translate-api-x';
import pinyinModule from 'pinyin';

// Get the actual pinyin function - handle both ESM and CJS exports
const pinyinFn = (pinyinModule as any).default || (pinyinModule as any).pinyin || pinyinModule;
const STYLE_TONE = (pinyinModule as any).STYLE_TONE || (pinyinModule as any).default?.STYLE_TONE || 1;

// Get translate function
const translate = (translateModule as any).default || translateModule;

// Initialize Azure OpenAI client
const azureOpenAI = process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY
  ? new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_KEY,
      apiVersion: '2024-10-21',
    })
  : null;

const DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

// Sentence structure for article breakdown
export interface Sentence {
  chinese: string;
  pinyin: string;
  english: string;
}

// Vocabulary item structure
export interface VocabularyItem {
  chinese: string;
  pinyin: string;
  english: string;
  example: string;
  emoji: string;
}

export interface EnrichedWord {
  chinese: string;
  pinyin: string;
  english: string;
}

const BATCH_ENRICH_SIZE = 20;
const FALLBACK_CONCURRENCY = 5;

/**
 * Generate a summary of the Chinese article using Azure OpenAI
 */
export async function generateSummary(chineseText: string): Promise<string> {
  if (!azureOpenAI) {
    return 'Summary not available (Azure OpenAI not configured)';
  }

  try {
    const result = await azureOpenAI.chat.completions.create({
      model: DEPLOYMENT_NAME,
      messages: [
        {
          role: 'system',
          content: 'You are helping an 8th grader learn Chinese. Provide brief summaries in English (2-3 sentences).'
        },
        {
          role: 'user',
          content: `Analyze this Chinese article and provide a brief summary in English (2-3 sentences) that explains:\n1. What the article is about\n2. Key information or main points\n\nChinese article:\n${chineseText}\n\nRespond with only the summary in English, no additional formatting.`
        }
      ],
      temperature: 0.3,
    });

    return result.choices[0]?.message?.content?.trim() || 'Summary generation failed';
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Summary generation failed';
  }
}

/**
 * Split Chinese text into sentences and generate translations
 */
export async function processSentences(chineseText: string): Promise<Sentence[]> {
  // Split by Chinese punctuation marks (including comma for natural phrases)
  // Primary sentence endings: 。！？
  // Secondary breaks: ；，(semicolon, comma for longer texts)
  const sentenceDelimiters = /([。！？])/;
  const parts = chineseText.split(sentenceDelimiters);
  
  // Recombine sentences with their punctuation
  let sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i]?.trim();
    const punct = parts[i + 1] || '';
    if (text) {
      sentences.push(text + punct);
    }
  }
  
  // If no sentences found (no proper punctuation), try splitting by commas or just use whole text
  if (sentences.length === 0 && chineseText.trim()) {
    // Try splitting by commas or semicolons for texts without periods
    const commaParts = chineseText.split(/[，；]/);
    if (commaParts.length > 1) {
      sentences = commaParts.map(s => s.trim()).filter(s => s.length > 0);
    } else {
      // No punctuation at all - treat entire text as one sentence
      sentences = [chineseText.trim()];
    }
  }

  // Process each sentence
  const results: Sentence[] = [];
  
  // Helper to check if character is Chinese (CJK range) - uses codePointAt for surrogate pairs
  const isChineseChar = (char: string) => {
    const code = char.codePointAt(0) || 0;
    return (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
           (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
           (code >= 0x20000 && code <= 0x2A6DF);  // CJK Extension B
  };
  
  for (const sentence of sentences) {
    // Generate pinyin for full sentence to preserve polyphone context
    // The library returns numbers/punctuation as-is, Chinese chars get pinyin
    
    let pinyinStr = '';
    try {
      const pinyinResult = pinyinFn(sentence, {
        style: STYLE_TONE,
        segment: true  // Context-aware for polyphones
      });
      
      // Filter: keep only entries that look like pinyin (not numbers/punctuation/English)
      // Real pinyin contains tone marks or is short romanization
      const isPinyin = (s: string) => /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$/.test(s) && s.length <= 6;
      const pinyinParts = pinyinResult
        .map((p: string[]) => p[0] || '')
        .filter((p: string) => isPinyin(p));
      pinyinStr = pinyinParts.join(' ');
    } catch (e) {
      console.error('Pinyin generation error:', e);
      pinyinStr = '';
    }

    // Translate to English
    let englishTranslation = '';
    try {
      const translation = await translate(sentence, { from: 'zh-CN', to: 'en' });
      englishTranslation = translation.text;
    } catch (error) {
      console.error('Translation error:', error);
      englishTranslation = '(Translation unavailable)';
    }

    results.push({
      chinese: sentence,
      pinyin: pinyinStr,
      english: englishTranslation
    });
  }

  return results;
}

/**
 * Extract key vocabulary from the article using Azure OpenAI
 */
export async function extractVocabulary(chineseText: string): Promise<VocabularyItem[]> {
  if (!azureOpenAI) {
    return [];
  }

  try {
    const result = await azureOpenAI.chat.completions.create({
      model: DEPLOYMENT_NAME,
      messages: [
        {
          role: 'system',
          content: 'You are helping an 8th grader learn Chinese vocabulary. Respond in JSON format only, no markdown.'
        },
        {
          role: 'user',
          content: `From this Chinese article, identify 5-8 key vocabulary words/phrases (commonly 2-character phrases) that would be most useful for a student to learn.

For each word, provide:
1. The Chinese word/phrase (commonly 2 characters, e.g., 上映, 领域)
2. Pinyin with tone marks (e.g., shàngyìng)
3. English meaning in dictionary style - list common meanings separated by " / " (e.g., "to show (a movie) / to screen")
4. A simple example sentence in Chinese
5. A relevant emoji that helps visualize or remember the word

Chinese article:
${chineseText}

Respond in JSON format only, no markdown:
[
  {
    "chinese": "上映",
    "pinyin": "shàngyìng",
    "english": "to show (a movie) / to screen",
    "example": "这部电影下周上映。",
    "emoji": "🎬"
  }
]`
        }
      ],
      temperature: 0.3,
    });

    const text = result.choices[0]?.message?.content?.trim() || '[]';
    // Parse JSON response (handle potential markdown code blocks)
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error extracting vocabulary:', error);
    return [];
  }
}

/**
 * Generate pinyin for a single word
 */
export function getPinyin(chinese: string): string {
  try {
    const result = pinyinFn(chinese, {
      style: STYLE_TONE,
      segment: true
    });
    return result.map((p: string[]) => p[0]).join(' ');
  } catch (e) {
    console.error('Pinyin error:', e);
    return '';
  }
}

function chunkWords(words: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex++;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

async function fallbackEnrichWords(words: string[]): Promise<EnrichedWord[]> {
  return mapWithConcurrency(words, FALLBACK_CONCURRENCY, async (chinese) => {
    const english = await translateText(chinese, 'zh-CN', 'en', { useAzure: false });
    return {
      chinese,
      pinyin: getPinyin(chinese),
      english: english || '(Translation unavailable)',
    };
  });
}

function parseEnrichedWordsResponse(content: string): EnrichedWord[] {
  const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(jsonStr);
  const rawItems = Array.isArray(parsed) ? parsed : parsed.words;
  if (!Array.isArray(rawItems)) {
    throw new Error('Azure OpenAI enrichment response did not include a words array');
  }

  return rawItems
    .filter((item: unknown): item is EnrichedWord => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.chinese === 'string' &&
        typeof candidate.pinyin === 'string' &&
        typeof candidate.english === 'string'
      );
    })
    .map(item => ({
      chinese: item.chinese.trim(),
      pinyin: item.pinyin.trim(),
      english: item.english.trim(),
    }));
}

async function enrichWordChunk(words: string[]): Promise<EnrichedWord[]> {
  if (!azureOpenAI) {
    return fallbackEnrichWords(words);
  }

  try {
    const result = await azureOpenAI.chat.completions.create({
      model: DEPLOYMENT_NAME,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a Chinese-English dictionary and pinyin expert. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: `Enrich each Chinese word or idiom with context-aware pinyin and concise dictionary-style English.

Rules:
- Return exactly one entry per input item.
- Preserve each Chinese input string exactly in the "chinese" field.
- Use pinyin with tone marks and spaces between syllables.
- Choose polyphone readings from context. For example, 弹 is "tán" when it means to play a stringed instrument, as in 对牛弹琴.
- English should be a concise dictionary-style definition with common meanings separated by " / ".

Inputs:
${JSON.stringify(words)}

Respond with this JSON shape only:
{
  "words": [
    { "chinese": "对牛弹琴", "pinyin": "duì niú tán qín", "english": "to play the lute to a cow / to address the wrong audience" }
  ]
}`
        }
      ],
      temperature: 0.1,
    });

    const content = result.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Azure OpenAI enrichment returned an empty response');
    }

    const enriched = parseEnrichedWordsResponse(content);
    const byChinese = new Map(
      enriched
        .filter(item => item.pinyin && item.english)
        .map(item => [item.chinese, item])
    );
    const missing = words.filter(word => !byChinese.has(word));

    if (missing.length > 0) {
      const fallback = await fallbackEnrichWords(missing);
      for (const item of fallback) byChinese.set(item.chinese, item);
    }

    return words.map(word => byChinese.get(word)!).filter(Boolean);
  } catch (error) {
    console.error('Azure OpenAI batch enrichment failed, falling back:', error);
    return fallbackEnrichWords(words);
  }
}

/**
 * Generate context-aware pinyin and dictionary English for a list of words.
 */
export async function batchEnrichWords(words: string[]): Promise<EnrichedWord[]> {
  const cleanWords = words.map(word => word.trim()).filter(Boolean);
  if (cleanWords.length === 0) return [];

  const enrichedChunks = await Promise.all(
    chunkWords(cleanWords, BATCH_ENRICH_SIZE).map(enrichWordChunk)
  );
  return enrichedChunks.flat();
}

/**
 * Translate a single word or phrase using Azure OpenAI for dictionary-quality results
 * Falls back to google-translate if Azure OpenAI is unavailable
 */
export async function translateText(
  text: string,
  from = 'zh-CN',
  to = 'en',
  options: { useAzure?: boolean } = {}
): Promise<string> {
  // Use Azure OpenAI only for Chinese→English (dictionary-quality translations)
  if (options.useAzure !== false && azureOpenAI && from.startsWith('zh') && to === 'en') {
    try {
      const result = await azureOpenAI.chat.completions.create({
        model: DEPLOYMENT_NAME,
        messages: [
          {
            role: 'system',
            content: 'You are a Chinese-English dictionary. Give concise dictionary-style translations only.'
          },
          {
            role: 'user',
            content: `Translate this Chinese word/phrase to English in dictionary style. Give the most common meanings separated by " / ". Be concise like a dictionary entry. Do NOT include the Chinese characters, pinyin, or any extra explanation.\n\nChinese: ${text}\n\nRespond with ONLY the English translation, nothing else.`
          }
        ],
        temperature: 0.1,
      });

      const translation = result.choices[0]?.message?.content?.trim();
      if (translation) return translation;
    } catch (e) {
      console.error('Azure OpenAI translation failed, falling back to google-translate:', e);
    }
  }

  // Fallback to google-translate (also used for non-English targets)
  try {
    const result = await translate(text, { from, to });
    return result.text;
  } catch (error) {
    console.error('Translation error:', error);
    return '';
  }
}
