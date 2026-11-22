// Where the crossword keeps its progress. Kept tiny so the home screen can read a
// summary without loading the puzzles.
import { formatTime } from '../../shell/format';
import { load } from '../../shell/storage';
import { puzzleName } from './names';

export const PROGRESS_KEY = 'crossword.progress';
export const CURRENT_KEY = 'crossword.current';

/** What is remembered about one puzzle. */
export interface SavedPuzzle {
  /** One character per cell, '.' for empty or a block. */
  letters: string;
  /** One digit per cell: 0 none, 1 flagged wrong, 2 revealed. */
  marks: string;
  elapsed: number;
  helped: boolean;
  done: boolean;
}

export type Progress = Record<string, SavedPuzzle>;

/** One line describing the puzzle in progress, or null when there isn't one. */
export function savedSummary(): string | null {
  const id = load<string | null>(CURRENT_KEY, null);
  if (!id) return null;
  const saved = load<Progress>(PROGRESS_KEY, {})[id];
  if (!saved || saved.done) return null;
  return `${puzzleName(id)} · ${formatTime(saved.elapsed ?? 0)}`;
}
