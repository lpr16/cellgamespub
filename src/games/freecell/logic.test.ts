import { describe, expect, it } from 'vitest';
import {
  bestTarget,
  canMove,
  deal,
  findHint,
  maxRun,
  movable,
  reducer,
  safeAutoMove,
  type FreeCellState,
  type Table,
} from './logic';

const SPADES = 0;
const HEARTS = 1;
const DIAMONDS = 2;
const CLUBS = 3;
const card = (suit: number, rank: number) => suit * 13 + rank - 1;

/** A hand-built table; anything not given is empty. */
function table(parts: Partial<Table>): FreeCellState {
  return {
    cells: parts.cells ?? [null, null, null, null],
    foundations: parts.foundations ?? [[], [], [], []],
    tableau: Array.from({ length: 8 }, (_, i) => parts.tableau?.[i] ?? []),
    seed: 0,
    moves: 0,
    elapsed: 0,
    history: [],
    done: false,
  };
}

const allCards = (s: Table) =>
  [...s.cells.filter((c): c is number => c !== null), ...s.foundations.flat(), ...s.tableau.flat()].sort((a, b) => a - b);

describe('deal', () => {
  it('puts all 52 cards face up in eight columns of seven and six', () => {
    const s = deal(1);
    expect(s.tableau.map((p) => p.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(allCards(s)).toEqual(Array.from({ length: 52 }, (_, i) => i));
    expect(deal(1)).toEqual(deal(1));
    expect(deal(1).tableau).not.toEqual(deal(2).tableau);
  });
});

describe('moving single cards', () => {
  it('builds columns downwards in alternating colours', () => {
    const s = table({ tableau: [[card(SPADES, 8)], [card(HEARTS, 7)], [card(CLUBS, 7)], [card(HEARTS, 6)]] });
    expect(canMove(s, { from: 't1', to: 't0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't2', to: 't0', count: 1 })).toBe(false); // same colour
    expect(canMove(s, { from: 't3', to: 't0', count: 1 })).toBe(false); // wrong rank
  });

  it('lets any card into an empty column or an empty free cell, one per cell', () => {
    const s = table({ cells: [card(CLUBS, 9), null, null, null], tableau: [[card(HEARTS, 4)], [card(SPADES, 2)]] });
    expect(canMove(s, { from: 't0', to: 't5', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't0', to: 'c1', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't0', to: 'c0', count: 1 })).toBe(false);
    expect(canMove(s, { from: 'c0', to: 't5', count: 1 })).toBe(true);
  });

  it('builds foundations up by suit from the ace', () => {
    const s = table({
      foundations: [[card(HEARTS, 1)], [], [], []],
      tableau: [[card(HEARTS, 2)], [card(SPADES, 1)], [card(SPADES, 2)]],
    });
    expect(canMove(s, { from: 't0', to: 'f0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't1', to: 'f1', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't2', to: 'f0', count: 1 })).toBe(false);
    expect(canMove(s, { from: 't2', to: 'f1', count: 1 })).toBe(false);
  });
});

describe('moving runs', () => {
  const run = [card(SPADES, 6), card(HEARTS, 5), card(CLUBS, 4)];
  const filler = (n: number) => Array.from({ length: n }, (_, i) => [card(DIAMONDS, 13 - i)]);

  it('only picks up cards that are in order', () => {
    const s = table({ tableau: [[card(HEARTS, 9), ...run]] });
    expect(movable(s, 't0', 3)).toEqual(run);
    expect(movable(s, 't0', 4)).toBeNull();
  });

  it('limits a run by free cells and empty columns', () => {
    // No empty columns: 4 free cells carry a run of 5; 1 free cell a run of 2.
    const full = table({ tableau: [[card(DIAMONDS, 7)], [...run], ...filler(6)] });
    expect(maxRun(full, 't0')).toBe(5);
    expect(canMove(full, { from: 't1', to: 't0', count: 3 })).toBe(true);
    const tight = { ...full, cells: [card(CLUBS, 1), card(CLUBS, 2), card(CLUBS, 3), null] };
    expect(maxRun(tight, 't0')).toBe(2);
    expect(canMove(tight, { from: 't1', to: 't0', count: 3 })).toBe(false);
    expect(canMove(tight, { from: 't1', to: 't0', count: 1 })).toBe(false); // the 4 doesn't fit the 7
  });

  it('doubles the limit for each empty column, not counting the one moved into', () => {
    const s = table({ cells: [1, 2, 3, null], tableau: [[card(DIAMONDS, 7)], [...run]] });
    // Six empty columns: (1 + 1) * 2^6 onto a card, half that into an empty column.
    expect(maxRun(s, 't0')).toBe(128);
    expect(maxRun(s, 't5')).toBe(64);
  });
});

describe('automatic moves', () => {
  it('sends up aces and twos at once', () => {
    const s = table({ tableau: [[card(HEARTS, 5), card(CLUBS, 1)]] });
    expect(safeAutoMove(s)).toEqual({ from: 't0', to: 'f0', count: 1 });
  });

  it('holds back a card that a lower card of the other colour may still need', () => {
    const base = {
      tableau: [[card(HEARTS, 4)]],
      foundations: [
        [card(HEARTS, 1), card(HEARTS, 2), card(HEARTS, 3)],
        [card(SPADES, 1), card(SPADES, 2)],
        [card(CLUBS, 1), card(CLUBS, 2)],
        [],
      ],
    };
    // Black threes are not up yet, so the red four might be needed to hold one.
    expect(safeAutoMove(table(base))).toBeNull();
    const ready = table({
      ...base,
      foundations: [
        base.foundations[0],
        [...base.foundations[1], card(SPADES, 3)],
        [...base.foundations[2], card(CLUBS, 3)],
        [],
      ],
    });
    expect(safeAutoMove(ready)).toEqual({ from: 't0', to: 'f0', count: 1 });
  });

  it('is undone together with the move that triggered it', () => {
    let s = table({ tableau: [[card(SPADES, 1), card(HEARTS, 9)], [card(SPADES, 10)]] });
    s = reducer(s, { type: 'move', move: { from: 't0', to: 't1', count: 1 } });
    s = reducer(s, { type: 'auto' });
    expect(s.foundations[0]).toEqual([card(SPADES, 1)]);
    expect(reducer(s, { type: 'auto' })).toBe(s);
    s = reducer(s, { type: 'undo' });
    expect(s.tableau[0]).toEqual([card(SPADES, 1), card(HEARTS, 9)]);
    expect(s.foundations[0]).toEqual([]);
  });
});

describe('tap to move', () => {
  it('prefers a foundation, then a column, then an empty column, then a free cell', () => {
    const s = table({
      tableau: [[card(CLUBS, 1)], [card(HEARTS, 7)], [card(SPADES, 8)], ...Array.from({ length: 5 }, () => [card(DIAMONDS, 13)])],
    });
    expect(bestTarget(s, 't0', 1)).toBe('f0');
    expect(bestTarget(s, 't1', 1)).toBe('t2');
    const noHome = table({ tableau: Array.from({ length: 8 }, (_, i) => [card(DIAMONDS, 13), card(i % 2 ? HEARTS : SPADES, 5)]) });
    expect(bestTarget(noHome, 't0', 1)).toBe('c0');
    const withGap = table({ tableau: [[card(HEARTS, 3), card(SPADES, 9)]] });
    expect(bestTarget(withGap, 't0', 1)).toBe('t1');
  });
});

describe('finishing', () => {
  it('wins when the last card goes up', () => {
    const suitRun = (suit: number, upTo: number) => Array.from({ length: upTo }, (_, i) => card(suit, i + 1));
    let s = table({
      foundations: [suitRun(SPADES, 13), suitRun(HEARTS, 13), suitRun(DIAMONDS, 13), suitRun(CLUBS, 12)],
      tableau: [[card(CLUBS, 13)]],
    });
    s = reducer(s, { type: 'auto' });
    expect(s.done).toBe(true);
  });

  it('keeps all 52 cards through a long game played from hints', () => {
    let s = deal(2024);
    for (let i = 0; i < 400 && !s.done; i++) {
      while (safeAutoMove(s) && !s.done) s = reducer(s, { type: 'auto' });
      const hint = findHint(s);
      if (!hint) break;
      const next = reducer(s, { type: 'move', move: hint });
      expect(next).not.toBe(s); // every hint is a legal move
      s = next;
      expect(allCards(s)).toEqual(Array.from({ length: 52 }, (_, k) => k));
    }
  });
});
