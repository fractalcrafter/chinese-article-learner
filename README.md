# Monkey - Chinese Article Learning App

A web app for 8th graders to learn Chinese through articles.

## Features
- 🎤 Speech-to-text transcription (Chinese)
- 📝 Editable transcriptions
- 📖 Article summaries and sentence breakdowns
- 🔊 Text-to-speech read-aloud
- 📚 Vocabulary learning with stroke animations
- 🎯 Pinyin and English translations

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite
- **AI**: Google Gemini (free tier) + Browser Web Speech API

## Getting Started

### Prerequisites
- Node.js 18+
- Google Gemini API key (free from https://ai.google.dev)

### Setup

1. **Clone and install dependencies**
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

2. **Configure environment**
```bash
# In server folder, edit .env file
GEMINI_API_KEY=your_api_key_here
```

3. **Start development servers**
```bash
# Terminal 1 - Start backend
cd server
npm run dev

# Terminal 2 - Start frontend
cd client
npm run dev
```

4. **Open the app**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure
```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── package.json
├── server/          # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── db.ts
│   └── package.json
└── plan.md          # Implementation plan
```

## License
MIT
