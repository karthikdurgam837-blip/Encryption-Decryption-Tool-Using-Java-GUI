import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  HelpCircle, 
  Radio, 
  RefreshCw, 
  Award,
  ChevronLeft,
  Volume2,
  Tv,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import PersonalitySelector from "./components/PersonalitySelector";
import TriviaQuiz from "./components/TriviaQuiz";
import VoiceStage from "./components/VoiceStage";
import { HostPersonality } from "./types";

export default function App() {
  const [personalities, setPersonalities] = useState<HostPersonality[]>([]);
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"quiz" | "live">("quiz");
  const [loading, setLoading] = useState(true);

  // Fetch host personalities from the server on mount
  useEffect(() => {
    async function fetchPersonalities() {
      try {
        const res = await fetch("/api/personalities");
        const data = await res.json();
        setPersonalities(data);
      } catch (err) {
        console.error("Failed to fetch personalities from backend:", err);
        // Static fallback if API is not yet loaded
        setPersonalities([
          {
            id: "professor",
            name: "Professor Algernon",
            tagline: "Sarcastic British Polymath",
            voice: "Charon",
            description: "Highly intellectual, condescendingly polite, dry British wit."
          },
          {
            id: "coach",
            name: "Coach Sparky",
            tagline: "Ultra-Energetic Sports Hype-Man",
            voice: "Zephyr",
            description: "Relentlessly encouraging, demands 110% effort."
          },
          {
            id: "critic",
            name: "Madame Vivienne",
            tagline: "Snooty Avant-Garde Critic",
            voice: "Kore",
            description: "Theatrical, posh culture elite who is easily bored."
          },
          {
            id: "hacker",
            name: "Neon",
            tagline: "Paranoid Cyberpunk Rebel",
            voice: "Fenrir",
            description: "Fast-talking hacker broadcasting from an illegal darknet node."
          },
          {
            id: "crypt",
            name: "Gorgon",
            tagline: "Gothic Crypt Keeper",
            voice: "Charon",
            description: "Ominous creature who loves ancient curses and creepy chuckles."
          }
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchPersonalities();
  }, []);

  const selectedHost = personalities.find(p => p.id === selectedPersonalityId);

  return (
    <div id="app-root" className="min-h-screen bg-slate-950 text-gray-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-950/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-sans font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
                AI Trivia Game
              </h1>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                Full-Stack Real-Time Quiz Show
              </p>
            </div>
          </div>

          {/* Current Active Host Badge / Navigation */}
          {selectedHost && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 bg-gray-900/80 border border-gray-850 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active Host:</span>
                <span className="text-xs font-semibold text-white">{selectedHost.name}</span>
              </div>

              <button
                id="switch-host-btn"
                onClick={() => setSelectedPersonalityId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-950 hover:bg-gray-900 text-gray-400 hover:text-white border border-gray-850 hover:border-gray-800 rounded-xl text-xs font-medium transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change Host</span>
              </button>
            </div>
          )}

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm text-gray-400 font-mono">Launching show engines...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {!selectedPersonalityId ? (
              /* HOST SELECTION VIEW */
              <motion.div
                key="selector"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-4"
              >
                <PersonalitySelector 
                  selectedId={selectedPersonalityId} 
                  onSelect={(id) => setSelectedPersonalityId(id)} 
                />
              </motion.div>
            ) : (
              /* MAIN GAME STAGE VIEW */
              <motion.div
                key="stage"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Back button and Host Card Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-900/40 border border-gray-900 p-5 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <button
                      id="back-to-selector-btn"
                      onClick={() => setSelectedPersonalityId(null)}
                      className="p-2 bg-gray-950 border border-gray-850 text-gray-400 hover:text-white rounded-lg transition-colors"
                      title="Back to Host Selection"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-lg font-sans font-bold text-white leading-tight">
                          {selectedHost?.name}
                        </h2>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono">
                          {selectedHost?.voice}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {selectedHost?.tagline} • "{selectedHost?.description}"
                      </p>
                    </div>
                  </div>

                  {/* Mode Toggles */}
                  <div className="flex items-center bg-gray-950/80 p-1 rounded-xl border border-gray-850 self-start sm:self-center shrink-0">
                    <button
                      id="tab-quiz"
                      onClick={() => setActiveTab("quiz")}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                        activeTab === "quiz"
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <Tv className="w-3.5 h-3.5" />
                      Classic Quiz
                    </button>
                    <button
                      id="tab-live"
                      onClick={() => setActiveTab("live")}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                        activeTab === "live"
                          ? "bg-rose-600 text-white shadow-md"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Voice Stage
                    </button>
                  </div>
                </div>

                {/* Selected Stage Window */}
                <div id="game-stage-window" className="min-h-[400px]">
                  <AnimatePresence mode="wait">
                    {activeTab === "quiz" ? (
                      <motion.div
                        key="quiz-mode"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <TriviaQuiz 
                          personalityId={selectedPersonalityId} 
                          hostName={selectedHost?.name || "Professor Algernon"} 
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="live-mode"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                      >
                        <VoiceStage 
                          personalityId={selectedPersonalityId} 
                          hostName={selectedHost?.name || "Professor Algernon"}
                          onClose={() => setActiveTab("quiz")}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
            }
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 bg-slate-950/60 p-6 text-center text-xs text-gray-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © 2026 AI Trivia Game. Powered by Gemini 3.5 & Google Search Grounding.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Simple dynamic loader for fallback
function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={`animate-spin ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
