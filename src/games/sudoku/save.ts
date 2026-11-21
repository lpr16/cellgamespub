// Where Sudoku keeps its saved game and statistics. Kept tiny so the home screen
// can read a summary without loading the whole game.
import { load } from '../../shell/storage';
import { formatTime } from '../../shell/format';

export const GAME_KEY = 'sudoku.game';
export const STATS_KEY = 'sudoku.stats';

export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;

/** One line describing the game in progress, or null when there isn't one. */
export function savedSummary(): string | null {
  const saved = load<{ difficulty?: keyof typeof DIFFICULTY_LABELS; elapsed?: number; done?: boolean } | null>(
    GAME_KEY,
    null,
  );
  if (!saved || saved.done || !saved.difficulty) return null;
  return `${DIFFICULTY_LABELS[saved.difficulty]} · ${formatTime(saved.elapsed ?? 0)}`;
}
