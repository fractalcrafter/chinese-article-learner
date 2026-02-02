// Use relative URL in production, localhost in development
const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

// Article types
export type Article = {
  id: number;
  title: string;
  transcription_original: string;
  transcription_edited: string;
  summary: string;
  sentences: Sentence[];
  vocabulary: Vocabulary[];
  created_at: string;
}

export type Sentence = {
  chinese: string;
  pinyin: string;
  english: string;
}

export type Vocabulary = {
  id: number;
  chinese: string;
  pinyin: string;
  english: string;
  example_sentence: string;
  emoji: string;
}

// API functions
export async function createArticle(transcription: string, title?: string): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription, title }),
  });
  if (!response.ok) throw new Error('Failed to create article');
  return response.json();
}

export async function getArticle(id: number): Promise<Article> {
  const response = await fetch(`${API_BASE}/articles/${id}`);
  if (!response.ok) throw new Error('Failed to fetch article');
  return response.json();
}

export async function getArticles(): Promise<Article[]> {
  const response = await fetch(`${API_BASE}/articles`);
  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

export async function updateTranscription(id: number, transcription: string): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${id}/transcription`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription }),
  });
  if (!response.ok) throw new Error('Failed to update transcription');
}

export async function processArticle(id: number): Promise<{
  summary: string;
  sentences: Sentence[];
  vocabulary: Vocabulary[];
}> {
  const response = await fetch(`${API_BASE}/articles/${id}/process`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to process article');
  return response.json();
}

// Add vocabulary manually - server will auto-generate pinyin and translate
export async function addVocabulary(articleId: number, chinese: string): Promise<Vocabulary> {
  const response = await fetch(`${API_BASE}/articles/${articleId}/vocabulary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chinese }),
  });
  if (!response.ok) throw new Error('Failed to add vocabulary');
  return response.json();
}

// Delete vocabulary
export async function deleteVocabulary(articleId: number, vocabId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${articleId}/vocabulary/${vocabId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete vocabulary');
}
