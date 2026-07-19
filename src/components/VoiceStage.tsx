import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Loader2, 
  AlertCircle, 
  Radio, 
  XCircle, 
  CheckCircle,
  MessageSquare,
  HelpCircle,
  Sparkles
} from "lucide-react";

interface VoiceStageProps {
  personalityId: string;
  hostName: string;
  onClose: () => void;
}

export default function VoiceStage({ personalityId, hostName, onClose }: VoiceStageProps) {
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [errorMessage, setErrorMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);

  // Subtitle/Transcription States
  const [hostTranscript, setHostTranscript] = useState("");
  const [userTranscript, setUserTranscript] = useState("");

  // Refs for audio processing and web sockets
  const socketRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio queue for synchronized gapless playback
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  // Animation visualizer bars
  const [userVolume, setUserVolume] = useState<number>(0);
  const [hostVolume, setHostVolume] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  const startVoiceSession = async () => {
    setConnectionStatus("connecting");
    setErrorMessage("");
    setHostTranscript("");
    setUserTranscript("");

    try {
      // 1. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // 2. Initialize input AudioContext at 16kHz (for mic) and output at 24kHz (for Gemini)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      // 3. Connect WebSocket to local full-stack server
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live?personality=${personalityId}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to Voice Stage");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "status") {
            if (data.status === "connected") {
              setConnectionStatus("connected");
              // Start streaming mic audio once socket and session are up
              startStreamingMic();
            } else if (data.status === "session_closed") {
              setConnectionStatus("disconnected");
            }
          } else if (data.type === "error") {
            setConnectionStatus("error");
            setErrorMessage(data.error);
          } else if (data.type === "gemini") {
            handleGeminiLiveMessage(data.message);
          }
        } catch (err) {
          console.error("Error parsing websocket message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        setConnectionStatus("error");
        setErrorMessage("Connection failed. Make sure your server is online.");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setConnectionStatus("disconnected");
      };

    } catch (err: any) {
      console.error("Microphone or WebSocket error:", err);
      setConnectionStatus("error");
      setErrorMessage(err.message || "Failed to access microphone. Please check permissions.");
    }
  };

  const startStreamingMic = () => {
    if (!inputAudioCtxRef.current || !micStreamRef.current || !socketRef.current) return;

    const source = inputAudioCtxRef.current.createMediaStreamSource(micStreamRef.current);
    // Create processor node with 4096 buffer size, 1 input channel, 1 output channel
    const processor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current = processor;

    source.connect(processor);
    processor.connect(inputAudioCtxRef.current.destination);

    processor.onaudioprocess = (e) => {
      if (isMuted || socketRef.current?.readyState !== WebSocket.OPEN) {
        setUserVolume(0);
        return;
      }

      const inputBuffer = e.inputBuffer.getChannelData(0);
      
      // Calculate real-time user mic volume for the waveform UI
      let sum = 0;
      for (let i = 0; i < inputBuffer.length; i++) {
        sum += inputBuffer[i] * inputBuffer[i];
      }
      const rms = Math.sqrt(sum / inputBuffer.length);
      setUserVolume(Math.min(100, Math.floor(rms * 450)));

      // Convert Float32Array channel data to Int16 Little-Endian Bytes
      const int16Array = new Int16Array(inputBuffer.length);
      for (let i = 0; i < inputBuffer.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputBuffer[i]));
        int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      // Convert buffer to Base64
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(int16Array.buffer))
      );

      // Stream base64 Int16 Little-Endian PCM audio data to server
      socketRef.current.send(JSON.stringify({ audio: base64Audio }));
    };
  };

  const handleGeminiLiveMessage = (message: any) => {
    // 1. Process Voice output chunk
    const audioChunk = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioChunk && outputAudioCtxRef.current) {
      setIsHostSpeaking(true);
      playAudioChunk(outputAudioCtxRef.current, audioChunk);
    }

    // 2. Handle Interruption
    if (message.serverContent?.interrupted) {
      console.log("Interruption received from Gemini!");
      stopPlayback();
      setIsHostSpeaking(false);
    }

    // 3. Handle model turn end
    if (message.serverContent?.turnComplete) {
      setIsHostSpeaking(false);
    }

    // 4. Handle Transcriptions (Host / Model output)
    const modelParts = message.serverContent?.modelTurn?.parts;
    if (modelParts) {
      for (const part of modelParts) {
        if (part.text) {
          setHostTranscript((prev) => prev + part.text);
        }
      }
    }

    // 5. Handle Transcriptions (User voice input)
    // The inputAudioTranscription field is populated if transcription is enabled
    const inputParts = message.serverContent?.inputAudioTranscription?.parts;
    if (inputParts) {
      for (const part of inputParts) {
        if (part.text) {
          setUserTranscript((prev) => prev + part.text);
        }
      }
    }

    // Clear user transcript when a new host turn starts
    if (message.serverContent?.modelTurn) {
      setUserTranscript("");
    }
  };

  const base64ToFloat32PCM = (base64: string): Float32Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    return float32;
  };

  const playAudioChunk = (audioCtx: AudioContext, base64Audio: string) => {
    const float32 = base64ToFloat32PCM(base64Audio);

    // Calculate host output volume for UI visualizer
    let sum = 0;
    for (let i = 0; i < float32.length; i++) {
      sum += float32[i] * float32[i];
    }
    const rms = Math.sqrt(sum / float32.length);
    setHostVolume(Math.min(100, Math.floor(rms * 450)));

    const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);

    const currentTime = audioCtx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      // Buffer of 60ms to handle jitter
      nextStartTimeRef.current = currentTime + 0.06;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    
    audioQueueRef.current.push(source);

    source.onended = () => {
      // Clean up reference
      audioQueueRef.current = audioQueueRef.current.filter(node => node !== source);
      if (audioQueueRef.current.length === 0) {
        setHostVolume(0);
      }
    };
  };

  const stopPlayback = () => {
    audioQueueRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    audioQueueRef.current = [];
    nextStartTimeRef.current = 0;
    setHostVolume(0);
  };

  const stopVoiceSession = () => {
    stopPlayback();

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setConnectionStatus("disconnected");
    setIsHostSpeaking(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div id="voice-stage-container" className="max-w-2xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl space-y-6 text-center relative overflow-hidden">
        {/* Connection Pulse Glow */}
        <div className="absolute top-0 right-0 p-4">
          <div className="flex items-center gap-1.5 bg-gray-950 px-3 py-1.5 rounded-full border border-gray-800">
            <Radio className={`w-4 h-4 text-rose-500 ${connectionStatus === "connected" ? "animate-pulse" : ""}`} />
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Voice Stage</span>
          </div>
        </div>

        {/* Home Screen of Voice Challenge */}
        {connectionStatus === "disconnected" && (
          <div className="space-y-6 py-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl border border-indigo-500/20">
              🎙️
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-sans font-bold text-white">Live Voice stage</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Connect your microphone and play trivia directly via live audio! Talk to {hostName} in real-time, speak your answers, and receive instant verbal feedback.
              </p>
            </div>

            <div className="bg-indigo-950/10 border border-indigo-500/10 p-4 rounded-2xl max-w-md text-left space-y-2">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                Live Stage Rules
              </span>
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside leading-relaxed">
                <li>Your speech is evaluated in real-time by the Live model.</li>
                <li>You can interrupt {hostName} simply by speaking over them.</li>
                <li>Make sure to allow browser microphone access.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="enter-stage-btn"
                onClick={startVoiceSession}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-indigo-500/10 uppercase tracking-wider"
              >
                Join Stage with {hostName}
              </button>
              <button
                id="back-setup-btn"
                onClick={onClose}
                className="px-6 py-4 bg-gray-950 border border-gray-850 hover:bg-gray-900 text-gray-400 hover:text-white rounded-2xl text-sm font-semibold transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Connecting Screen */}
        {connectionStatus === "connecting" && (
          <div className="py-12 flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              <Mic className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-sans font-bold text-white">Opening Voice Link</h3>
              <p className="text-xs text-indigo-400 font-mono">Initializing connection to {hostName}...</p>
            </div>
          </div>
        )}

        {/* Error Screen */}
        {connectionStatus === "error" && (
          <div className="py-8 flex flex-col items-center space-y-6">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-sans font-bold text-white">Connection Error</h3>
              <p className="text-xs text-rose-400 max-w-md leading-relaxed">
                {errorMessage || "An unexpected error occurred while setting up the live session."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="retry-voice-btn"
                onClick={startVoiceSession}
                className="px-6 py-3 bg-white text-black hover:bg-gray-100 font-bold rounded-xl text-xs uppercase tracking-wider"
              >
                Retry Connection
              </button>
              <button
                id="cancel-voice-btn"
                onClick={stopVoiceSession}
                className="px-6 py-3 bg-gray-950 border border-gray-850 text-gray-400 hover:text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Connected Stage */}
        {connectionStatus === "connected" && (
          <div className="space-y-8 py-4">
            {/* Stage Title / Avatar */}
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30">
                  <span className="text-4xl animate-bounce">🎙️</span>
                </div>
                {/* Visualizer ring based on host volume */}
                <span 
                  className="absolute -inset-2 rounded-full border-2 border-indigo-400/40 opacity-70 transition-transform duration-75"
                  style={{ transform: `scale(${1 + hostVolume / 100})` }}
                />
              </div>

              <div>
                <h3 className="text-xl font-sans font-bold text-white flex items-center justify-center gap-1.5">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  {hostName} Live Stage
                </h3>
                <p className="text-xs text-gray-400 italic">
                  Say "Hello" or ask for a question to begin!
                </p>
              </div>
            </div>

            {/* Transcription Subtitle Bubbles */}
            <div className="space-y-4 max-w-xl mx-auto">
              {/* User transcript */}
              <div className="flex flex-col items-end space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <Mic className="w-3 h-3 text-emerald-400" /> You
                </span>
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl px-4 py-2.5 max-w-[85%] text-left text-xs text-emerald-300 min-h-[42px] flex items-center">
                  {userTranscript ? (
                    <span>{userTranscript}</span>
                  ) : (
                    <span className="text-gray-600 italic">Listening to your voice...</span>
                  )}
                </div>
              </div>

              {/* Host transcript */}
              <div className="flex flex-col items-start space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-indigo-400" /> {hostName}
                </span>
                <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-2xl px-4 py-2.5 max-w-[85%] text-left text-xs text-indigo-300 min-h-[42px] flex items-center">
                  {hostTranscript ? (
                    <span>{hostTranscript}</span>
                  ) : (
                    <span className="text-gray-600 italic">Waiting for host response...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Visualizer waveforms */}
            <div className="bg-gray-950/60 border border-gray-850 p-4 rounded-2xl max-w-md mx-auto space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
                <span>Microphone Activity</span>
                <span className="font-mono text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {isMuted ? "MUTED" : "LIVE"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 h-8 justify-center">
                {/* Simulated Waveform reflecting microphone power */}
                {[...Array(12)].map((_, i) => {
                  const factor = Math.sin((i / 11) * Math.PI);
                  const h = isMuted ? 4 : Math.max(4, Math.floor(userVolume * factor * (0.4 + Math.random() * 0.6)));
                  return (
                    <div
                      key={i}
                      className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                id="mute-stage-btn"
                onClick={toggleMute}
                className={`p-4 rounded-2xl border transition-all ${
                  isMuted
                    ? "bg-rose-500 text-white border-rose-500 hover:bg-rose-600"
                    : "bg-gray-950 border-gray-800 text-gray-300 hover:bg-gray-900"
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                id="leave-stage-btn"
                onClick={stopVoiceSession}
                className="px-6 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-rose-600/10"
              >
                Leave Stage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
