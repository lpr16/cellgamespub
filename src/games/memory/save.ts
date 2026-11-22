// Tiny summary of the saved Memory game for the home screen.
import { load } from '../../shell/storage';

export const GAME_KEY = 'memory.game';
export const STATS_KEY = 'memory.stats';

const LABELS: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function savedSummary(): string | null {
  const saved = load<{ level?: string; matched?: boolean[]; done?: boolean } | null>(GAME_KEY, null);
  if (!saved || saved.done || !saved.level || !Array.isArray(saved.matched)) return null;
  const found = saved.matched.filter(Boolean).length / 2;
  return `${LABELS[saved.level] ?? 'Game'} · ${found} of ${saved.matched.length / 2} pairs`;
}
