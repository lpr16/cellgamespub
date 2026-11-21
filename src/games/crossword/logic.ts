// Crossword puzzle model and the moves a solver can make. Pure functions, no UI.

export type Dir = 'across' | 'down';

/** A puzzle as stored in puzzles.json. */
export interface PuzzleData {
  id: string;
  size: number;
  /** One string per row; '#' is a block, anything else the answer letter. */
  rows: string[];
  entries: EntryData[];
}

export interface EntryData {
  n: number;
  dir: Dir;
  row: number;
  col: number;
  answer: string;
  clue: string;
}

export interface Entry extends EntryData {
  /** Position in the clue list: across clues first, then down. */
  index: number;
  cells: number[];
}

export interface Puzzle {
  id: string;
  size: number;
  /** Answer letter per cell, or '' for a block. */
  solution: string[];
  /** Clue number printed in each cell, 0 for none. */
  numbers: number[];
  entries: Entry[];
  /** For each cell, the entry running through it in each direction, or -1. */
  cellEntry: Record<Dir, number>[];
}

export function buildPuzzle(data: PuzzleData): Puzzle {
  const { size } = data;
  const solution = data.rows.flatMap((row) => [...row].map((ch) => (ch === '#' ? '' : ch)));
  const numbers = new Array<number>(size * size).fill(0);
  const cellEntry = Array.from({ length: size * size }, () => ({ across: -1, down: -1 }));
  const entries = data.entries.map((e, index) => {
    const step = e.dir === 'across' ? 1 : size;
    const first = e.row * size + e.col;
    const cells = Array.from({ length: e.answer.length }, (_, k) => first + k * step);
    numbers[first] = e.n;
    for (const cell of cells) cellEntry[cell][e.dir] = index;
    return { ...e, index, cells };
  });
  return { id: data.id, size, solution, numbers, entries, cellEntry };
}

/** Marks on a cell: nothing, flagged wrong by a check, or filled in by a reveal. */
export const MARK_NONE = 0;
export const MARK_WRONG = 1;
export const MARK_REVEALED = 2;

export interface CrosswordState {
  puzzleId: string;
  /** The solver's letter per cell, '' when empty. */
  letters: string[];
  marks: number[];
  cell: number;
  dir: Dir;
  elapsed: number;
  /** True once a check or reveal has been used. */
  helped: boolean;
  done: boolean;
}

export type CrosswordAction =
  | { type: 'select'; cell: number }
  | { type: 'toggleDir' }
  | { type: 'letter'; letter: string }
  | { type: 'backspace' }
  | { type: 'step'; delta: 1 | -1 }
  | { type: 'goto'; entry: number }
  | { type: 'check' }
  | { type: 'reveal'; what: 'letter' | 'word' }
  | { type: 'clear' }
  | { type: 'tick'; seconds: number };

export function newState(p: Puzzle): CrosswordState {
  const first = p.entries[0];
  return {
    puzzleId: p.id,
    letters: p.solution.map(() => ''),
    marks: p.solution.map(() => MARK_NONE),
    cell: first.cells[0],
    dir: first.dir,
    elapsed: 0,
    helped: false,
    done: false,
  };
}

export function currentEntry(p: Puzzle, s: CrosswordState): Entry {
  const index = p.cellEntry[s.cell][s.dir];
  if (index >= 0) return p.entries[index];
  const other: Dir = s.dir === 'across' ? 'down' : 'across';
  return p.entries[p.cellEntry[s.cell][other]];
}

const isSolved = (p: Puzzle, letters: string[]) => letters.every((l, i) => l === p.solution[i]);

export const isFull = (p: Puzzle, s: CrosswordState) => s.letters.every((l, i) => l !== '' || p.solution[i] === '');

export const isEntryFull = (s: CrosswordState, e: Entry) => e.cells.every((c) => s.letters[c] !== '');

/** Jump to an entry, landing on its first empty cell. */
function enter(s: CrosswordState, e: Entry): CrosswordState {
  const cell = e.cells.find((c) => s.letters[c] === '') ?? e.cells[0];
  return { ...s, cell, dir: e.dir };
}

export function reducer(p: Puzzle, s: CrosswordState, a: CrosswordAction): CrosswordState {
  switch (a.type) {
    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'select': {
      if (p.solution[a.cell] === '') return s;
      const here = p.cellEntry[a.cell];
      const other: Dir = s.dir === 'across' ? 'down' : 'across';
      // Tapping the selected cell again turns the word around, if two words cross there.
      if (a.cell === s.cell) return here[other] >= 0 ? { ...s, dir: other } : s;
      return { ...s, cell: a.cell, dir: here[s.dir] >= 0 ? s.dir : other };
    }

    case 'toggleDir': {
      const other: Dir = s.dir === 'across' ? 'down' : 'across';
      return p.cellEntry[s.cell][other] >= 0 ? { ...s, dir: other } : s;
    }

    case 'step': {
      const count = p.entries.length;
      const next = (currentEntry(p, s).index + a.delta + count) % count;
      return enter(s, p.entries[next]);
    }

    case 'goto':
      return p.entries[a.entry] ? enter(s, p.entries[a.entry]) : s;

    case 'letter': {
      if (s.done || !/^[A-Z]$/.test(a.letter)) return s;
      const entry = currentEntry(p, s);
      let next = s;
      if (s.marks[s.cell] !== MARK_REVEALED) {
        const letters = s.letters.slice();
        const marks = s.marks.slice();
        letters[s.cell] = a.letter;
        marks[s.cell] = MARK_NONE;
        next = { ...s, letters, marks, done: isSolved(p, letters) };
      }
      const at = entry.cells.indexOf(s.cell);
      if (at < entry.cells.length - 1) return { ...next, cell: entry.cells[at + 1], dir: entry.dir };
      // End of the word: carry on to the next clue that still has gaps.
      for (let k = 1; k <= p.entries.length; k++) {
        const candidate = p.entries[(entry.index + k) % p.entries.length];
        if (!isEntryFull(next, candidate)) return enter(next, candidate);
      }
      return { ...next, dir: entry.dir };
    }

    case 'backspace': {
      if (s.done) return s;
      const entry = currentEntry(p, s);
      let cell = s.cell;
      if (s.letters[cell] === '' || s.marks[cell] === MARK_REVEALED) {
        const at = entry.cells.indexOf(cell);
        if (at === 0) return s;
        cell = entry.cells[at - 1];
      }
      if (s.marks[cell] === MARK_REVEALED) return { ...s, cell };
      const letters = s.letters.slice();
      const marks = s.marks.slice();
      letters[cell] = '';
      marks[cell] = MARK_NONE;
      return { ...s, letters, marks, cell };
    }

    case 'check': {
      if (s.done) return s;
      const marks = s.marks.map((m, i) =>
        m === MARK_REVEALED ? m : s.letters[i] !== '' && s.letters[i] !== p.solution[i] ? MARK_WRONG : MARK_NONE,
      );
      return { ...s, marks, helped: true };
    }

    case 'reveal': {
      if (s.done) return s;
      const cells = a.what === 'letter' ? [s.cell] : currentEntry(p, s).cells;
      const letters = s.letters.slice();
      const marks = s.marks.slice();
      for (const c of cells) {
        if (letters[c] !== p.solution[c]) marks[c] = MARK_REVEALED;
        else if (marks[c] === MARK_WRONG) marks[c] = MARK_NONE;
        letters[c] = p.solution[c];
      }
      return { ...s, letters, marks, helped: true, done: isSolved(p, letters) };
    }

    case 'clear':
      return { ...newState(p), cell: s.cell, dir: s.dir };
  }
}

// ---------- Naming ----------

const LEVELS: Record<string, string> = { s: 'Small', m: 'Medium', l: 'Large' };

/** "Medium 3" for the puzzle with id "m03". */
export function puzzleName(id: string): string {
  return `${LEVELS[id[0]] ?? 'Puzzle'} ${Number(id.slice(1))}`;
}
