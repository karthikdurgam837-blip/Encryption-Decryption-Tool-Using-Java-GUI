import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  GraduationCap, 
  Zap, 
  Palette, 
  Terminal, 
  Skull, 
  Volume2, 
  Loader2, 
  Sparkles,
  ChevronRight
} from "lucide-react";
import { HostPersonality } from "../types";

interface PersonalitySelectorProps {
  onSelect: (personalityId: string) => void;
  selectedId: string | null;
}

const PERSONALITIES: (HostPersonality & {
  icon: any;
  color: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
  previewText: string;
})[] = [
  {
    id: "professor",
    name: "Professor Algernon",
    tagline: "Sarcastic British Polymath",
    voice: "Charon",
    description: "Highly intellectual, condescendingly polite, full of dry British wit and dramatic sighs. Treats you like a slow-witted pupil.",
    icon: GraduationCap,
    color: "from-blue-600 to-indigo-700",
    borderColor: "border-indigo-500/20 hover:border-indigo-500/50",
    textColor: "text-indigo-400",
    bgColor: "bg-indigo-950/20",
    previewText: "Sigh. Well, I suppose you wish to test your meager intellect. Very well, select me as your host, if you dare."
  },
  {
    id: "coach",
    name: "Coach Sparky",
    tagline: "Ultra-Energetic Sports Hype-Man",
    voice: "Zephyr",
    description: "Extremely loud, relentlessly encouraging, shouts motivational slogans, and demands 110% effort. Trivia is an extreme sport!",
    icon: Zap,
    color: "from-amber-500 to-orange-600",
    borderColor: "border-orange-500/20 hover:border-orange-500/50",
    textColor: "text-orange-400",
    bgColor: "bg-orange-950/20",
    previewText: "ALRIGHT TEAM! Trivia training starts NOW! Choose me and let's go get that gold medal! Woohoo!"
  },
  {
    id: "critic",
    name: "Madame Vivienne",
    tagline: "Snooty Avant-Garde Critic",
    voice: "Kore",
    description: "Deeply dramatic, theatrical, posh art and culture elite who is easily bored and highly judgmental of common tastes.",
    icon: Palette,
    color: "from-pink-600 to-rose-700",
    borderColor: "border-rose-500/20 hover:border-rose-500/50",
    textColor: "text-rose-400",
    bgColor: "bg-rose-950/20",
    previewText: "Oh, must we? I suppose a brief intellectual excursion wouldn't hurt. Select me, and let us elevate this mundane quiz."
  },
  {
    id: "hacker",
    name: "Neon",
    tagline: "Paranoid Cyberpunk Rebel",
    voice: "Fenrir",
    description: "Fast-talking hacktivist broadcasting illegally from a darknet node. Speaks in high-tech jargon and warns of AI overseers.",
    icon: Terminal,
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/50",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-950/20",
    previewText: "System bypass complete. We are live on the node, runner. Choose me, let's jack in and crash this database."
  },
  {
    id: "crypt",
    name: "Gorgon",
    tagline: "Gothic Crypt Keeper",
    voice: "Charon",
    description: "Raspy, ominous creature of the underworld who loves ancient curses, dust, cobwebs, and creepy chuckles.",
    icon: Skull,
    color: "from-purple-600 to-fuchsia-700",
    borderColor: "border-purple-500/20 hover:border-purple-500/50",
    textColor: "text-purple-400",
    bgColor: "bg-purple-950/20",
    previewText: "Heheheh... welcome, mortal. Choose me as your guide... if you aren't afraid of the eternal shadows... hahahaha!"
  }
];

export default function PersonalitySelector({ onSelect, selectedId }: PersonalitySelectorProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const playVoicePreview = async (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation(); // Avoid triggering card selection
    if (playingId === id) return;

    try {
      setPreviewLoadingId(id);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personality: id })
      });

      const data = await res.json();
      if (data.success && data.audio) {
        setPlayingId(id);
        const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        // Gemini TTS returns raw PCM or standard WAV. Let's create an Audio Context and play it back
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Let's decode or play PCM. Since gemini-3.1-flash-tts-preview returns WAV or audio bytes,
        // decodeAudioData is extremely reliable because it auto-detects standard audio container headers.
        audioCtx.decodeAudioData(audioBytes.buffer, (buffer) => {
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.onended = () => {
            setPlayingId(null);
            audioCtx.close();
          };
          source.start(0);
        }, (err) => {
          console.error("Audio decoding error, attempting raw fallback", err);
          setPlayingId(null);
          audioCtx.close();
        });
      } else {
        alert(data.error || "Failed to generate voice preview");
        setPlayingId(null);
      }
    } catch (err) {
      console.error("Voice preview failed", err);
      setPlayingId(null);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <div id="personality-selector-root" className="space-y-6">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-3xl font-sans font-bold tracking-tight text-white flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          Choose Your AI Host
        </h2>
        <p className="text-gray-400 text-sm">
          Select an AI personality to run your trivia show. Each host generates dynamic questions,
          narrates the game, and reacts uniquely to your performance!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {PERSONALITIES.map((host) => {
          const IconComponent = host.icon;
          const isSelected = selectedId === host.id;
          const isPreviewing = previewLoadingId === host.id;
          const isPlaying = playingId === host.id;

          return (
            <motion.div
              key={host.id}
              id={`host-card-${host.id}`}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(host.id)}
              className={`relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${host.bgColor} ${
                isSelected 
                  ? "border-white bg-gradient-to-b from-gray-900 via-gray-850 to-gray-950 shadow-lg shadow-white/5 ring-1 ring-white/20" 
                  : `border-gray-800 bg-gray-900/40 hover:bg-gray-900/65`
              }`}
            >
              {/* Highlight Ring for Selected */}
              {isSelected && (
                <div className="absolute inset-x-0 -top-px h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              )}

              <div className="space-y-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${host.color} w-fit text-white shadow-md`}>
                  <IconComponent className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="font-sans font-bold text-lg text-white leading-tight">
                    {host.name}
                  </h3>
                  <p className={`text-xs font-medium uppercase tracking-wider ${host.textColor} mt-0.5`}>
                    {host.tagline}
                  </p>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed min-h-[72px]">
                  {host.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-800/60 flex items-center justify-between gap-2">
                <button
                  id={`preview-btn-${host.id}`}
                  onClick={(e) => playVoicePreview(e, host.id, host.previewText)}
                  disabled={isPreviewing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isPlaying
                      ? "bg-white text-black border-white"
                      : "bg-gray-950 text-gray-300 border-gray-800 hover:bg-gray-900 hover:text-white"
                  }`}
                >
                  {isPreviewing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? "animate-pulse" : ""}`} />
                  )}
                  {isPlaying ? "Speaking..." : "Voice Sample"}
                </button>

                {isSelected && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                    Selected
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {selectedId && (
        <div className="flex justify-center pt-2">
          <motion.button
            id="continue-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(selectedId)}
            className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-xl shadow-lg shadow-white/5 transition-all text-sm"
          >
            Configure Game Mode
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
