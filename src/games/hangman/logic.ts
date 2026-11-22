// Hangman rules: one hidden word, one letter at a time, six misses allowed. Pure functions, no UI.
import type { Rng } from '../../shell/random';
import { plain, type Lang } from '../words/lang';
import type { WordEntry } from '../words/list';

export const MAX_MISSES = 6;
const MIN_LENGTH = 5;
const MAX_LENGTH = 7;
/** How many past words are remembered so they don't come round again too soon. */
export const RECENT_LIMIT = 60;

export type Status = 'playing' | 'won' | 'lost';

export interface HangmanState {
  lang: Lang;
  /** The word as written, with accents. */
  display: string;
  clue: string;
  /** Letters tried so far, without accents, in the order they were tried. */
  guessed: string[];
  misses: number;
  clueShown: boolean;
  status: Status;
}

export type HangmanAction = { type: 'guess'; letter: string } | { type: 'showClue' };

export interface HangmanStats {
  played: number;
  won: number;
  streak: number;
  best: number;
  /** Recently used words, without accents, oldest first. */
  recent: string[];
}

export const emptyStats = (): HangmanStats => ({ played: 0, won: 0, streak: 0, best: 0, recent: [] });

/** Choose a word of a comfortable length, avoiding the ones used lately. */
export function pickWord(pool: WordEntry[], recent: string[], rng: Rng): WordEntry {
  const suitable = pool.filter((w) => w.answer.length >= MIN_LENGTH && w.answer.length <= MAX_LENGTH);
  const fresh = suitable.filter((w) => !recent.includes(w.answer));
  const from = fresh.length > 0 ? fresh : suitable;
  return from[Math.floor(rng() * from.length)];
}

export function newRound(lang: Lang, word: WordEntry): HangmanState {
  return { lang, display: word.display, clue: word.clue, guessed: [], misses: 0, clueShown: false, status: 'playing' };
}

/**
 * The word as the player sees it: each letter in its written form once guessed, '' otherwise.
 * Guessing A uncovers Á, Ã and Â too, and C uncovers Ç.
 */
export function revealed(s: HangmanState): string[] {
  const letters = [...plain(s.display)];
  return [...s.display].map((written, i) => (s.status !== 'playing' || s.guessed.includes(letters[i]) ? written : ''));
}

/** Whether a tried letter was in the word. */
export const isHit = (s: HangmanState, letter: string) => plain(s.display).includes(letter);

export function reducer(s: HangmanState, a: HangmanAction): HangmanState {
  switch (a.type) {
    case 'showClue':
      return s.clueShown ? s : { ...s, clueShown: true };

    case 'guess': {
      const letter = a.letter;
      if (s.status !== 'playing' || !/^[A-ZÑ]$/.test(letter) || s.guessed.includes(letter)) return s;
      const guessed = [...s.guessed, letter];
      const answer = plain(s.display);
      if (answer.includes(letter)) {
        const won = [...answer].every((l) => guessed.includes(l));
        return { ...s, guessed, status: won ? 'won' : 'playing' };
      }
      const misses = s.misses + 1;
      return { ...s, guessed, misses, status: misses >= MAX_MISSES ? 'lost' : 'playing' };
    }
  }
}

/** Update the running totals when a round ends (a skipped round counts as lost). */
export function recordRound(stats: HangmanStats, s: HangmanState, won: boolean): HangmanStats {
  const streak = won ? stats.streak + 1 : 0;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
    recent: [...stats.recent.filter((w) => w !== plain(s.display)), plain(s.display)].slice(-RECENT_LIMIT),
  };
}
