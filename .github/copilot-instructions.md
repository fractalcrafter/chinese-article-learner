# Copilot Instructions for Monkey

## Build & Run Commands

```bash
# Server (from /server)
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run production build

# Client (from /client)
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Build for production
npm run lint         # Run ESLint

# Full production build (from root)
npm run build        # Builds both client and server
npm start            # Runs server serving client static files
```

## Architecture

**Monorepo Structure**: Separate `client/` and `server/` directories with independent package.json files. Root package.json orchestrates full builds.

**Client**: React 19 + TypeScript + Vite + Tailwind CSS v4
- Uses React Query (`@tanstack/react-query`) for server state management
- React Router for navigation with protected routes via `UserContext`
- Browser Web Speech API via custom hooks (`useSpeechRecognition`, `useSpeechSynthesis`)
- `hanzi-writer` library for Chinese character stroke animations

**Server**: Express 5 + TypeScript (ESM modules)
- SQLite via `better-sqlite3` for persistence
- Google Gemini AI for summaries and vocabulary extraction
- `pinyin` library for tone marks, `google-translate-api-x` for translations
- All routes under `/api/*`, static files served from `client/dist/`

**Data Flow**: Speech → Transcription → Article created → AI processing generates summary, sentence breakdowns (pinyin + translations), and vocabulary

## Key Conventions

**Database Path**: On Azure (`WEBSITE_INSTANCE_ID` set), uses `/home/data/monkey.db`. Locally uses `server/data/monkey.db`.

**ESM Modules**: Both client and server use `"type": "module"`. Server imports require `.js` extension even for TypeScript files.

**Express 5 Catch-all**: Uses `'/{*splat}'` syntax for SPA routing (not `'*'`).

**AI Service Graceful Degradation**: All Gemini calls in `services/ai.ts` handle failures gracefully - features work without API key configured.

**Environment Variables**: Server requires `GEMINI_API_KEY` in `.env`. Optional `CLIENT_URL` for CORS in production.

**API Client Pattern**: All API calls live in `client/src/lib/api.ts`. Uses `API_BASE` that switches between relative `/api` (production) and `localhost:3001/api` (development) based on `import.meta.env.PROD`.

**Authentication**: Simple family-use auth stored in localStorage (`monkey_user` key). No JWT tokens - user object persisted client-side via `UserContext`. Password hashing uses SHA256 (not production-grade, intentionally simple for family app).

**Vocabulary Status States**: Progress tracked as `'learning'` → `'reviewing'` → `'mastered'` based on accuracy thresholds in `db.ts`.
