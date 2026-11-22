import { describe, expect, it } from 'vitest';
import { LANGS } from '../words/lang';
import { wordsFor } from '../words/list';
import {
  LEVELS,
  RULES,
  countReadings,
  generate,
  hintWord,
  lineCells,
  matchWord,
  newGame,
  reducer,
  snapEnd,
  DIRECTIONS,
} from './logic';

describe('lines', () => {
  it('joins two cells along a row, a column or a diagonal', () => {
    expect(lineCells(5, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(lineCells(5, 3, 0)).toEqual([3, 2, 1, 0]);
    expect(lineCells(5, 2, 12)).toEqual([2, 7, 12]);
    expect(lineCells(5, 0, 18)).toEqual([0, 6, 12, 18]);
    expect(lineCells(5, 20, 4)).toEqual([20, 16, 12, 8, 4]);
    expect(lineCells(5, 7, 7)).toEqual([7]);
  });

  it('refuses cells that do not line up', () => {
    expect(lineCells(5, 0, 7)).toBeNull();
    expect(lineCells(5, 0, 13)).toBeNull();
  });
});

describe('snapping a drag', () => {
  it('follows the nearest straight direction', () => {
    // From the middle of a 9x9 grid (row 4, column 4).
    const from = 4 * 9 + 4;
    expect(snapEnd(9, from, 4.2, 7.1)).toBe(4 * 9 + 7); // nearly straight right
    expect(snapEnd(9, from, 7, 3.7)).toBe(7 * 9 + 4); // nearly straight down
    expect(snapEnd(9, from, 6.9, 7.2)).toBe(7 * 9 + 7); // down-right diagonal
    expect(snapEnd(9, from, 1.2, 0.9)).toBe(1 * 9 + 1); // up-left diagonal
    expect(snapEnd(9, from, 2, 6)).toBe(2 * 9 + 6); // up-right diagonal
  });

  it('stays put for a tiny movement and never leaves the board', () => {
    const from = 4 * 9 + 4;
    expect(snapEnd(9, from, 4.2, 4.3)).toBe(from);
    expect(snapEnd(9, from, 4, 30)).toBe(4 * 9 + 8);
    expect(snapEnd(9, 0, -5, -5)).toBe(0);
    expect(snapEnd(9, 8, 20, -12)).toBe(8 * 9); // from the top-right corner, down-left
  });

  it('always ends on a cell that lines up with the start', () => {
    for (let k = 0; k < 200; k++) {
      const from = (k * 7) % 81;
      const end = snapEnd(9, from, ((k * 13) % 100) / 10 - 0.5, ((k * 29) % 100) / 10 - 0.5);
      expect(lineCells(9, from, end)).not.toBeNull();
    }
  });
});

describe('countReadings', () => {
  it('counts a word in every direction it appears', () => {
    //  C A T
    //  A . A
    //  T A C
    const grid = ['C', 'A', 'T', 'A', 'X', 'A', 'T', 'A', 'C'];
    expect(countReadings(grid, 3, 'CAT')).toBe(4);
    expect(countReadings(grid, 3, 'TAC')).toBe(4);
    expect(countReadings(grid, 3, 'CXC')).toBe(2);
    expect(countReadings(grid, 3, 'DOG')).toBe(0);
  });
});

describe('generated puzzles', () => {
  for (const lang of LANGS) {
    for (const level of LEVELS) {
      it(`${lang} ${level}: right size, right words, each readable in exactly one place`, () => {
        const rules = RULES[level];
        const allowed = rules.directions.map((d) => DIRECTIONS[d].join());
        for (let seed = 1; seed <= 12; seed++) {
          const p = generate(lang, level, seed, wordsFor(lang));
          expect(p.grid).toHaveLength(rules.size ** 2);
          expect(p.grid.every((l) => (lang === 'es' ? /^[A-ZÑ]$/ : /^[A-Z]$/).test(l))).toBe(true);
          expect(p.words).toHaveLength(rules.words);
          expect(new Set(p.words.map((w) => w.answer)).size).toBe(rules.words);
          for (const w of p.words) {
            expect(w.answer.length).toBeGreaterThanOrEqual(4);
            expect(w.answer.length).toBeLessThanOrEqual(7);
            expect(w.cells.map((c) => p.grid[c]).join('')).toBe(w.answer);
            expect(lineCells(p.size, w.cells[0], w.cells[w.cells.length - 1])).toEqual(w.cells);
            const step = [
              Math.floor(w.cells[1] / p.size) - Math.floor(w.cells[0] / p.size),
              (w.cells[1] % p.size) - (w.cells[0] % p.size),
            ].join();
            expect(allowed).toContain(step);
            expect(countReadings(p.grid, p.size, w.answer)).toBe(1);
            // The reverse must not hide somewhere else either.
            expect(countReadings(p.grid, p.size, [...w.answer].reverse().join(''))).toBe(1);
          }
        }
      });
    }
  }

  it('is reproducible from a seed and differs between seeds', () => {
    const pool = wordsFor('pt');
    expect(generate('pt', 'medium', 42, pool)).toEqual(generate('pt', 'medium', 42, pool));
    expect(generate('pt', 'medium', 42, pool).grid).not.toEqual(generate('pt', 'medium', 43, pool).grid);
  });

  it('keeps accents in the word list but not in the grid', () => {
    const pool = wordsFor('pt');
    let sawAccent = false;
    for (let seed = 1; seed <= 30 && !sawAccent; seed++) {
      const p = generate('pt', 'hard', seed, pool);
      sawAccent = p.words.some((w) => w.display !== w.answer);
      expect(p.grid.join('')).toMatch(/^[A-Z]+$/);
    }
    expect(sawAccent).toBe(true);
  });
});

describe('playing', () => {
  const fresh = () => newGame(generate('en', 'easy', 7, wordsFor('en')));

  it('finds a word selected forwards or backwards, once', () => {
    let s = fresh();
    const word = s.words[0];
    expect(matchWord(s, word.cells)).toBe(0);
    expect(matchWord(s, word.cells.slice().reverse())).toBe(0);
    s = reducer(s, { type: 'select', cells: word.cells.slice().reverse() });
    expect(s.found).toEqual([0]);
    expect(reducer(s, { type: 'select', cells: word.cells })).toBe(s);
  });

  it('ignores a selection that is not a listed word', () => {
    const s = fresh();
    const word = s.words[0];
    expect(reducer(s, { type: 'select', cells: word.cells.slice(0, -1) })).toBe(s);
    expect(reducer(s, { type: 'select', cells: [word.cells[0]] })).toBe(s);
  });

  it('finishes when every word is found, then stops the clock', () => {
    let s = fresh();
    s = reducer(s, { type: 'tick', seconds: 5 });
    for (const w of s.words) s = reducer(s, { type: 'select', cells: w.cells });
    expect(s.done).toBe(true);
    expect(s.found).toHaveLength(s.words.length);
    expect(reducer(s, { type: 'tick', seconds: 5 }).elapsed).toBe(5);
  });

  it('hints point at a word still to find and are counted', () => {
    let s = fresh();
    expect(hintWord(s)).toBe(0);
    s = reducer(s, { type: 'select', cells: s.words[0].cells });
    expect(hintWord(s)).toBe(1);
    s = reducer(s, { type: 'hint' });
    expect(s.hints).toBe(1);
  });
});
