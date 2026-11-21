import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  PEERS,
  UNITS,
  countSolutions,
  findConflicts,
  generatePuzzle,
  generateSolved,
  grade,
  mulberry32,
  solve,
} from './logic';

const parse = (s: string) => [...s].map((c) => (c === '.' ? 0 : Number(c)));

// A well-known easy puzzle and its solution.
const EASY = parse(
  '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79',
);
const EASY_SOLVED = parse(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
);

function isValidSolution(grid: number[]) {
  return UNITS.every((unit) => {
    const digits = unit.map((i) => grid[i]).sort();
    return digits.join('') === '123456789';
  });
}

describe('board geometry', () => {
  it('has 27 houses of 9 cells and 20 peers per cell', () => {
    expect(UNITS).toHaveLength(27);
    expect(UNITS.every((u) => u.length === 9)).toBe(true);
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
  });
});

describe('solver', () => {
  it('solves a known puzzle', () => {
    expect(solve(EASY)).toEqual(EASY_SOLVED);
  });

  it('reports a single solution for a proper puzzle', () => {
    expect(countSolutions(EASY)).toBe(1);
  });

  it('finds more than one solution for an empty board', () => {
    expect(countSolutions(new Array(81).fill(0), 2)).toBe(2);
  });

  it('rejects a board that already breaks the rules', () => {
    const bad = EASY.slice();
    bad[2] = 5; // second 5 in the first row
    expect(solve(bad)).toBeNull();
    expect(countSolutions(bad)).toBe(0);
  });
});

describe('findConflicts', () => {
  it('flags both cells of a repeated digit and nothing else', () => {
    const bad = EASY.slice();
    bad[2] = 5;
    expect([...findConflicts(bad)].sort((a, b) => a - b)).toEqual([0, 2]);
    expect(findConflicts(EASY).size).toBe(0);
  });
});

describe('grade', () => {
  it('rates a singles-only puzzle as level 1', () => {
    expect(grade(EASY)).toBe(1);
  });

  it('rates a puzzle needing advanced techniques as level 3', () => {
    const hardest = parse(
      '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..',
    );
    expect(grade(hardest)).toBe(3);
  });
});

describe('generator', () => {
  it('builds a valid full board', () => {
    expect(isValidSolution(generateSolved(mulberry32(7)))).toBe(true);
  });

  it('is reproducible from a seed', () => {
    expect(generatePuzzle('medium', 1234)).toEqual(generatePuzzle('medium', 1234));
  });

  for (const difficulty of DIFFICULTIES) {
    it(`makes ${difficulty} puzzles with exactly one solution that matches`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { puzzle, solution } = generatePuzzle(difficulty, seed);
        expect(isValidSolution(solution)).toBe(true);
        expect(countSolutions(puzzle, 2)).toBe(1);
        expect(solve(puzzle)).toEqual(solution);
        puzzle.forEach((d, i) => {
          if (d) expect(d).toBe(solution[i]);
        });
      }
    });
  }

  it('gives harder levels fewer clues and harder techniques', () => {
    const clues = (g: number[]) => g.filter(Boolean).length;
    const easy = generatePuzzle('easy', 99);
    const medium = generatePuzzle('medium', 99);
    const hard = generatePuzzle('hard', 99);
    const expert = generatePuzzle('expert', 99);
    expect(clues(easy.puzzle)).toBeGreaterThan(clues(medium.puzzle));
    expect(grade(easy.puzzle)).toBe(1);
    expect(grade(medium.puzzle)).toBe(1);
    expect(grade(hard.puzzle)).toBe(2);
    expect(grade(expert.puzzle)).toBe(3);
  });
});
