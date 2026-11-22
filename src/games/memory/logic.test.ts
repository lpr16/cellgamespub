import { describe, expect, it } from 'vitest';
import { BOARDS, LEVELS, PICTURES, newGame, pairsFound, reducer, type MemoryState } from './logic';

const flip = (s: MemoryState, position: number) => reducer(s, { type: 'flip', position });
/** The other position holding the same picture. */
const partner = (s: MemoryState, i: number) => s.deck.findIndex((p, j) => j !== i && p === s.deck[i]);
/** A position holding a different picture. */
const stranger = (s: MemoryState, i: number) => s.deck.findIndex((p) => p !== s.deck[i]);

describe('dealing', () => {
  it('has enough distinct pictures for the biggest board', () => {
    const biggest = Math.max(...LEVELS.map((l) => (BOARDS[l].cols * BOARDS[l].rows) / 2));
    expect(PICTURES.length).toBeGreaterThanOrEqual(biggest);
    expect(new Set(PICTURES.map((p) => p.symbol)).size).toBe(PICTURES.length);
  });

  for (const level of LEVELS) {
    it(`deals every picture exactly twice on the ${level} board`, () => {
      const s = newGame(level, 7);
      const { cols, rows } = BOARDS[level];
      expect(s.deck).toHaveLength(cols * rows);
      const counts = new Map<number, number>();
      for (const p of s.deck) counts.set(p, (counts.get(p) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    });
  }

  it('is reproducible from a seed and differs between seeds', () => {
    expect(newGame('medium', 3)).toEqual(newGame('medium', 3));
    expect(newGame('medium', 3).deck).not.toEqual(newGame('medium', 4).deck);
  });
});

describe('turning cards', () => {
  it('keeps a matching pair face up and counts one turn', () => {
    let s = newGame('easy', 1);
    s = flip(s, 0);
    expect(s.open).toEqual([0]);
    expect(s.turns).toBe(0);
    s = flip(s, partner(s, 0));
    expect(s.open).toEqual([]);
    expect(pairsFound(s)).toBe(1);
    expect(s.turns).toBe(1);
  });

  it('shows a pair that does not match until it is settled', () => {
    let s = newGame('easy', 1);
    const other = stranger(s, 0);
    s = flip(flip(s, 0), other);
    expect(s.open).toEqual([0, other]);
    expect(pairsFound(s)).toBe(0);
    expect(s.turns).toBe(1);
    s = reducer(s, { type: 'settle' });
    expect(s.open).toEqual([]);
  });

  it('turns a mismatched pair back when the next card is touched', () => {
    let s = newGame('easy', 1);
    const other = stranger(s, 0);
    s = flip(flip(s, 0), other);
    const third = s.deck.findIndex((_, j) => j !== 0 && j !== other);
    s = flip(s, third);
    expect(s.open).toEqual([third]);
  });

  it('ignores a second touch on the same card and touches on matched cards', () => {
    let s = flip(newGame('easy', 1), 0);
    expect(flip(s, 0)).toBe(s);
    s = flip(s, partner(s, 0));
    expect(flip(s, 0)).toBe(s);
  });

  it('finishes when every pair is found and then stops the clock', () => {
    let s = newGame('easy', 5);
    for (let i = 0; i < s.deck.length; i++) {
      if (s.matched[i]) continue;
      s = flip(flip(s, i), partner(s, i));
    }
    expect(s.done).toBe(true);
    expect(s.turns).toBe(6);
    expect(reducer(s, { type: 'tick', seconds: 3 })).toBe(s);
  });
});
