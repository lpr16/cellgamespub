import { describe, expect, it } from 'vitest';
import {
  MARK_NONE,
  MARK_REVEALED,
  MARK_WRONG,
  buildPuzzle,
  currentEntry,
  isFull,
  newState,
  reducer,
  type CrosswordAction,
  type CrosswordState,
  type PuzzleData,
} from './logic';
import { parseId, puzzleName } from './names';
import puzzlesEn from './puzzles.en.json';
import puzzlesEs from './puzzles.es.json';
import puzzlesPt from './puzzles.pt.json';
import { toGridLetter } from './strings';

const SETS: Record<string, PuzzleData[]> = {
  en: puzzlesEn as PuzzleData[],
  pt: puzzlesPt as PuzzleData[],
  es: puzzlesEs as PuzzleData[],
};

/** Upper case without accents, keeping Ñ: the form answers take in the grid. */
const plain = (text: string) =>
  text
    .toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'Ñ');

//   C A T
//   O # E
//   W E N
const TINY: PuzzleData = {
  id: 's99',
  size: 3,
  rows: ['CAT', 'O#E', 'WEN'],
  entries: [
    { n: 1, dir: 'across', row: 0, col: 0, answer: 'CAT', clue: 'Purring pet' },
    { n: 3, dir: 'across', row: 2, col: 0, answer: 'WEN', clue: 'Made-up word' },
    { n: 1, dir: 'down', row: 0, col: 0, answer: 'COW', clue: 'Milk giver' },
    { n: 2, dir: 'down', row: 0, col: 2, answer: 'TEN', clue: 'Number of fingers' },
  ],
};
const tiny = buildPuzzle(TINY);

function play(s: CrosswordState, ...actions: CrosswordAction[]) {
  return actions.reduce((state, a) => reducer(tiny, state, a), s);
}
const type = (word: string): CrosswordAction[] => [...word].map((letter) => ({ type: 'letter', letter }));

describe('buildPuzzle', () => {
  it('works out cells, numbers and crossings', () => {
    expect(tiny.solution).toEqual(['C', 'A', 'T', 'O', '', 'E', 'W', 'E', 'N']);
    expect(tiny.numbers).toEqual([1, 0, 2, 0, 0, 0, 3, 0, 0]);
    expect(tiny.entries[2].cells).toEqual([0, 3, 6]);
    expect(tiny.cellEntry[0]).toEqual({ across: 0, down: 2 });
    expect(tiny.cellEntry[1]).toEqual({ across: 0, down: -1 });
  });
});

describe('moving around', () => {
  it('starts on the first clue', () => {
    const s = newState(tiny);
    expect(s.cell).toBe(0);
    expect(currentEntry(tiny, s).answer).toBe('CAT');
  });

  it('turns the word around when the selected cell is tapped again', () => {
    const s = play(newState(tiny), { type: 'select', cell: 0 });
    expect(s.dir).toBe('down');
    expect(currentEntry(tiny, s).answer).toBe('COW');
  });

  it('switches direction when the tapped cell only has a word the other way', () => {
    const s = play(newState(tiny), { type: 'select', cell: 3 });
    expect(s.dir).toBe('down');
  });

  it('ignores taps on blocks', () => {
    const s = newState(tiny);
    expect(play(s, { type: 'select', cell: 4 })).toBe(s);
  });

  it('steps through the clues in order and wraps round', () => {
    let s = newState(tiny);
    s = play(s, { type: 'step', delta: 1 });
    expect(currentEntry(tiny, s).answer).toBe('WEN');
    s = play(s, { type: 'step', delta: -1 }, { type: 'step', delta: -1 });
    expect(currentEntry(tiny, s).answer).toBe('TEN');
  });
});

describe('typing', () => {
  it('fills the word and moves on to the next clue with gaps', () => {
    const s = play(newState(tiny), ...type('CAT'));
    expect(s.letters.slice(0, 3)).toEqual(['C', 'A', 'T']);
    expect(currentEntry(tiny, s).answer).toBe('WEN');
    expect(s.cell).toBe(6);
  });

  it('backspace clears the cell, then steps back', () => {
    let s = play(newState(tiny), ...type('CA'));
    expect(s.cell).toBe(2);
    s = play(s, { type: 'backspace' });
    expect(s.cell).toBe(1);
    expect(s.letters[1]).toBe('');
    s = play(s, { type: 'backspace' });
    expect(s.cell).toBe(0);
    expect(s.letters[0]).toBe('');
  });

  it('finishes when every letter is right', () => {
    let s = play(newState(tiny), ...type('CAT'), ...type('WEN'));
    expect(s.done).toBe(false);
    // The crossing words still need their middle letters.
    s = play(s, { type: 'select', cell: 3 }, ...type('O'));
    expect(s.done).toBe(false);
    s = play(s, { type: 'select', cell: 5 }, ...type('E'));
    expect(s.done).toBe(true);
    expect(isFull(tiny, s)).toBe(true);
    expect(play(s, ...type('Z'))).toBe(s);
  });

  it('a full grid with a wrong letter is not finished', () => {
    const s = play(
      newState(tiny),
      ...type('CAT'),
      ...type('WEN'),
      { type: 'select', cell: 3 },
      ...type('X'),
      { type: 'select', cell: 5 },
      ...type('E'),
    );
    expect(isFull(tiny, s)).toBe(true);
    expect(s.done).toBe(false);
  });
});

describe('help', () => {
  it('check flags wrong letters only, and retyping clears the flag', () => {
    let s = play(newState(tiny), ...type('CUT'), { type: 'check' });
    expect(s.marks.slice(0, 3)).toEqual([MARK_NONE, MARK_WRONG, MARK_NONE]);
    expect(s.helped).toBe(true);
    s = play(s, { type: 'select', cell: 1 }, ...type('A'));
    expect(s.marks[1]).toBe(MARK_NONE);
  });

  it('reveals a letter and protects it from being overwritten or erased', () => {
    let s = play(newState(tiny), { type: 'reveal', what: 'letter' });
    expect(s.letters[0]).toBe('C');
    expect(s.marks[0]).toBe(MARK_REVEALED);
    s = play(s, ...type('Z'));
    expect(s.letters[0]).toBe('C');
    expect(s.cell).toBe(1);
    s = play(s, { type: 'backspace' });
    expect(s.letters[0]).toBe('C');
  });

  it('reveals a whole word without marking letters that were already right', () => {
    const s = play(newState(tiny), ...type('C'), { type: 'select', cell: 0 }, { type: 'reveal', what: 'word' });
    expect(s.letters.slice(0, 3)).toEqual(['C', 'A', 'T']);
    expect(s.marks.slice(0, 3)).toEqual([MARK_NONE, MARK_REVEALED, MARK_REVEALED]);
  });

  it('clear empties the grid', () => {
    const s = play(newState(tiny), ...type('CAT'), { type: 'clear' });
    expect(s.letters.every((l) => l === '')).toBe(true);
  });
});

describe('names', () => {
  it('turns ids into titles in the puzzle language', () => {
    expect(puzzleName('m03')).toBe('Medium 3');
    expect(puzzleName('l20')).toBe('Large 20');
    expect(puzzleName('pt-m03')).toBe('Médio 3');
    expect(puzzleName('es-s07')).toBe('Pequeño 7');
    expect(parseId('es-l12')).toEqual({ lang: 'es', level: 'l', number: 12 });
  });
});

describe('typed letters', () => {
  it('drops accents and keeps Ñ only in Spanish', () => {
    expect(toGridLetter('é', 'pt')).toBe('E');
    expect(toGridLetter('ç', 'pt')).toBe('C');
    expect(toGridLetter('ã', 'pt')).toBe('A');
    expect(toGridLetter('ñ', 'es')).toBe('Ñ');
    expect(toGridLetter('ñ', 'en')).toBe('N');
    expect(toGridLetter('q', 'en')).toBe('Q');
    expect(toGridLetter('3', 'en')).toBe('');
    expect(toGridLetter('Enter', 'en')).toBe('');
  });

  it('accepts Ñ in the grid', () => {
    const s = play(newState(tiny), { type: 'letter', letter: 'Ñ' });
    expect(s.letters[0]).toBe('Ñ');
  });
});

for (const [lang, DATA] of Object.entries(SETS)) {
  describe(`the shipped ${lang} puzzles`, () => {
    it('has twenty of each size with unique ids in this language', () => {
      expect(new Set(DATA.map((p) => p.id)).size).toBe(DATA.length);
      for (const size of [5, 7, 9]) expect(DATA.filter((p) => p.size === size)).toHaveLength(20);
      expect(DATA.every((p) => parseId(p.id).lang === lang)).toBe(true);
    });

    for (const data of DATA) {
      it(`${data.id} is well formed`, () => {
        const p = buildPuzzle(data);
        const alphabet = lang === 'es' ? /^[A-ZÑ#]+$/ : /^[A-Z#]+$/;
        expect(data.rows).toHaveLength(data.size);
        expect(data.rows.every((r) => r.length === data.size && alphabet.test(r))).toBe(true);

        for (const e of p.entries) {
          // Each answer matches the grid, has a clue that doesn't contain it, and is a
          // whole word (bounded by blocks or edges).
          expect(e.cells.map((c) => p.solution[c]).join('')).toBe(e.answer);
          expect(e.answer.length).toBeGreaterThanOrEqual(3);
          expect(e.clue.length).toBeGreaterThan(0);
          expect(plain(e.clue).split(/[^A-ZÑ0-9]+/)).not.toContain(e.answer);
          const step = e.dir === 'across' ? 1 : data.size;
          const before = e.dir === 'across' ? e.col > 0 : e.row > 0;
          const last = e.cells[e.cells.length - 1];
          const after = e.dir === 'across' ? (last % data.size) + 1 < data.size : last + step < data.size ** 2;
          if (before) expect(p.solution[e.cells[0] - step]).toBe('');
          if (after) expect(p.solution[last + step]).toBe('');
        }

        // Every letter belongs to a clue, and no answer is used twice.
        p.solution.forEach((letter, i) => {
          if (letter) expect(p.cellEntry[i].across >= 0 || p.cellEntry[i].down >= 0).toBe(true);
        });
        expect(new Set(p.entries.map((e) => e.answer)).size).toBe(p.entries.length);

        // Clue numbers rise left to right, top to bottom.
        const starts = p.numbers.filter((n) => n > 0);
        expect(starts).toEqual(starts.map((_, k) => k + 1));

        // Typing every answer solves it.
        let s = newState(p);
        for (const e of p.entries) {
          s = reducer(p, s, { type: 'goto', entry: e.index });
          e.cells.forEach((cell, k) => {
            s = reducer(p, { ...s, cell, dir: e.dir }, { type: 'letter', letter: e.answer[k] });
          });
        }
        expect(s.done).toBe(true);
      });
    }
  });
}
