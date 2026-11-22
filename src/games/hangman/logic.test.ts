import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../shell/random';
import { LANGS } from '../words/lang';
import { wordsFor, type WordEntry } from '../words/list';
import {
  MAX_MISSES,
  RECENT_LIMIT,
  emptyStats,
  isHit,
  newRound,
  pickWord,
  recordRound,
  reducer,
  revealed,
  type HangmanState,
} from './logic';

const entry = (display: string, answer: string): WordEntry => ({ display, answer, clue: 'A clue' });
const guess = (s: HangmanState, letters: string) =>
  [...letters].reduce((state, letter) => reducer(state, { type: 'guess', letter }), s);

describe('guessing', () => {
  it('uncovers every copy of a right letter', () => {
    const s = guess(newRound('en', entry('BANANA', 'BANANA')), 'A');
    expect(revealed(s)).toEqual(['', 'A', '', 'A', '', 'A']);
    expect(s.misses).toBe(0);
    expect(isHit(s, 'A')).toBe(true);
  });

  it('counts a wrong letter once, however often it is tried', () => {
    const s = guess(newRound('en', entry('BANANA', 'BANANA')), 'ZZ');
    expect(s.misses).toBe(1);
    expect(s.guessed).toEqual(['Z']);
    expect(isHit(s, 'Z')).toBe(false);
  });

  it('wins when every letter is found', () => {
    const s = guess(newRound('en', entry('BANANA', 'BANANA')), 'BXAN');
    expect(s.status).toBe('won');
    expect(s.misses).toBe(1);
    expect(reducer(s, { type: 'guess', letter: 'Q' })).toBe(s);
  });

  it('loses on the sixth miss and then shows the word', () => {
    let s = guess(newRound('en', entry('BANANA', 'BANANA')), 'CDEFG');
    expect(s.status).toBe('playing');
    expect(s.misses).toBe(MAX_MISSES - 1);
    s = guess(s, 'H');
    expect(s.status).toBe('lost');
    expect(revealed(s).join('')).toBe('BANANA');
  });

  it('ignores anything that is not a single letter', () => {
    const s = newRound('en', entry('BANANA', 'BANANA'));
    expect(reducer(s, { type: 'guess', letter: '1' })).toBe(s);
    expect(reducer(s, { type: 'guess', letter: 'AB' })).toBe(s);
  });
});

describe('accents', () => {
  it('plain letters uncover their accented forms, shown as written', () => {
    let s = newRound('pt', entry('MAÇÃ', 'MACA'));
    s = guess(s, 'A');
    expect(revealed(s)).toEqual(['', 'A', '', 'Ã']);
    s = guess(s, 'C');
    expect(revealed(s)).toEqual(['', 'A', 'Ç', 'Ã']);
    s = guess(s, 'M');
    expect(s.status).toBe('won');
  });

  it('treats Ñ as its own letter in Spanish', () => {
    let s = newRound('es', entry('MONTAÑA', 'MONTAÑA'));
    s = guess(s, 'N');
    expect(revealed(s)).toEqual(['', '', 'N', '', '', '', '']);
    s = guess(s, 'Ñ');
    expect(revealed(s)[5]).toBe('Ñ');
    expect(s.misses).toBe(0);
  });
});

describe('the clue', () => {
  it('can be shown once and stays shown', () => {
    let s = newRound('en', entry('BANANA', 'BANANA'));
    expect(s.clueShown).toBe(false);
    s = reducer(s, { type: 'showClue' });
    expect(s.clueShown).toBe(true);
    expect(reducer(s, { type: 'showClue' })).toBe(s);
  });
});

describe('choosing words', () => {
  for (const lang of LANGS) {
    it(`${lang}: picks words of five to seven letters`, () => {
      const rng = mulberry32(3);
      for (let i = 0; i < 200; i++) {
        const w = pickWord(wordsFor(lang), [], rng);
        expect(w.answer.length).toBeGreaterThanOrEqual(5);
        expect(w.answer.length).toBeLessThanOrEqual(7);
        expect(w.display).toHaveLength(w.answer.length);
        expect(w.clue.length).toBeGreaterThan(0);
      }
    });
  }

  it('avoids recently used words while others remain', () => {
    const pool = [entry('APPLE', 'APPLE'), entry('BREAD', 'BREAD'), entry('CHAIR', 'CHAIR')];
    const rng = mulberry32(1);
    for (let i = 0; i < 50; i++) expect(pickWord(pool, ['APPLE', 'BREAD'], rng).answer).toBe('CHAIR');
    expect(pool.map((w) => w.answer)).toContain(pickWord(pool, ['APPLE', 'BREAD', 'CHAIR'], rng).answer);
  });
});

describe('statistics', () => {
  it('tracks wins, streaks and the best streak', () => {
    const round = newRound('en', entry('BANANA', 'BANANA'));
    let stats = emptyStats();
    stats = recordRound(stats, round, true);
    stats = recordRound(stats, round, true);
    expect(stats).toMatchObject({ played: 2, won: 2, streak: 2, best: 2 });
    stats = recordRound(stats, round, false);
    expect(stats).toMatchObject({ played: 3, won: 2, streak: 0, best: 2 });
    expect(stats.recent).toEqual(['BANANA']);
  });

  it('remembers only the latest words', () => {
    let stats = emptyStats();
    for (let i = 0; i < RECENT_LIMIT + 10; i++) {
      stats = recordRound(stats, newRound('en', entry(`WORD${i}`, `WORD${i}`)), true);
    }
    expect(stats.recent).toHaveLength(RECENT_LIMIT);
    expect(stats.recent[0]).toBe('WORD10');
  });
});
