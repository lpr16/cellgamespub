// Sudoku game state and the moves a player can make. Pure reducer, no UI.
import { PEERS, type Difficulty, type Grid, type Puzzle } from './logic';

interface Snapshot {
  values: Grid;
  notes: number[];
}

export interface SudokuState {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  seed: number;
  /** Current digits, givens included. */
  values: Grid;
  /** Pencil marks per cell as a bitmask, bit d-1 for digit d. */
  notes: number[];
  selected: number | null;
  notesMode: boolean;
  elapsed: number;
  mistakes: number;
  hints: number;
  history: Snapshot[];
  done: boolean;
}

export type SudokuAction =
  | { type: 'select'; cell: number | null }
  | { type: 'digit'; digit: number }
  | { type: 'erase' }
  | { type: 'toggleNotes' }
  | { type: 'undo' }
  | { type: 'hint' }
  | { type: 'tick'; seconds: number }
  | { type: 'move'; dx: number; dy: number };

const HISTORY_LIMIT = 300;

export function newGame(p: Puzzle): SudokuState {
  return {
    puzzle: p.puzzle,
    solution: p.solution,
    difficulty: p.difficulty,
    seed: p.seed,
    values: p.puzzle.slice(),
    notes: new Array<number>(81).fill(0),
    selected: null,
    notesMode: false,
    elapsed: 0,
    mistakes: 0,
    hints: 0,
    history: [],
    done: false,
  };
}

export const isGiven = (s: SudokuState, cell: number) => s.puzzle[cell] !== 0;

const isSolved = (s: SudokuState, values: Grid) => values.every((d, i) => d === s.solution[i]);

function withHistory(s: SudokuState): Snapshot[] {
  const history = [...s.history, { values: s.values, notes: s.notes }];
  return history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history;
}

/** Put a digit in a cell and clear that digit from the pencil marks of its peers. */
function place(s: SudokuState, cell: number, digit: number): Pick<SudokuState, 'values' | 'notes'> {
  const values = s.values.slice();
  const notes = s.notes.slice();
  values[cell] = digit;
  notes[cell] = 0;
  const bit = 1 << (digit - 1);
  for (const p of PEERS[cell]) notes[p] &= ~bit;
  return { values, notes };
}

export function reducer(s: SudokuState, a: SudokuAction): SudokuState {
  switch (a.type) {
    case 'select':
      return { ...s, selected: a.cell };

    case 'move': {
      if (s.selected === null) return { ...s, selected: 40 };
      const row = Math.min(8, Math.max(0, Math.floor(s.selected / 9) + a.dy));
      const col = Math.min(8, Math.max(0, (s.selected % 9) + a.dx));
      return { ...s, selected: row * 9 + col };
    }

    case 'toggleNotes':
      return { ...s, notesMode: !s.notesMode };

    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'digit': {
      const cell = s.selected;
      if (s.done || cell === null || isGiven(s, cell)) return s;
      if (s.notesMode) {
        if (s.values[cell]) return s;
        const notes = s.notes.slice();
        notes[cell] ^= 1 << (a.digit - 1);
        return { ...s, notes, history: withHistory(s) };
      }
      if (s.values[cell] === a.digit) {
        const values = s.values.slice();
        values[cell] = 0;
        return { ...s, values, history: withHistory(s) };
      }
      const next = place(s, cell, a.digit);
      const wrong = a.digit !== s.solution[cell];
      return {
        ...s,
        ...next,
        history: withHistory(s),
        mistakes: s.mistakes + (wrong ? 1 : 0),
        done: isSolved(s, next.values),
      };
    }

    case 'erase': {
      const cell = s.selected;
      if (s.done || cell === null || isGiven(s, cell)) return s;
      if (!s.values[cell] && !s.notes[cell]) return s;
      const values = s.values.slice();
      const notes = s.notes.slice();
      values[cell] = 0;
      notes[cell] = 0;
      return { ...s, values, notes, history: withHistory(s) };
    }

    case 'undo': {
      if (s.done || s.history.length === 0) return s;
      const last = s.history[s.history.length - 1];
      return { ...s, values: last.values, notes: last.notes, history: s.history.slice(0, -1) };
    }

    case 'hint': {
      if (s.done) return s;
      const open = (i: number) => s.values[i] !== s.solution[i];
      let cell = s.selected !== null && open(s.selected) ? s.selected : -1;
      if (cell < 0) {
        // Prefer the unfinished cell with the fewest possibilities left: the most natural next step.
        let best = 10;
        for (let i = 0; i < 81; i++) {
          if (!open(i)) continue;
          const used = new Set(PEERS[i].map((p) => s.values[p]).filter(Boolean));
          const options = 9 - used.size;
          if (options < best) {
            best = options;
            cell = i;
          }
        }
      }
      if (cell < 0) return s;
      const next = place(s, cell, s.solution[cell]);
      return {
        ...s,
        ...next,
        selected: cell,
        hints: s.hints + 1,
        history: withHistory(s),
        done: isSolved(s, next.values),
      };
    }
  }
}

/** How many of each digit are on the board, index 1..9. */
export function digitCounts(values: Grid): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const d of values) counts[d]++;
  return counts;
}
