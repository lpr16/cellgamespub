// Where Hangman keeps its round in progress and statistics. Kept tiny so the home
// screen can read a summary without loading the game.
import { load } from '../../shell/storage';

export const GAME_KEY = 'hangman.game';
export const STATS_KEY = 'hangman.stats';

/** One line describing the round in progress, or null when there isn't one. */
export function savedSummary(): string | null {
  const saved = load<{
    lang?: string;
    display?: string;
    guessed?: string[];
    misses?: number;
    status?: string;
  } | null>(GAME_KEY, null);
  if (!saved?.display || saved.status !== 'playing' || !saved.guessed?.length) return null;
  const letters = saved.lang === 'en' ? 'letters' : 'letras';
  return `${[...saved.display].length} ${letters} · ${saved.misses ?? 0}/6`;
}
