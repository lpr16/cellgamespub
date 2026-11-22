// Where the word search keeps its saved game and statistics. Kept tiny so the home
// screen can read a summary without loading the game.
import { load } from '../../shell/storage';
import type { Lang } from '../words/lang';

export const GAME_KEY = 'wordsearch.game';
export const STATS_KEY = 'wordsearch.stats';

export const LEVEL_NAMES: Record<Lang, Record<'easy' | 'medium' | 'hard', string>> = {
  en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  pt: { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' },
  es: { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' },
};

/** One line describing the game in progress, or null when there isn't one. */
export function savedSummary(): string | null {
  const saved = load<{
    lang?: Lang;
    level?: 'easy' | 'medium' | 'hard';
    found?: number[];
    words?: unknown[];
    done?: boolean;
  } | null>(GAME_KEY, null);
  const name = saved?.lang && saved.level ? LEVEL_NAMES[saved.lang]?.[saved.level] : undefined;
  if (!saved || saved.done || !name) return null;
  return `${name} · ${saved.found?.length ?? 0}/${saved.words?.length ?? 0}`;
}
