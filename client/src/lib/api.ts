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

// ============ Auth & User API ============

export type User = {
  id: number;
  name: string;
  avatar_emoji: string;
  created_at: string;
}

export type UserProgress = {
  articles: {
    total_articles: number;
    completed_articles: number;
    total_sentences_read: number;
  };
  vocabulary: {
    total_vocab: number;
    mastered_vocab: number;
    reviewing_vocab: number;
    total_reviews: number;
  };
}

// Get all users (for family selection)
export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_BASE}/auth/users`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

// Register new user
export async function registerUser(name: string, password: string, avatarEmoji?: string): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, avatarEmoji }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to register');
  }
  return response.json();
}

// Login
export async function loginUser(name: string, password: string): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to login');
  }
  return response.json();
}

// Get user progress
export async function getUserProgress(userId: number): Promise<UserProgress> {
  const response = await fetch(`${API_BASE}/auth/users/${userId}/progress`);
  if (!response.ok) throw new Error('Failed to fetch progress');
  return response.json();
}

// Update article progress
export async function updateArticleProgress(
  userId: number, 
  articleId: number, 
  data: { completed?: boolean; sentencesRead?: number }
): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/users/${userId}/article-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId, ...data }),
  });
  if (!response.ok) throw new Error('Failed to update progress');
}

// Update vocabulary progress
export async function updateVocabularyProgress(
  userId: number,
  vocabularyId: number,
  correct: boolean
): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/users/${userId}/vocabulary-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocabularyId, correct }),
  });
  if (!response.ok) throw new Error('Failed to update progress');
}
