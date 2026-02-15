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

/**
 * Translate a single word or phrase using Azure OpenAI for dictionary-quality results
 * Falls back to google-translate if Azure OpenAI is unavailable
 */
export async function translateText(text: string, from = 'zh-CN', to = 'en'): Promise<string> {
  // Use Azure OpenAI only for Chinese→English (dictionary-quality translations)
  if (azureOpenAI && from.startsWith('zh') && to === 'en') {
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
