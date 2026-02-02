import { GoogleGenerativeAI } from '@google/generative-ai';
import translateModule from 'google-translate-api-x';
import pinyinModule from 'pinyin';
// Get the actual pinyin function - handle both ESM and CJS exports
const pinyinFn = pinyinModule.default || pinyinModule.pinyin || pinyinModule;
const STYLE_TONE = pinyinModule.STYLE_TONE || pinyinModule.default?.STYLE_TONE || 1;
// Get translate function
const translate = translateModule.default || translateModule;
// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
/**
 * Generate a summary of the Chinese article using Gemini
 */
export async function generateSummary(chineseText) {
    if (!process.env.GEMINI_API_KEY) {
        return 'Summary not available (Gemini API key not configured)';
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are helping an 8th grader learn Chinese. Analyze this Chinese article and provide a brief summary in English (2-3 sentences) that explains:
1. What the article is about
2. Key information or main points

Chinese article:
${chineseText}

Respond with only the summary in English, no additional formatting.`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
    catch (error) {
        console.error('Error generating summary:', error);
        return 'Summary generation failed';
    }
}
/**
 * Split Chinese text into sentences and generate translations
 */
export async function processSentences(chineseText) {
    // Split by Chinese punctuation marks (including comma for natural phrases)
    // Primary sentence endings: 。！？
    // Secondary breaks: ；，(semicolon, comma for longer texts)
    const sentenceDelimiters = /([。！？])/;
    const parts = chineseText.split(sentenceDelimiters);
    // Recombine sentences with their punctuation
    let sentences = [];
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
        }
        else {
            // No punctuation at all - treat entire text as one sentence
            sentences = [chineseText.trim()];
        }
    }
    // Process each sentence
    const results = [];
    // Helper to check if character is Chinese (CJK range) - uses codePointAt for surrogate pairs
    const isChineseChar = (char) => {
        const code = char.codePointAt(0) || 0;
        return (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
            (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
            (code >= 0x20000 && code <= 0x2A6DF); // CJK Extension B
    };
    for (const sentence of sentences) {
        // Generate pinyin for full sentence to preserve polyphone context
        // The library returns numbers/punctuation as-is, Chinese chars get pinyin
        let pinyinStr = '';
        try {
            const pinyinResult = pinyinFn(sentence, {
                style: STYLE_TONE,
                segment: true // Context-aware for polyphones
            });
            // Filter: keep only entries that look like pinyin (not numbers/punctuation/English)
            // Real pinyin contains tone marks or is short romanization
            const isPinyin = (s) => /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$/.test(s) && s.length <= 6;
            const pinyinParts = pinyinResult
                .map((p) => p[0] || '')
                .filter((p) => isPinyin(p));
            pinyinStr = pinyinParts.join(' ');
        }
        catch (e) {
            console.error('Pinyin generation error:', e);
            pinyinStr = '';
        }
        // Translate to English
        let englishTranslation = '';
        try {
            const translation = await translate(sentence, { from: 'zh-CN', to: 'en' });
            englishTranslation = translation.text;
        }
        catch (error) {
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
 * Extract key vocabulary from the article using Gemini
 */
export async function extractVocabulary(chineseText) {
    if (!process.env.GEMINI_API_KEY) {
        return [];
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are helping an 8th grader learn Chinese vocabulary. From this Chinese article, identify 5-8 key vocabulary words that would be most useful for a student to learn.

For each word, provide:
1. The Chinese word/character
2. Pinyin with tone marks
3. English meaning
4. A simple example sentence in Chinese
5. A relevant emoji that helps visualize or remember the word

Chinese article:
${chineseText}

Respond in JSON format only, no markdown:
[
  {
    "chinese": "学习",
    "pinyin": "xué xí",
    "english": "to study/learn",
    "example": "我每天学习中文。",
    "emoji": "📚"
  }
]`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Parse JSON response (handle potential markdown code blocks)
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
    }
    catch (error) {
        console.error('Error extracting vocabulary:', error);
        return [];
    }
}
/**
 * Generate pinyin for a single word
 */
export function getPinyin(chinese) {
    try {
        const result = pinyinFn(chinese, {
            style: STYLE_TONE,
            segment: true
        });
        return result.map((p) => p[0]).join(' ');
    }
    catch (e) {
        console.error('Pinyin error:', e);
        return '';
    }
}
/**
 * Translate a single word or phrase
 */
export async function translateText(text, from = 'zh-CN', to = 'en') {
    try {
        const result = await translate(text, { from, to });
        return result.text;
    }
    catch (error) {
        console.error('Translation error:', error);
        return '';
    }
}
