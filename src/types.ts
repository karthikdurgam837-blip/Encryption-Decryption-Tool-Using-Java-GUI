export interface HostPersonality {
  id: string;
  name: string;
  tagline: string;
  voice: "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr";
  description: string;
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  hostIntroCommentary: string;
  hostCorrectCommentary: string;
  hostIncorrectCommentary: string;
  searchGroundingContext: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface TriviaResponse {
  success: boolean;
  questions: TriviaQuestion[];
  sources: SearchSource[];
  host: string;
  error?: string;
}
