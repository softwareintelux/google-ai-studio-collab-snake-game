export interface Track {
  id: string;
  title: string;
  genre: string;
  bpm: number;
  description: string;
  color: string; // Tailwind color name for specific track accent styles
  notes: {
    bass: number[]; // Midi notes or frequencies in a 16-step sequence
    melody: number[]; // Midi notes or frequencies in a 16-step sequence
    drums: boolean[]; // Simple trigger grid for a synthesizer click/snare
  };
}

export interface GameState {
  score: number;
  highScore: number;
  isGameOver: boolean;
  isPaused: boolean;
  hasStarted: boolean;
  speed: number; // in ms per tick
  classicMode: boolean; // Wrap around vs wall-death
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Position {
  x: number;
  y: number;
}
