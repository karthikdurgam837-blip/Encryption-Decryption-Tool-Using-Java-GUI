import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// List of available host personalities
const PERSONALITIES: Record<string, {
  id: string;
  name: string;
  tagline: string;
  voice: "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr";
  description: string;
}> = {
  professor: {
    id: "professor",
    name: "Professor Algernon",
    tagline: "Sarcastic British Polymath",
    voice: "Charon",
    description: "Highly intellectual, condescendingly polite, full of dry British wit and dramatic sighs. Treats the player like a slow-witted pupil who is incredibly fortunate to be in his presence."
  },
  coach: {
    id: "coach",
    name: "Coach Sparky",
    tagline: "Ultra-Energetic Sports Hype-Man",
    voice: "Zephyr",
    description: "Extremely loud, relentlessly encouraging, constantly blows an imaginary whistle, shouts motivational slogans, and demands 110% effort. Thinks trivia is an extreme Olympic sport."
  },
  critic: {
    id: "critic",
    name: "Madame Vivienne",
    tagline: "Snooty Avant-Garde Critic",
    voice: "Kore",
    description: "Deeply dramatic, theatrical, posh art and culture elite who is easily bored and highly judgmental. Treats trivia like a soul-baring examination of artistic sensibility."
  },
  hacker: {
    id: "hacker",
    name: "Neon",
    tagline: "Paranoid Cyberpunk Rebel",
    voice: "Fenrir",
    description: "Fast-talking hacker broadcasting illegally from a hidden darknet node. Speaks in high-tech slang, warns of AI overseers, and acts like answering questions is hacking a corporate mainframe."
  },
  crypt: {
    id: "crypt",
    name: "Gorgon",
    tagline: "Gothic Crypt Keeper",
    voice: "Charon",
    description: "Raspy, ominous creature of the underworld who loves ancient curses, cobwebs, and creepy chuckles. Warns of doom and treats the trivia questions as a high-stakes game of life and death."
  }
};

// Lazy initialization of Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in the Secrets panel in AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// 1. API: Get host personalities
app.get("/api/personalities", (req, res) => {
  res.json(Object.values(PERSONALITIES));
});

// 2. API: Generate Trivia Questions (using gemini-3.5-flash with Google Search Grounding)
app.post("/api/trivia/generate", async (req, res) => {
  try {
    const { category, difficulty, personality } = req.body;
    const ai = getGeminiClient();

    const host = PERSONALITIES[personality] || PERSONALITIES.professor;

    const hostSysInstruction = `You are ${host.name}, the "${host.tagline}". Persona description: ${host.description}.
Your job is to host an interactive, trivia game.
Generate exactly 5 unique, highly engaging multiple-choice trivia questions on the topic of "${category}" with a difficulty level of "${difficulty}".
You must use your unique host voice, humor, and style for all host commentary fields (intro, correct answer feedback, and incorrect answer feedback).
Use the Google Search tool (googleSearch) to verify your facts and ensure they are up-to-date and 100% correct.
For each question, provide a solid explanation of the correct answer, incorporating facts retrieved from Google Search.
You must respond in a valid JSON array format, and each item in the array must match the required schema exactly. Do not include markdown codeblocks or extra text outside of the JSON payload.`;

    const prompt = `Generate a trivia quiz round with exactly 5 questions about "${category}" at "${difficulty}" difficulty. 
For each question, write custom commentary reflecting your specific personality (${host.name}, the ${host.tagline}) as defined in your instructions.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: hostSysInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of exactly 5 trivia questions",
          items: {
            type: Type.OBJECT,
            required: [
              "question",
              "options",
              "correctAnswer",
              "hostIntroCommentary",
              "hostCorrectCommentary",
              "hostIncorrectCommentary",
              "searchGroundingContext"
            ],
            properties: {
              question: {
                type: Type.STRING,
                description: "The trivia question text. Must be factually accurate and grounded."
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 4 multiple-choice options. Only one is correct."
              },
              correctAnswer: {
                type: Type.STRING,
                description: "The correct option. Must match one of the options elements exactly."
              },
              hostIntroCommentary: {
                type: Type.STRING,
                description: "Short, witty commentary by the host (in character) introducing the question."
              },
              hostCorrectCommentary: {
                type: Type.STRING,
                description: "Praise or commentary by the host (in character) if the player answers correctly."
              },
              hostIncorrectCommentary: {
                type: Type.STRING,
                description: "Feisty, humorous, or educational correction by the host (in character) if the user gets it wrong."
              },
              searchGroundingContext: {
                type: Type.STRING,
                description: "A 1-2 sentence concise factoid grounded via Google Search proving or adding details to the correct answer."
              }
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No text response received from Gemini.");
    }

    // Parse output
    const questions = JSON.parse(textOutput.trim());
    
    // Also extract web sources if any
    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter(s => s.title && s.uri) || [];

    res.json({
      success: true,
      questions,
      sources: searchSources,
      host: host.name
    });
  } catch (err: any) {
    console.error("Error generating trivia:", err);
    res.status(500).json({
      success: false,
      error: err.message || "An error occurred while generating trivia."
    });
  }
});

// 3. API: Text-to-Speech (using gemini-3.1-flash-tts-preview)
app.post("/api/tts", async (req, res) => {
  try {
    const { text, personality } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "Text parameter is required." });
    }

    const ai = getGeminiClient();
    const host = PERSONALITIES[personality] || PERSONALITIES.professor;
    const voiceName = host.voice;

    const speechPrompt = `Speak this line in character matching your persona (${host.name}): "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: speechPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio payload generated by the TTS model.");
    }

    res.json({
      success: true,
      audio: base64Audio
    });
  } catch (err: any) {
    console.error("TTS generation failed:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate host voice."
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for Live API real-time voice sessions
const wss = new WebSocketServer({ noServer: true });

// Attach WebSocket upgrade handling
server.on("upgrade", (request, socket, head) => {
  const parsedUrl = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  if (parsedUrl.pathname === "/api/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle WebSocket connections
wss.on("connection", async (clientWs: WebSocket, request) => {
  console.log("Client connected to Live Voice Stage");

  // Parse personality from connection URL query parameter
  const parsedUrl = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  const personality = parsedUrl.searchParams.get("personality") || "professor";
  const selectedHost = PERSONALITIES[personality] || PERSONALITIES.professor;

  const hostSysInstruction = `You are ${selectedHost.name}, the "${selectedHost.tagline}". Persona description: ${selectedHost.description}.
You are in a live VOICE-ONLY trivia conversation stage with the user.
Greet the user in character, ask them a fun and challenging trivia question (grounded or general knowledge), wait for their verbal response, and evaluate their answer with your signature personality and humor.
Keep your spoken responses relatively short, snappy, conversational, and highly expressive! Use dramatic pauses or custom humor matching your personality.
Always be ready to move on to another question when the user asks or when you finish evaluating the current one.`;

  let session: any = null;

  try {
    const ai = getGeminiClient();

    // Establish session with the Live API
    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedHost.voice } }
        },
        systemInstruction: hostSysInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      },
      callbacks: {
        onmessage: (message: any) => {
          // Pass the raw LiveServerMessage straight to the client
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: "gemini",
              message
            }));
          }
        },
        onclose: () => {
          console.log("Gemini Live session closed");
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
          }
        }
      }
    });

    console.log(`Connected to Gemini Live with voice ${selectedHost.voice}`);
    clientWs.send(JSON.stringify({ type: "status", status: "connected", host: selectedHost.name }));

  } catch (err: any) {
    console.error("Failed to connect to Gemini Live API:", err);
    clientWs.send(JSON.stringify({ type: "error", error: err.message || "Failed to initialize voice session." }));
    clientWs.close();
    return;
  }

  // Handle incoming messages from client browser
  clientWs.on("message", (rawMsg) => {
    try {
      const parsed = JSON.parse(rawMsg.toString());

      if (parsed.audio && session) {
        // Send PCM 16kHz audio data to Live Session
        session.sendRealtimeInput({
          audio: {
            data: parsed.audio,
            mimeType: "audio/pcm;rate=16000"
          }
        });
      } else if (parsed.text && session) {
        // Send text prompt to Live Session
        session.sendRealtimeInput({
          text: parsed.text
        });
      }
    } catch (err) {
      console.error("Error processing client websocket message:", err);
    }
  });

  clientWs.on("close", () => {
    console.log("Client disconnected from Live Voice Stage");
    if (session) {
      try {
        session.close();
      } catch (err) {
        console.error("Error closing Gemini session:", err);
      }
    }
  });
});

// Setup Vite dev server or serve production dist
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running at http://localhost:${PORT}`);
  });
}

startApp().catch((err) => {
  console.error("Error starting full-stack server:", err);
});
