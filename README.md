# AI Trivia Game with Dynamic Personalities

An interactive, full-stack, real-time trivia game featuring an AI Host with customizable, user-chosen personalities. Powered by advanced Gemini models, the application provides live text-to-speech commentary, voice-only interactive stages, and fact-verified quiz generation using Google Search grounding.

---

## 🌟 Key Features

### 1. Dynamic Host Personalities
Choose from several unique AI host personalities, each with custom witty commentaries, sarcasm, sports-like enthusiasm, dramatic flair, or cyberpunk edge:
- **Professor Algernon**: A sarcastic British polymath.
- **Coach Sparky**: An ultra-energetic sports hype-man.
- **Madame Vivienne**: A snooty avant-garde art and culture critic.
- **Neon**: A paranoid cyberpunk rebel.
- **Gorgon**: A gothic crypt keeper.

### 2. Search-Grounded Quizzes
Quizzes are generated on-the-fly using `gemini-3.5-flash` integrated with the Google Search tool (`googleSearch`). All questions, multiple-choice options, correct answers, and host commentaries are fact-verified in real-time, complete with citations and web-source links.

### 3. Integrated Text-To-Speech (TTS)
Dynamic spoken narration is built using `gemini-3.1-flash-tts-preview`. Every question intro, correct feedback, incorrect correction, and final scorecard is spoken in-character with distinct voices matching the host's persona.

### 4. Interactive Voice Stage (Live API)
A real-time, bidirectional voice conversation module powered by `gemini-3.1-flash-live-preview` (Live API) over secure WebSockets. Users can speak directly to the host, answer questions verbally, interrupt the host mid-sentence, and receive low-latency verbal evaluations.

---

## 🛠️ Tech Stack & Architecture

### Backend
- **Node.js & Express**: API endpoints and serving assets.
- **WebSockets (`ws`)**: Low-latency full-duplex communication channel for real-time PCM audio streaming.
- **Official `@google/genai` SDK**: Powers content generation, structured JSON responses, search grounding, text-to-speech, and Live API connections.

### Frontend
- **React 19 & TypeScript**: Component-driven UI.
- **Tailwind CSS**: High-fidelity dark slate theme.
- **Motion (`motion/react`)**: Immersive animations, tab transitions, and real-time audio waveform visualizers.
- **Lucide React**: Clean vector icon suite.

---

## 📂 Folder Structure

```text
├── assets/
├── dist/                     # Compiled production assets
├── src/
│   ├── components/
│   │   ├── PersonalitySelector.tsx  # Host picker and voice previewers
│   │   ├── TriviaQuiz.tsx           # Grounded trivia game board & stats
│   │   └── VoiceStage.tsx           # Real-time WebSocket Live voice stage
│   ├── App.tsx               # Main application layout and state shell
│   ├── index.css             # Tailwind style imports
│   ├── main.tsx              # React entrypoint
│   └── types.ts              # Global TypeScript interfaces
├── .env.example              # Environment variables template
├── index.html                # Main index file
├── package.json              # Script runners and dependencies
├── server.ts                 # Full-stack Express, Vite middleware & WebSocket server
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite asset bundler configuration
```

---

## 🚀 Getting Started

### 1. Setup Environment Variables
Create a `.env` file in the root directory and define your API key:
```env
GEMINI_API_KEY="your-gemini-api-key-here"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
This runs the full-stack Express server with integrated Vite middleware:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start playing.

### 4. Production Build
```bash
npm run build
npm run start
```

---

## 🔒 Security & Best Practices
- **Server-Side Proxying**: All API calls to Gemini and the configuration of keys are managed exclusively on the backend (`server.ts`). Secrets are never exposed to the client browser.
- **No Hardcoded Keys**: Environment variables are strictly kept inside local configuration wrappers.
- **Validations & Fallbacks**: Features graceful handling for missing keys, network interruptions, and malformed audio formats.
