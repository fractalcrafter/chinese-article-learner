# Monkey - Chinese Article Learning App

## Problem Statement
Build a web app for 8th graders to learn Chinese through articles. The app helps students understand Chinese articles by:
1. Recording and transcribing Chinese audio
2. Providing summaries and sentence-by-sentence breakdowns with translations
3. Supporting read-aloud functionality for pronunciation practice
4. Offering vocabulary learning with visual aids and stroke animations

## Proposed Approach
A full-stack web application using React + TypeScript frontend and Node.js + Express backend. **Completely free to run** using browser APIs and free-tier services. SQLite database for persistence.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (simple, file-based, easy to deploy)
- **Browser APIs** (free, built-in):
  - Web Speech API - SpeechRecognition (speech-to-text for Chinese transcription)
  - Web Speech API - SpeechSynthesis (text-to-speech for read-aloud)
- **Free AI Services** (optional, for enhanced features):
  - Azure OpenAI with MSDN credits (summaries, vocabulary) - future option
  - google-translate-api-x (Chinese↔English translation) - unlimited, free
- **Visual Learning** (free):
  - Emoji (built-in Unicode)
  - Lucide icons
  - Hanzi Writer (stroke animations)
- **Deployment**: Azure App Service (Basic B1 plan) or free tier options

## Architecture Overview
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Express API    │────▶│  Free Services  │
│  (Vite + TS)    │     │  (Node.js)      │     │  (Gemini/GTranslate)
│                 │     └────────┬────────┘     └─────────────────┘
│  Browser APIs:  │              │
│  - SpeechRecog  │     ┌────────▼────────┐
│  - SpeechSynth  │     │     SQLite      │
└─────────────────┘     └─────────────────┘
```

## Features Breakdown

### 1. Audio Recording & Transcription
- Browser-based speech recognition (Web Speech API - SpeechRecognition)
- Real-time transcription in Chinese (zh-CN locale)
- Display transcription with editable text
- Save original + edited versions
- Optional: record audio with MediaRecorder for playback reference

### 2. Article Display & Understanding
- AI-generated summary at top (key points, context)
- Sentence-by-sentence breakdown:
  - Chinese sentence
  - Pinyin (pronunciation guide)
  - English translation
  - Read-aloud button (Browser SpeechSynthesis with Chinese voice)
- Visual learning suggestions (related images/icons)

### 3. Vocabulary Learning
- Auto-extract key vocabulary (frequency analysis + AI suggestions)
- For each word:
  - Chinese character
  - Pinyin
  - English meaning
  - Example sentence
  - Read-aloud button
  - Stroke order animation (using Hanzi Writer library)
  - Visual aid (emoji + Lucide icons)
- Track learned vs. learning vocabulary
- Flashcard review mode

### 4. User Management
- Simple password-protected access
- Multiple user profiles
- Progress tracking per user

---

## Workplan

### Phase 1: Project Setup & Infrastructure
- [x] Initialize monorepo structure (client + server folders)
- [x] Set up React + TypeScript + Vite frontend with Tailwind CSS
- [x] Set up Node.js + Express + TypeScript backend
- [x] Configure SQLite database with schema
- [x] Set up Google Gemini API (free tier)
- [x] Create environment configuration (.env templates)
- [x] Set up basic API structure and CORS

### Phase 2: Audio Recording & Transcription (MVP)
- [x] Implement Web Speech API (SpeechRecognition) component for Chinese
- [x] Build transcription display with editable text
- [x] Add save functionality for transcriptions

### Phase 3: Article Processing & Display (MVP)
- [x] Create Google Gemini integration for text processing
- [x] Implement article summary generation
- [x] Build sentence segmentation logic
- [x] Generate pinyin for Chinese text (using pinyin library)
- [x] Integrate google-translate-api-x for English translations
- [x] Create article display UI with sentence breakdown
- [x] Integrate browser SpeechSynthesis for read-aloud (Chinese voice)
- [x] Add visual learning suggestions (emoji + icons)

### Phase 4: Vocabulary System (MVP)
- [x] Implement vocabulary extraction (frequency + Gemini analysis)
- [x] Build vocabulary card component
- [x] Integrate Hanzi Writer for stroke animations
- [x] Add read-aloud for vocabulary words
- [x] Add emoji/icon selection for visual learning

### Phase 5: User Management & Progress (Post-MVP)
- [ ] Implement simple user authentication (password-based)
- [ ] Create user profiles database schema
- [ ] Build user selection/login UI
- [ ] Track article completion per user
- [ ] Track vocabulary mastery per user
- [ ] Add progress dashboard
- [ ] Create flashcard review mode

### Phase 6: Polish & Deployment
- [x] Add loading states and error handling throughout
- [ ] Implement responsive design for tablet use
- [ ] Add analytics tracking (built-in)
- [ ] Write deployment guide
- [x] Deploy to Azure App Service
- [x] Fix SQLite path for Azure persistence (`/home/data/`)
- [x] Fix Express 5.x catch-all route syntax (`'/{*splat}'`)
- [x] Test end-to-end flow on live site ✅ (2026-02-02 5:33pm PST)
- [ ] Create quick-start guide for family use

---

## Deployment Info

- **GitHub Repo**: https://github.com/fractalcrafter/chinese-article-learner
- **Azure Web App**: monkeymonkey
- **Live URL**: https://monkeymonkey.azurewebsites.net
- **Auto-deploy**: Connected to GitHub `master` branch

---

## Current Status (Updated 2026-02-02 ~5:30pm PST)

### ✅ MVP Complete
- Speech-to-text transcription (Chinese)
- Editable transcription with save
- Sentence breakdown with pinyin + English translation
- Text-to-speech read-aloud (Chinese voice)
- Vocabulary card UI with Hanzi stroke animations

### ✅ Azure Deployment Complete
- **Live URL**: https://monkeymonkey.azurewebsites.net
- Auto-deploys from GitHub `master` branch
- Reused existing App Service Plan (ASP-speakuniverserg-8ca8)

### 🔧 Deployment Issues Fixed (2026-02-02)
| Issue | Root Cause | Fix Applied |
|-------|------------|-------------|
| SQLite data lost on restart | Relative path `./data/` is ephemeral | Use `/home/data/` on Azure |
| Build files not deployed | `dist/` in `.gitignore` | Removed from `.gitignore`, committed builds |
| Publish profile auth failed | Basic auth disabled | Used Deployment Center → GitHub |
| App wouldn't start | No startup command | Set `node server/dist/index.js` |
| PathError on `'*'` route | Express 5.x breaking change | Changed to `'/{*splat}'` |

### 📝 Lessons Learned
1. **Test production build locally** before deploying: `npm run build && npm start`
2. **Express 5.x changed catch-all syntax** - AI generates outdated Express 4.x code
3. **Azure SQLite must use `/home/data/`** - only persistent storage location
4. **Deployment Center > publish profiles** - simpler, no auth issues

### ⏳ Needs API Key (Optional)
- AI-powered summaries (needs Azure OpenAI)
- Vocabulary extraction (needs Azure OpenAI)

### 📋 Post-MVP (Phase 5)
- User management & authentication
- Progress tracking
- Flashcard review mode

---

## Database Schema (Draft)

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Articles
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  title TEXT,
  original_audio_path TEXT,
  transcription_original TEXT,
  transcription_edited TEXT,
  summary TEXT,
  sentences_json TEXT, -- JSON array of sentence breakdowns
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Vocabulary
CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY,
  chinese TEXT NOT NULL,
  pinyin TEXT,
  english TEXT,
  example_sentence TEXT,
  image_url TEXT,
  frequency INTEGER DEFAULT 1
);

-- Article-Vocabulary junction
CREATE TABLE article_vocabulary (
  article_id INTEGER REFERENCES articles(id),
  vocabulary_id INTEGER REFERENCES vocabulary(id),
  PRIMARY KEY (article_id, vocabulary_id)
);

-- User vocabulary progress
CREATE TABLE user_vocabulary_progress (
  user_id INTEGER REFERENCES users(id),
  vocabulary_id INTEGER REFERENCES vocabulary(id),
  status TEXT DEFAULT 'learning', -- 'learning', 'reviewing', 'mastered'
  last_reviewed DATETIME,
  review_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, vocabulary_id)
);

-- User article progress
CREATE TABLE user_article_progress (
  user_id INTEGER REFERENCES users(id),
  article_id INTEGER REFERENCES articles(id),
  completed BOOLEAN DEFAULT FALSE,
  last_accessed DATETIME,
  PRIMARY KEY (user_id, article_id)
);
```

---

## Key Libraries

### Frontend
- `react` + `react-dom` - UI framework
- `@tanstack/react-query` - Server state management
- `hanzi-writer` - Stroke order animations
- `tailwindcss` - Styling
- `lucide-react` - Icons
- `react-router-dom` - Routing

### Backend
- `express` - Web framework
- `better-sqlite3` - SQLite driver
- `@google/generative-ai` - Google Gemini client (free tier)
- `google-translate-api-x` - Translation (unofficial, free)
- `pinyin` - Chinese to pinyin conversion

---

## Notes & Considerations

1. **Offline Support**: Consider adding PWA capabilities later for offline flashcard review

2. **Chinese Segmentation**: Currently using sentence-level breakdown. Can add word segmentation with Gemini/Groq later

3. **Cost**: $0 running cost! Core features (pinyin, translation, read-aloud) work without any AI API

4. **AI Features (Optional)**: Summary and vocabulary extraction need Gemini (requires billing) or Groq (free, no billing)

5. **Mobile Experience**: Primary use may be on tablet - ensure touch-friendly UI

6. **Stroke Order**: Hanzi Writer is free and provides excellent stroke animations - key for visual learners

7. **Browser Compatibility**: Web Speech API works best in Chrome/Edge. May need fallback message for Firefox/Safari

8. **Chinese Voice**: Browser SpeechSynthesis includes Chinese voices (zh-CN) on most systems
