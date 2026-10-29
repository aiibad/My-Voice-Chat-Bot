# Voice Twin Bot

A minimal, fully client-driven voice bot. Speak → get an answer spoken back.

## Stack
- **STT**: Web Speech API (`SpeechRecognition`)
- **LLM**: Google Gemini 2.0 Flash (free tier), via a secure Vercel serverless function
- **TTS**: Web Speech Synthesis API
- **Frontend**: React + Vite
- **Deploy**: Vercel

## Local development

```bash
npm install
cp .env.example .env.local     # then paste your Gemini key
npx vercel dev                 # runs the frontend AND /api/chat locally
```

> **Why `vercel dev`?** The bot calls `/api/chat`, a serverless function. `npm run dev` won't serve it — `vercel dev` does.

## Deploying to production (Vercel)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo.
3. Add an environment variable: `GEMINI_API_KEY` = your key.
4. Click **Deploy**. Done.

## Customizing the persona

Open `api/chat.js` and replace `[YOUR NAME]` and each `[PASTE YOUR PREPARED ANSWER]`
placeholder with your own first-person answers. The prompt already enforces
a warm, concise, TTS-friendly tone.

## Browser notes

- Speech **recognition** works in Chrome, Edge, and Safari (not Firefox).
- Speech **synthesis** works in all modern browsers.
- Microphone access requires **HTTPS** (Vercel gives you that) or `localhost`.
- A **text-input fallback** is always visible, so the bot works even in unsupported browsers.