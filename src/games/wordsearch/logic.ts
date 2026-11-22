// Word search: building a grid and judging the player's selections. Pure functions, no UI.
import { mulberry32, shuffle, type Rng } from '../../shell/random';
import type { Lang } from '../words/lang';
import type { WordEntry } from '../words/list';

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

/** The eight straight directions as [row step, column step]. */
export const DIRECTIONS: [number, number][] = [
  [0, 1], // right
  [1, 0], // down
  [1, 1], // down-right
  [-1, 1], // up-right
  [0, -1], // left
  [-1, 0], // up
  [-1, -1], // up-left
  [1, -1], // down-left
];

interface LevelRules {
  size: number;
  words: number;
  /** Indexes into DIRECTIONS that words may run in. */
  directions: number[];
}

export const RULES: Record<Level, LevelRules> = {
  easy: { size: 8, words: 6, directions: [0, 1] },
  medium: { size: 10, words: 9, directions: [0, 1, 2, 3] },
  hard: { size: 12, words: 12, directions: [0, 1, 2, 3, 4, 5, 6, 7] },
};

const MIN_LENGTH = 4;
const MAX_LENGTH = 7;

export interface PlacedWord {
  /** As shown in the list, with accents. */
  display: string;
  /** As it reads in the grid. */
  answer: string;
  /** Cells from first letter to last. */
  cells: number[];
}

export interface WordSearchPuzzle {
  lang: Lang;
  level: Level;
  seed: number;
  size: number;
  /** One letter per cell, row by row. */
  grid: string[];
  words: PlacedWord[];
}

export interface WordSearchState extends WordSearchPuzzle {
  /** Indexes of the words found, in the order they were found. */
  found: number[];
  elapsed: number;
  hints: number;
  done: boolean;
}

export type WordSearchAction =
  | { type: 'select'; cells: number[] }
  | { type: 'hint' }
  | { type: 'tick'; seconds: number };

// ---------- Geometry ----------

/** The cells in a straight line from one cell to another, or null if they don't line up. */
export function lineCells(size: number, from: number, to: number): number[] | null {
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  const dr = Math.floor(to / size) - r0;
  const dc = (to % size) - c0;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const length = Math.max(Math.abs(dr), Math.abs(dc));
  const cells: number[] = [];
  for (let k = 0; k <= length; k++) {
    cells.push((r0 + Math.sign(dr) * k) * size + c0 + Math.sign(dc) * k);
  }
  return cells;
}

/**
 * Where a drag ends when it is held to the eight straight directions.
 * `row` and `col` are the finger's position in cell units and may fall between cells.
 */
export function snapEnd(size: number, from: number, row: number, col: number): number {
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  const dr = row - r0;
  const dc = col - c0;
  if (Math.hypot(dr, dc) < 0.5) return from;
  // Pick the direction closest to the finger's angle, then go as far along it as the finger has.
  const octant = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  const stepR = Math.round(Math.sin((octant * Math.PI) / 4));
  const stepC = Math.round(Math.cos((octant * Math.PI) / 4));
  const along = (dr * stepR + dc * stepC) / (stepR !== 0 && stepC !== 0 ? 2 : 1);
  let length = Math.max(0, Math.round(along));
  // Stay on the board.
  while (length > 0) {
    const r = r0 + stepR * length;
    const c = c0 + stepC * length;
    if (r >= 0 && r < size && c >= 0 && c < size) break;
    length--;
  }
  return (r0 + stepR * length) * size + c0 + stepC * length;
}

/** How many times a word can be read in the grid, in any of the eight directions. */
export function countReadings(grid: string[], size: number, answer: string): number {
  let count = 0;
  for (let start = 0; start < grid.length; start++) {
    if (grid[start] !== answer[0]) continue;
    const r0 = Math.floor(start / size);
    const c0 = start % size;
    for (const [dr, dc] of DIRECTIONS) {
      const rEnd = r0 + dr * (answer.length - 1);
      const cEnd = c0 + dc * (answer.length - 1);
      if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue;
      let k = 1;
      while (k < answer.length && grid[(r0 + dr * k) * size + c0 + dc * k] === answer[k]) k++;
      if (k === answer.length) count++;
    }
  }
  return count;
}

// ---------- Building a puzzle ----------

const reversed = (word: string) => [...word].reverse().join('');

/** Words for one grid: the right length, no palindromes, and none hiding inside another. */
function chooseWords(pool: WordEntry[], rules: LevelRules, rng: Rng): WordEntry[] {
  const longest = Math.min(MAX_LENGTH, rules.size);
  const candidates = shuffle(
    pool.filter((w) => w.answer.length >= MIN_LENGTH && w.answer.length <= longest && w.answer !== reversed(w.answer)),
    rng,
  );
  const chosen: WordEntry[] = [];
  for (const word of candidates) {
    if (chosen.length === rules.words) break;
    const clash = chosen.some((other) =>
      [other.answer, reversed(other.answer)].some((o) => o.includes(word.answer) || word.answer.includes(o)),
    );
    if (!clash) chosen.push(word);
  }
  return chosen;
}

/** Put the words in an empty grid, letting them cross where letters agree. */
function placeWords(words: WordEntry[], rules: LevelRules, rng: Rng): { grid: string[]; placed: PlacedWord[] } | null {
  const { size } = rules;
  const grid = new Array<string>(size * size).fill('');
  const placed: PlacedWord[] = [];
  // Longest first: they are the hardest to fit.
  const order = words.slice().sort((a, b) => b.answer.length - a.answer.length);
  for (const word of order) {
    let cells: number[] | null = null;
    for (let attempt = 0; attempt < 200 && !cells; attempt++) {
      const [dr, dc] = DIRECTIONS[rules.directions[Math.floor(rng() * rules.directions.length)]];
      const r0 = Math.floor(rng() * size);
      const c0 = Math.floor(rng() * size);
      const rEnd = r0 + dr * (word.answer.length - 1);
      const cEnd = c0 + dc * (word.answer.length - 1);
      if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue;
      const line = [...word.answer].map((_, k) => (r0 + dr * k) * size + c0 + dc * k);
      if (line.every((cell, k) => grid[cell] === '' || grid[cell] === word.answer[k])) cells = line;
    }
    if (!cells) return null;
    cells.forEach((cell, k) => (grid[cell] = word.answer[k]));
    placed.push({ display: word.display, answer: word.answer, cells });
  }
  // List the words in the order they were chosen, not by length.
  placed.sort((a, b) => words.findIndex((w) => w.answer === a.answer) - words.findIndex((w) => w.answer === b.answer));
  return { grid, placed };
}

/** A way to draw random letters as often as they occur in the language's own words. */
function letterPicker(pool: WordEntry[]): (rng: Rng) => string {
  const counts = new Map<string, number>();
  let total = 0;
  for (const w of pool) {
    for (const letter of w.answer) {
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
      total++;
    }
  }
  const letters = [...counts.entries()];
  return (rng) => {
    let pick = rng() * total;
    for (const [letter, n] of letters) {
      pick -= n;
      if (pick < 0) return letter;
    }
    return letters[0][0];
  };
}

/**
 * Build a puzzle. The same language, level, seed and word pool always give the same grid.
 * Every listed word can be read in exactly one place.
 */
export function generate(lang: Lang, level: Level, seed: number, pool: WordEntry[]): WordSearchPuzzle {
  const rules = RULES[level];
  const rng = mulberry32(seed);
  const pickLetter = letterPicker(pool);
  for (let attempt = 0; attempt < 500; attempt++) {
    const words = chooseWords(pool, rules, rng);
    if (words.length < rules.words) break;
    const layout = placeWords(words, rules, rng);
    if (!layout) continue;
    for (let fill = 0; fill < 20; fill++) {
      const grid = layout.grid.map((letter) => letter || pickLetter(rng));
      if (layout.placed.every((w) => countReadings(grid, rules.size, w.answer) === 1)) {
        return { lang, level, seed, size: rules.size, grid, words: layout.placed };
      }
    }
  }
  throw new Error(`Could not build a ${level} word search in ${lang}`);
}

// ---------- Playing ----------

export function newGame(puzzle: WordSearchPuzzle): WordSearchState {
  return { ...puzzle, found: [], elapsed: 0, hints: 0, done: false };
}

/** The word a selection picks out, read in either direction, or -1. */
export function matchWord(s: WordSearchState, cells: number[]): number {
  if (cells.length < 2) return -1;
  const first = cells[0];
  const last = cells[cells.length - 1];
  return s.words.findIndex((w, i) => {
    if (s.found.includes(i) || w.cells.length !== cells.length) return false;
    const a = w.cells[0];
    const b = w.cells[w.cells.length - 1];
    return (a === first && b === last) || (a === last && b === first);
  });
}

/** A word still to find, for the hint: the first in the list. */
export function hintWord(s: WordSearchState): number {
  return s.words.findIndex((_, i) => !s.found.includes(i));
}

export function reducer(s: WordSearchState, a: WordSearchAction): WordSearchState {
  switch (a.type) {
    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'hint':
      return s.done ? s : { ...s, hints: s.hints + 1 };

    case 'select': {
      if (s.done) return s;
      const index = matchWord(s, a.cells);
      if (index < 0) return s;
      const found = [...s.found, index];
      return { ...s, found, done: found.length === s.words.length };
    }
  }
}
