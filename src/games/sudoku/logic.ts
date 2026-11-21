// Sudoku rules, solver, grader and generator. Pure functions, no UI.

/** 81 cells in row order; 0 means empty. */
export type Grid = number[];

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export type Rng = () => number;

/** Small deterministic generator so a seed always reproduces the same puzzle. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL = 0x1ff; // bits 0..8 stand for digits 1..9

export const rowOf = (i: number) => (i / 9) | 0;
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);

/** The 27 houses: rows 0-8, columns 9-17, boxes 18-26. */
export const UNITS: number[][] = (() => {
  const units: number[][] = Array.from({ length: 27 }, () => []);
  for (let i = 0; i < 81; i++) {
    units[rowOf(i)].push(i);
    units[9 + colOf(i)].push(i);
    units[18 + boxOf(i)].push(i);
  }
  return units;
})();

/** The 20 cells sharing a row, column or box with each cell. */
export const PEERS: number[][] = (() => {
  const peers: number[][] = [];
  for (let i = 0; i < 81; i++) {
    const set = new Set<number>();
    for (const u of [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]) {
      for (const j of UNITS[u]) if (j !== i) set.add(j);
    }
    peers.push([...set]);
  }
  return peers;
})();

const popcount = (m: number) => {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
};
const lowDigit = (m: number) => 32 - Math.clz32(m & -m); // lowest set bit as a digit 1..9

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Cells that break the rules: a filled cell whose digit repeats in one of its houses. */
export function findConflicts(grid: Grid): Set<number> {
  const bad = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const d = grid[i];
      if (!d) continue;
      const prev = seen.get(d);
      if (prev !== undefined) {
        bad.add(prev);
        bad.add(i);
      } else {
        seen.set(d, i);
      }
    }
  }
  return bad;
}

/**
 * Backtracking search on bitmasks, always branching on the most constrained cell.
 * Stops once `limit` solutions are found. With an rng, digits are tried in random order.
 */
function search(grid: Grid, limit: number, rng?: Rng): { count: number; first: Grid | null } {
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  const work = grid.slice();
  for (let i = 0; i < 81; i++) {
    const d = work[i];
    if (!d) continue;
    const bit = 1 << (d - 1);
    if (rows[rowOf(i)] & bit || cols[colOf(i)] & bit || boxes[boxOf(i)] & bit) {
      return { count: 0, first: null };
    }
    rows[rowOf(i)] |= bit;
    cols[colOf(i)] |= bit;
    boxes[boxOf(i)] |= bit;
  }

  let count = 0;
  let first: Grid | null = null;

  const step = (): void => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (work[i]) continue;
      const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = popcount(mask);
      if (n === 0) return;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      count++;
      if (!first) first = work.slice();
      return;
    }
    const digits: number[] = [];
    for (let m = bestMask; m; m &= m - 1) digits.push(lowDigit(m));
    if (rng) shuffle(digits, rng);
    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);
    for (const d of digits) {
      const bit = 1 << (d - 1);
      work[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      step();
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      work[best] = 0;
      if (count >= limit) return;
    }
  };

  step();
  return { count, first };
}

export function solve(grid: Grid): Grid | null {
  return search(grid, 1).first;
}

export function countSolutions(grid: Grid, limit = 2): number {
  return search(grid, limit).count;
}

export function generateSolved(rng: Rng): Grid {
  return search(new Array<number>(81).fill(0), 1, rng).first!;
}

/**
 * How hard a puzzle is for a person, by the techniques needed:
 * 1 = singles only, 2 = also locked candidates and naked pairs, 3 = beyond those.
 */
export type Grade = 1 | 2 | 3;

export function grade(puzzle: Grid): Grade {
  const grid = puzzle.slice();
  const cand = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    let mask = ALL;
    for (const p of PEERS[i]) if (grid[p]) mask &= ~(1 << (grid[p] - 1));
    cand[i] = mask;
  }
  let empty = grid.filter((d) => !d).length;

  const place = (i: number, d: number) => {
    grid[i] = d;
    cand[i] = 0;
    const bit = 1 << (d - 1);
    for (const p of PEERS[i]) cand[p] &= ~bit;
    empty--;
  };

  const singles = (): boolean => {
    let progress = false;
    for (let i = 0; i < 81; i++) {
      if (!grid[i] && cand[i] && (cand[i] & (cand[i] - 1)) === 0) {
        place(i, lowDigit(cand[i]));
        progress = true;
      }
    }
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << (d - 1);
        let where = -1;
        let n = 0;
        for (const i of unit) {
          if (cand[i] & bit) {
            where = i;
            n++;
          }
        }
        if (n === 1) {
          place(where, d);
          progress = true;
        }
      }
    }
    return progress;
  };

  const lockedCandidates = (): boolean => {
    let progress = false;
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << (d - 1);
        const cells = UNITS[u].filter((i) => cand[i] & bit);
        if (cells.length < 2) continue;
        // If every spot for d in this house also lies in one crossing house,
        // d can be removed from the rest of that crossing house.
        const crossing =
          u >= 18
            ? [rowOf(cells[0]), 9 + colOf(cells[0])]
            : [18 + boxOf(cells[0])];
        for (const other of crossing) {
          const inOther = UNITS[other];
          if (!cells.every((i) => inOther.includes(i))) continue;
          for (const j of inOther) {
            if (cand[j] & bit && !cells.includes(j)) {
              cand[j] &= ~bit;
              progress = true;
            }
          }
        }
      }
    }
    return progress;
  };

  const nakedPairs = (): boolean => {
    let progress = false;
    for (const unit of UNITS) {
      for (let a = 0; a < 9; a++) {
        const m = cand[unit[a]];
        if (popcount(m) !== 2) continue;
        for (let b = a + 1; b < 9; b++) {
          if (cand[unit[b]] !== m) continue;
          for (let k = 0; k < 9; k++) {
            if (k === a || k === b) continue;
            if (cand[unit[k]] & m) {
              cand[unit[k]] &= ~m;
              progress = true;
            }
          }
        }
      }
    }
    return progress;
  };

  let level: Grade = 1;
  while (empty > 0) {
    if (singles()) continue;
    if (lockedCandidates() || nakedPairs()) {
      level = 2;
      continue;
    }
    return 3;
  }
  return level;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  seed: number;
}

interface Target {
  /** Hardest technique level the digger may introduce. */
  maxGrade: Grade;
  /** Level the finished puzzle must reach. */
  needGrade: Grade;
  /** Stop removing clues once this many are left. */
  clues: number;
}

const TARGETS: Record<Difficulty, Target> = {
  easy: { maxGrade: 1, needGrade: 1, clues: 38 },
  medium: { maxGrade: 1, needGrade: 1, clues: 30 },
  hard: { maxGrade: 2, needGrade: 2, clues: 26 },
  expert: { maxGrade: 3, needGrade: 3, clues: 23 },
};

/** Remove clues in mirrored pairs, keeping one solution and staying within the target level. */
function dig(solution: Grid, target: Target, rng: Rng): Grid {
  const puzzle = solution.slice();
  let clues = 81;
  const order = shuffle(
    Array.from({ length: 41 }, (_, i) => i),
    rng,
  );
  for (const i of order) {
    if (clues <= target.clues) break;
    const j = 80 - i;
    const saved = [puzzle[i], puzzle[j]];
    puzzle[i] = 0;
    puzzle[j] = 0;
    const ok =
      countSolutions(puzzle, 2) === 1 && (target.maxGrade === 3 || grade(puzzle) <= target.maxGrade);
    if (ok) {
      clues -= i === j ? 1 : 2;
    } else {
      puzzle[i] = saved[0];
      puzzle[j] = saved[1];
    }
  }
  return puzzle;
}

/**
 * Build a puzzle with exactly one solution at the requested difficulty.
 * Tries several boards and keeps the closest match if none hits the level exactly.
 */
export function generatePuzzle(difficulty: Difficulty, seed: number, maxAttempts = 40): Puzzle {
  const rng = mulberry32(seed);
  const target = TARGETS[difficulty];
  let fallback: { puzzle: Grid; solution: Grid; miss: number } | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolved(rng);
    const puzzle = dig(solution, target, rng);
    const miss = Math.abs(grade(puzzle) - target.needGrade);
    if (miss === 0) return { puzzle, solution, difficulty, seed };
    if (!fallback || miss < fallback.miss) fallback = { puzzle, solution, miss };
  }
  return { puzzle: fallback!.puzzle, solution: fallback!.solution, difficulty, seed };
}
