// Where Solitaire keeps its saved game and statistics. Kept tiny so the home screen
// can read a summary without loading the whole game.
import { load } from '../../shell/storage';

export const GAME_KEY = 'solitaire.game';
export const STATS_KEY = 'solitaire.stats';

/** One line describing the game in progress, or null when there isn't one. */
export function savedSummary(): string | null {
  const saved = load<{ draw?: number; moves?: number; done?: boolean } | null>(GAME_KEY, null);
  if (!saved || saved.done || !saved.draw) return null;
  const moves = saved.moves ?? 0;
  return `Draw ${saved.draw} · ${moves} ${moves === 1 ? 'move' : 'moves'}`;
}
