import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, 
  Award, 
  Volume2, 
  Loader2, 
  RotateCcw, 
  ExternalLink, 
  Search, 
  VolumeX, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play
} from "lucide-react";
import { TriviaQuestion, SearchSource, HostPersonality } from "../types";

interface TriviaQuizProps {
  personalityId: string;
  hostName: string;
}

const CATEGORIES = [
  "General Knowledge",
  "Science & Technology",
  "World History",
  "Movies & Pop Culture",
  "Sports & Athletics",
  "Video Games & Gaming"
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

export default function TriviaQuiz({ personalityId, hostName }: TriviaQuizProps) {
  // Game Setup State
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [gameState, setGameState] = useState<"setup" | "loading" | "playing" | "summary">("setup");
  const [loadingStep, setLoadingStep] = useState("");

  // Game Play State
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [hostResponseCommentary, setHostResponseCommentary] = useState("");

  // Audio State
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeAudioCtx, setActiveAudioCtx] = useState<AudioContext | null>(null);
  const [activeAudioSource, setActiveAudioSource] = useState<AudioBufferSourceNode | null>(null);

  // Final Summary Evaluation state
  const [finalEvaluation, setFinalEvaluation] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);

  // Loading Steps animation
  useEffect(() => {
    if (gameState !== "loading") return;
    const steps = [
      `Consulting ${hostName}...`,
      "Activating Gemini search engines...",
      "Validating facts with Google Search Grounding...",
      "Applying custom witty commentaries...",
      "Polishing questions..."
    ];
    let idx = 0;
    setLoadingStep(steps[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % steps.length;
      setLoadingStep(steps[idx]);
    }, 2200);

    return () => clearInterval(interval);
  }, [gameState, hostName]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, [activeAudioCtx, activeAudioSource]);

  const stopCurrentAudio = () => {
    if (activeAudioSource) {
      try {
        activeAudioSource.stop();
      } catch (e) {}
    }
    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch (e) {}
    }
    setIsPlayingAudio(false);
    setAudioLoading(false);
    setActiveAudioSource(null);
    setActiveAudioCtx(null);
  };

  const playTTS = async (text: string) => {
    stopCurrentAudio();
    if (!text) return;

    try {
      setAudioLoading(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personality: personalityId })
      });

      const data = await res.json();
      if (data.success && data.audio) {
        const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setActiveAudioCtx(audioCtx);

        setAudioLoading(false);
        setIsPlayingAudio(true);

        audioCtx.decodeAudioData(audioBytes.buffer, (buffer) => {
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.onended = () => {
            setIsPlayingAudio(false);
            audioCtx.close();
          };
          setActiveAudioSource(source);
          source.start(0);
        }, (err) => {
          console.error("Failed to decode audio", err);
          setIsPlayingAudio(false);
          audioCtx.close();
        });
      } else {
        console.error("TTS returned error:", data.error);
        setAudioLoading(false);
      }
    } catch (err) {
      console.error("Error calling TTS API:", err);
      setAudioLoading(false);
    }
  };

  // Start a new game and fetch trivia
  const startTrivia = async () => {
    setGameState("loading");
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setHasSubmitted(false);
    setScore(0);
    setSources([]);
    setHostResponseCommentary("");

    try {
      const res = await fetch("/api/trivia/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, difficulty, personality: personalityId })
      });

      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setSources(data.sources || []);
        setGameState("playing");

        // Speak the intro of the first question
        const firstQuestion = data.questions[0];
        const introPrompt = `${firstQuestion.hostIntroCommentary} Here is your question: ${firstQuestion.question}`;
        if (autoPlayVoice) {
          playTTS(introPrompt);
        }
      } else {
        alert(data.error || "Failed to generate quiz questions. Please check your API keys and try again.");
        setGameState("setup");
      }
    } catch (err) {
      console.error("Failed to fetch trivia:", err);
      alert("An error occurred. Make sure your local Express server is running properly.");
      setGameState("setup");
    }
  };

  // Check selected answer
  const submitAnswer = (option: string) => {
    if (hasSubmitted) return;
    setSelectedOption(option);
    setHasSubmitted(true);

    const question = questions[currentIndex];
    const isCorrect = option === question.correctAnswer;
    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(nextScore);
    }

    const commentary = isCorrect ? question.hostCorrectCommentary : question.hostIncorrectCommentary;
    setHostResponseCommentary(commentary);

    // Speak host reaction & factual grounding
    const speakText = `${commentary} ${question.searchGroundingContext}`;
    if (autoPlayVoice) {
      playTTS(speakText);
    }
  };

  // Go to next question or show summary
  const nextQuestion = async () => {
    stopCurrentAudio();
    setSelectedOption(null);
    setHasSubmitted(false);
    setHostResponseCommentary("");

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      const nextQ = questions[currentIndex + 1];
      const introPrompt = `${nextQ.hostIntroCommentary} Next question: ${nextQ.question}`;
      if (autoPlayVoice) {
        playTTS(introPrompt);
      }
    } else {
      setGameState("summary");
      await fetchFinalEvaluation();
    }
  };

  // Get dynamic dynamic host scorecard assessment
  const fetchFinalEvaluation = async () => {
    setEvalLoading(true);
    setFinalEvaluation("");
    try {
      const evaluationPrompt = `You are ${hostName} of personality ${personalityId}. Summarize my performance in the trivia game. 
Topic: ${category}, Difficulty: ${difficulty}. 
My final score is ${score} out of 5. 
Write a highly personalized, witty review of my score in your signature character persona. 
Make it hilarious, punchy, and include a custom recommendation for the player.`;

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: evaluationPrompt, personality: personalityId })
      });
      // Also fetch normal text for display
      const ttsData = await res.json();
      
      // Since TTS has spoken, let's get the text content by a quick API fetch or locally crafting a dynamic summary
      // Let's call Gemini server (using basic endpoint) if possible or fallback to beautiful local templates
      // Let's do a fast generation or use standard clever local templates based on score for extra reliability
      let localFeedback = "";
      if (score === 5) {
        if (personalityId === "professor") localFeedback = "A perfect score? Five out of five? Utterly preposterous! You must have bribed my assistants, or perhaps the universe experienced a temporary glitch. Fine, I admit your performance was... adequate. Now do run along before your inflated ego takes up any more oxygen.";
        else if (personalityId === "coach") localFeedback = "BOOM! THAT'S WHAT I'M TALKING ABOUT! 5 OUT OF 5! YOU GAVE 110%, DROPPED THE HAMMER, AND ABSOLUTELY CRUSHED IT! YOU'RE THE MVP! THE TRIVIA CHAMPION! UNBELIEVABLE HUSTLE, CHAMPION!";
        else if (personalityId === "critic") localFeedback = "Perfect? 5 out of 5? Mon dieu. I must confess, your answers possessed an unexpected artistic flair. You bypassed the common pitfalls of mediocrity with a certain grace. A rare, delicate, and triumphant victory. I am almost... impressed.";
        else if (personalityId === "hacker") localFeedback = "MAIN FRAME COMPLETELY COMPROMISED! You just hit 5 out of 5 decryption keys perfectly! Zero firewall triggers, clean escape. The database is ours, Netrunner. Outstanding breach code!";
        else localFeedback = "HEHEHEH... 5 out of 5! The ancient gods of the tombs are speechless! You have escaped the crypt of doom unscathed. But do not celebrate too early, mortal... the shadows are always hungry!";
      } else if (score >= 3) {
        if (personalityId === "professor") localFeedback = `You scored ${score}/5. Well, it is certainly better than a zero, though that is a remarkably low bar. You got some of the easy ones right, probably by blind chance. A moderately mediocre effort.`;
        else if (personalityId === "coach") localFeedback = `That's ${score}/5! Good effort! You worked the corners, executed the game plan, and put some solid points on the scoreboard! Let's hit the practice courts, tighten up our defense, and get a perfect 5 next round!`;
        else if (personalityId === "critic") localFeedback = `A score of ${score}/5. Fascinating. It is a mixture of raw brilliance and utterly pedestrian choices. Like an abstract painting with a highly cliché frame. You show promise, but you must refine your palate.`;
        else if (personalityId === "hacker") localFeedback = `Decrypted ${score}/5 files before the sysadmin caught the tracer. Decent network run. Not quite a legendary hack, but you made it out with the critical data packages. Stay stealthy.`;
        else localFeedback = `Aha, ${score}/5. You have survived the trapdoors, but some cobwebs still hold your ankles. A noble effort, mortal. You may live to see another night in the dark woods... for now!`;
      } else {
        if (personalityId === "professor") localFeedback = `You got ${score}/5 correct. Good heavens. My grandmother's dusty collection of tea bags could have guessed more correctly than you. I am genuinely astonished by the depth of your ignorance. Simply tragic.`;
        else if (personalityId === "coach") localFeedback = `Ouch, ${score}/5! That's a tough loss on the home turf! The crowd is stunned! But we don't quit! We watch the game tape, run 100 laps, eat some raw eggs, and get back out there! Dust yourself off!`;
        else if (personalityId === "critic") localFeedback = `A dismal ${score}/5. I am in physical pain. That was not a quiz; it was a devastating assault on the intellect. Utterly formless, lacking color, entirely amateur. Please go read a book immediately.`;
        else if (personalityId === "hacker") localFeedback = `FIREWALL TRIPPED! You only bypassed ${score}/5 nodes. The corporation tracked your IP and locked down the server. We got completely fried. Reset your VPN and jack out before the black ICE fries your synapses!`;
        else localFeedback = `Heheheh... ${score}/5! The gargoyles are laughing from the rafters! You fell straight into the spike pits of ignorance. A truly horrifying spectacle. Your soul remains locked in the trivia dungeon!`;
      }

      setFinalEvaluation(localFeedback);
      if (ttsData.success && ttsData.audio) {
        // Play the dynamic spoke scorecard
        const audioBytes = Uint8Array.from(atob(ttsData.audio), c => c.charCodeAt(0));
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setActiveAudioCtx(audioCtx);
        setIsPlayingAudio(true);

        audioCtx.decodeAudioData(audioBytes.buffer, (buffer) => {
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.onended = () => {
            setIsPlayingAudio(false);
            audioCtx.close();
          };
          setActiveAudioSource(source);
          source.start(0);
        });
      }
    } catch (e) {
      console.error("Evaluation loading error", e);
    } finally {
      setEvalLoading(false);
    }
  };

  const activeQuestion = questions[currentIndex];

  return (
    <div id="trivia-quiz-root" className="max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        {/* Setup Stage */}
        {gameState === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-xl space-y-6"
          >
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-sans font-bold text-white">Configure Your Quiz</h3>
                <p className="text-xs text-gray-400">Select your preferences below to let {hostName} generate a customized challenge.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Trivia Category</label>
                <div className="grid grid-cols-1 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      id={`category-${cat.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => setCategory(cat)}
                      className={`text-left px-4 py-3 rounded-xl text-sm border font-medium transition-all duration-200 ${
                        category === cat
                          ? "bg-indigo-500/10 border-indigo-500 text-white shadow-sm"
                          : "bg-gray-950/40 border-gray-850 text-gray-400 hover:border-gray-800 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300">Difficulty Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTIES.map((diff) => (
                      <button
                        key={diff}
                        id={`difficulty-${diff.toLowerCase()}`}
                        onClick={() => setDifficulty(diff)}
                        className={`py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all duration-200 ${
                          difficulty === diff
                            ? "bg-white text-black border-white shadow-md"
                            : "bg-gray-950/40 border-gray-850 text-gray-400 hover:border-gray-800 hover:text-white"
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Narrator Settings */}
                <div className="bg-gray-950/40 border border-gray-850 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                    Host Voice Settings
                  </h4>
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-white">Auto-Play Voice Commentary</span>
                      <p className="text-[11px] text-gray-400">The Host will speak automatically on each question.</p>
                    </div>
                    <button
                      id="autoplay-toggle"
                      onClick={() => setAutoPlayVoice(!autoPlayVoice)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoPlayVoice ? "bg-indigo-600" : "bg-gray-800"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoPlayVoice ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    id="start-show-btn"
                    onClick={startTrivia}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/10 transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Generate Grounded Show
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading Stage */}
        {gameState === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 p-12 rounded-3xl text-center shadow-xl space-y-6 flex flex-col items-center justify-center min-h-[350px]"
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              <Search className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-sans font-bold text-white">Generating Your Show</h3>
              <p className="text-sm text-indigo-400 font-mono tracking-wide">{loadingStep}</p>
            </div>
            <p className="text-xs text-gray-500 max-w-md">
              Gemini is running real-time Google search operations behind the scenes to verify facts and format the host's custom reactions.
            </p>
          </motion.div>
        )}

        {/* Active Quiz Stage */}
        {gameState === "playing" && activeQuestion && (
          <motion.div
            key="playing"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Header progress bar */}
            <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Question</span>
                <span className="text-sm font-bold text-indigo-400 font-mono">{currentIndex + 1} / {questions.length}</span>
              </div>
              {/* Progress Line */}
              <div className="flex-1 max-w-md h-2 bg-gray-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 bg-gray-950/60 border border-gray-850 px-3 py-1.5 rounded-lg">
                <Award className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-gray-300">Score: {score}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Host Commentary Bubble */}
              <div className="lg:col-span-4 bg-gray-900/60 border border-gray-800 rounded-3xl p-6 space-y-4 shadow-md flex flex-col items-center text-center">
                <div className="relative">
                  {/* Persona Indicator */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  {isPlayingAudio && (
                    <span className="absolute -inset-1 rounded-full border-2 border-indigo-500 animate-ping opacity-40" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-bold text-white text-md">{hostName}</h4>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400">Quiz Host</span>
                </div>

                <div className="bg-gray-950/60 border border-gray-850/60 rounded-2xl p-4 text-xs leading-relaxed text-gray-300 italic min-h-[110px] w-full flex items-center justify-center relative">
                  <span>
                    "{hasSubmitted ? hostResponseCommentary : activeQuestion.hostIntroCommentary}"
                  </span>
                </div>

                {/* TTS controls */}
                <button
                  id="speak-bubble-btn"
                  onClick={() => playTTS(hasSubmitted ? `${hostResponseCommentary} ${activeQuestion.searchGroundingContext}` : `${activeQuestion.hostIntroCommentary} Here is your question: ${activeQuestion.question}`)}
                  disabled={audioLoading}
                  className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-colors ${
                    isPlayingAudio
                      ? "bg-white text-black border-white"
                      : "bg-gray-950 border-gray-800 text-gray-300 hover:bg-gray-900"
                  }`}
                >
                  {audioLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  {isPlayingAudio ? "Mute Narration" : "Listen to Host"}
                </button>
              </div>

              {/* Main Question Card */}
              <div className="lg:col-span-8 bg-gray-900/60 border border-gray-800 rounded-3xl p-6 lg:p-8 space-y-6 shadow-md relative overflow-hidden min-h-[400px] flex flex-col justify-between">
                {/* Background search grounding glow */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    <Search className="w-3.5 h-3.5" />
                    <span>Search-Grounded Question</span>
                  </div>

                  <h3 className="text-lg font-sans font-bold text-white leading-snug">
                    {activeQuestion.question}
                  </h3>

                  {/* Multiple Choice Options */}
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {activeQuestion.options.map((option) => {
                      const isSelected = selectedOption === option;
                      const isCorrectAnswer = option === activeQuestion.correctAnswer;
                      
                      let btnStyle = "bg-gray-950/40 border-gray-850 text-gray-300 hover:bg-gray-900 hover:text-white";
                      if (hasSubmitted) {
                        if (isCorrectAnswer) {
                          btnStyle = "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold";
                        } else if (isSelected) {
                          btnStyle = "bg-rose-500/10 border-rose-500 text-rose-400 font-bold";
                        } else {
                          btnStyle = "bg-gray-950/20 border-gray-900/50 text-gray-500 pointer-events-none";
                        }
                      } else if (isSelected) {
                        btnStyle = "bg-indigo-600/20 border-indigo-500 text-indigo-400 font-bold";
                      }

                      return (
                        <button
                          key={option}
                          id={`option-${option.replace(/\s+/g, "-").toLowerCase()}`}
                          onClick={() => submitAnswer(option)}
                          disabled={hasSubmitted}
                          className={`w-full min-h-[50px] px-5 py-3.5 rounded-2xl border text-left text-sm font-medium transition-all duration-200 flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {hasSubmitted && isCorrectAnswer && (
                            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 ml-2" />
                          )}
                          {hasSubmitted && isSelected && !isCorrectAnswer && (
                            <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Correct/Incorrect Explanation Block */}
                {hasSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl border bg-gray-950/60 border-gray-850 space-y-2 mt-4"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Search className="w-3.5 h-3.5" />
                      <span>Factual Citation (Search Grounded)</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {activeQuestion.searchGroundingContext}
                    </p>
                  </motion.div>
                )}

                {/* Navigation and Citations Footer */}
                <div className="pt-4 border-t border-gray-850 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
                  {/* Sources display if we have them */}
                  <div className="text-xs text-gray-400">
                    {sources.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-500">Grounded via:</span>
                        {sources.slice(0, 2).map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-950/10 border border-indigo-950/40 px-2 py-1 rounded"
                          >
                            {src.title.length > 15 ? `${src.title.substring(0, 15)}...` : src.title}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="italic">Powered by Google Search</span>
                    )}
                  </div>

                  {/* Next Question Action */}
                  <div className="flex justify-end shrink-0">
                    {hasSubmitted ? (
                      <button
                        id="next-question-btn"
                        onClick={nextQuestion}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                      >
                        {currentIndex + 1 === questions.length ? "Finish Quiz" : "Next Question"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 italic flex items-center gap-1.5 py-3">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Select an option to proceed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Dynamic score summary Stage */}
        {gameState === "summary" && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl text-center shadow-xl space-y-6 max-w-2xl mx-auto"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">
              🏆
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-sans font-bold text-white">Show Complete!</h3>
              <p className="text-sm text-gray-400">You completed the {category} round.</p>
            </div>

            {/* Score Ring */}
            <div className="bg-gray-950/60 border border-gray-850 p-6 rounded-2xl max-w-sm mx-auto space-y-3">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">Final Score</span>
              <div className="text-5xl font-mono font-black text-indigo-400">{score} / {questions.length}</div>
              <p className="text-xs text-gray-400">
                Correct answers are verified using Google Search grounding.
              </p>
            </div>

            {/* Personalized Host Feedback */}
            <div className="bg-indigo-950/10 border border-indigo-500/10 rounded-2xl p-6 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  Host's Performance Review
                </span>
                {isPlayingAudio && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
              </div>
              
              {evalLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating evaluation...</span>
                </div>
              ) : (
                <p className="text-sm text-gray-300 leading-relaxed italic">
                  "{finalEvaluation}"
                </p>
              )}

              <button
                id="replay-evaluation-btn"
                onClick={() => playTTS(finalEvaluation)}
                disabled={evalLoading || isPlayingAudio}
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Listen to host scorecard
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="play-again-btn"
                onClick={() => setGameState("setup")}
                className="w-full sm:w-auto px-6 py-3.5 bg-white text-black hover:bg-gray-100 font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
