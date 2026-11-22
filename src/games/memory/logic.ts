// Memory pairs: turn over two cards at a time and find the matching pictures. Pure, no UI.
import { mulberry32, shuffle } from '../../shell/random';

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

export const BOARDS: Record<Level, { cols: number; rows: number; label: string }> = {
  easy: { cols: 3, rows: 4, label: 'Easy' },
  medium: { cols: 4, rows: 5, label: 'Medium' },
  hard: { cols: 5, rows: 6, label: 'Hard' },
};

/** Pictures on the cards. Plain, familiar things that are easy to tell apart. */
export const PICTURES: { symbol: string; name: string }[] = [
  { symbol: '🍎', name: 'apple' },
  { symbol: '🍌', name: 'banana' },
  { symbol: '🍇', name: 'grapes' },
  { symbol: '🍓', name: 'strawberry' },
  { symbol: '🍉', name: 'watermelon' },
  { symbol: '🍍', name: 'pineapple' },
  { symbol: '🌻', name: 'sunflower' },
  { symbol: '🌷', name: 'tulip' },
  { symbol: '🌈', name: 'rainbow' },
  { symbol: '⭐', name: 'star' },
  { symbol: '🌙', name: 'moon' },
  { symbol: '☀️', name: 'sun' },
  { symbol: '🐶', name: 'dog' },
  { symbol: '🐱', name: 'cat' },
  { symbol: '🐦', name: 'bird' },
  { symbol: '🦋', name: 'butterfly' },
  { symbol: '🐢', name: 'turtle' },
  { symbol: '🐟', name: 'fish' },
  { symbol: '🏠', name: 'house' },
  { symbol: '🎈', name: 'balloon' },
  { symbol: '🎁', name: 'gift' },
  { symbol: '⚽', name: 'ball' },
  { symbol: '🔔', name: 'bell' },
  { symbol: '🚲', name: 'bicycle' },
];

export interface MemoryState {
  level: Level;
  seed: number;
  /** Which picture is at each position. */
  deck: number[];
  matched: boolean[];
  /** Positions turned up this turn and not yet matched: none, one, or a pair that didn't match. */
  open: number[];
  turns: number;
  elapsed: number;
  done: boolean;
}

export type MemoryAction =
  | { type: 'flip'; position: number }
  /** Turn a pair that didn't match face down again. */
  | { type: 'settle' }
  | { type: 'tick'; seconds: number };

export function newGame(level: Level, seed: number): MemoryState {
  const { cols, rows } = BOARDS[level];
  const rng = mulberry32(seed);
  const pairs = (cols * rows) / 2;
  const chosen = shuffle(
    PICTURES.map((_, i) => i),
    rng,
  ).slice(0, pairs);
  const deck = shuffle([...chosen, ...chosen], rng);
  return { level, seed, deck, matched: deck.map(() => false), open: [], turns: 0, elapsed: 0, done: false };
}

export const pairsFound = (s: MemoryState) => s.matched.filter(Boolean).length / 2;

export function reducer(s: MemoryState, a: MemoryAction): MemoryState {
  switch (a.type) {
    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'settle':
      return s.open.length === 2 ? { ...s, open: [] } : s;

    case 'flip': {
      const i = a.position;
      if (s.done || i < 0 || i >= s.deck.length || s.matched[i] || s.open.includes(i)) return s;
      // A pair that didn't match is turned back as soon as the next card is touched.
      if (s.open.length !== 1) return { ...s, open: [i] };
      const first = s.open[0];
      if (s.deck[first] !== s.deck[i]) return { ...s, open: [first, i], turns: s.turns + 1 };
      const matched = s.matched.slice();
      matched[first] = true;
      matched[i] = true;
      return { ...s, matched, open: [], turns: s.turns + 1, done: matched.every(Boolean) };
    }
  }
}
