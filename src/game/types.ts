export type StoneColor = 'black' | 'white';
export type Intersection = StoneColor | null;

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: Intersection[][];
  currentPlayer: StoneColor;
  captures: { black: number; white: number };
  koPoint: Position | null;
  passCount: number;
  lastMove: Position | null;
  gameOver: boolean;
  history: string[];
}

export type GameMode = 'pvp' | 'pve';
export type BoardSize = 9 | 13 | 19;
export type AILevel = 'easy' | 'medium';
