import { describe, expect, it } from 'vitest';
import {
  bestTarget,
  canMove,
  deal,
  dealBlocked,
  faceOf,
  findHint,
  movable,
  reducer,
  type Column,
  type SpiderState,
  type SuitCount,
} from './logic';

// With four suits the packs of thirteen go spades, hearts, diamonds, clubs, twice over.
const SPADES = 0;
const HEARTS = 1;
/** A card of this suit and rank from the first (or second) pack, in the four-suit game. */
const card = (suit: number, rank: number, pack = 0) => (pack * 4 + suit) * 13 + rank - 1;

function table(columns: Column[], extra: Partial<SpiderState> = {}): SpiderState {
  return {
    tableau: Array.from({ length: 10 }, (_, i) => columns[i] ?? { cards: [], down: 0 }),
    stock: [],
    foundations: [],
    suits: 4,
    seed: 0,
    moves: 0,
    elapsed: 0,
    history: [],
    done: false,
    ...extra,
  };
}

const up = (...cards: number[]): Column => ({ cards, down: 0 });
const allCards = (s: SpiderState) =>
  [...s.stock, ...s.foundations.flat(), ...s.tableau.flatMap((c) => c.cards)].sort((a, b) => a - b);

describe('cards', () => {
  it('shows only spades in the one-suit game and two suits in the two-suit game', () => {
    const suitsSeen = (suits: SuitCount) =>
      new Set(Array.from({ length: 104 }, (_, id) => Math.floor(faceOf(id, suits) / 13)));
    expect([...suitsSeen(1)]).toEqual([0]);
    expect([...suitsSeen(2)].sort()).toEqual([0, 1]);
    expect(suitsSeen(4).size).toBe(4);
    // Every rank appears eight times whatever the suit count.
    for (const suits of [1, 2, 4] as SuitCount[]) {
      const aces = Array.from({ length: 104 }, (_, id) => faceOf(id, suits) % 13).filter((r) => r === 0);
      expect(aces).toHaveLength(8);
    }
  });
});

describe('deal', () => {
  it('lays out 54 cards in ten columns with only the tops face up, and keeps 50 in the stock', () => {
    const s = deal(1, 2);
    expect(s.tableau.map((c) => c.cards.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(s.tableau.every((c) => c.down === c.cards.length - 1)).toBe(true);
    expect(s.stock).toHaveLength(50);
    expect(allCards(s)).toEqual(Array.from({ length: 104 }, (_, i) => i));
    expect(deal(1, 2)).toEqual(deal(1, 2));
  });
});

describe('moving', () => {
  it('builds down on any suit', () => {
    const s = table([up(card(SPADES, 8)), up(card(HEARTS, 7)), up(card(SPADES, 7)), up(card(HEARTS, 6))]);
    expect(canMove(s, { from: 't1', to: 't0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't2', to: 't0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't3', to: 't0', count: 1 })).toBe(false);
    expect(canMove(s, { from: 't3', to: 't9', count: 1 })).toBe(true); // empty column takes anything
  });

  it('only moves a run together when it is all one suit', () => {
    const s = table([
      up(card(SPADES, 9), card(SPADES, 8), card(SPADES, 7)),
      up(card(SPADES, 9, 1), card(HEARTS, 8), card(SPADES, 7, 1)),
    ]);
    expect(movable(s, 't0', 3)).toHaveLength(3);
    expect(movable(s, 't1', 2)).toBeNull();
    expect(movable(s, 't1', 1)).toHaveLength(1);
  });

  it('turns over the card a move uncovers and never picks up face-down cards', () => {
    let s = table([up(card(SPADES, 9)), { cards: [card(HEARTS, 3), card(HEARTS, 8)], down: 1 }]);
    expect(movable(s, 't1', 2)).toBeNull();
    s = reducer(s, { type: 'move', move: { from: 't1', to: 't0', count: 1 } });
    expect(s.tableau[1]).toEqual({ cards: [card(HEARTS, 3)], down: 0 });
    expect(s.moves).toBe(1);
  });

  it('prefers the same suit when a card is tapped', () => {
    const s = table([up(card(HEARTS, 8)), up(card(SPADES, 8)), up(card(SPADES, 7))]);
    expect(bestTarget(s, 't2', 1)).toBe('t1');
  });
});

describe('finished runs', () => {
  const kingToTwo = Array.from({ length: 12 }, (_, i) => card(SPADES, 13 - i));

  it('are lifted off the table, and the card beneath is turned over', () => {
    let s = table([{ cards: [card(HEARTS, 5), ...kingToTwo], down: 1 }, up(card(SPADES, 1))]);
    s = reducer(s, { type: 'move', move: { from: 't1', to: 't0', count: 1 } });
    expect(s.foundations).toHaveLength(1);
    expect(s.foundations[0]).toHaveLength(13);
    expect(s.tableau[0]).toEqual({ cards: [card(HEARTS, 5)], down: 0 });
    expect(s.done).toBe(false);
  });

  it('do not count when the suits are mixed', () => {
    const mixed = [...kingToTwo.slice(0, 11), card(HEARTS, 2)];
    let s = table([up(...mixed), up(card(SPADES, 1))]);
    s = reducer(s, { type: 'move', move: { from: 't1', to: 't0', count: 1 } });
    expect(s.foundations).toHaveLength(0);
  });

  it('win the game at eight', () => {
    const seven = Array.from({ length: 7 }, (_, k) => Array.from({ length: 13 }, (_, i) => 200 + k * 13 + i));
    let s = table([up(...kingToTwo), up(card(SPADES, 1))], { foundations: seven });
    s = reducer(s, { type: 'move', move: { from: 't1', to: 't0', count: 1 } });
    expect(s.done).toBe(true);
  });
});

describe('stock', () => {
  it('deals one card face up onto every column', () => {
    let s = deal(5, 1);
    const tops = s.stock.slice(-10).reverse();
    s = reducer(s, { type: 'draw' });
    expect(s.stock).toHaveLength(40);
    expect(s.tableau.map((c) => c.cards[c.cards.length - 1])).toEqual(tops);
    expect(s.tableau.map((c) => c.cards.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6, 6, 6]);
  });

  it('refuses to deal while a column is empty', () => {
    const s = { ...deal(5, 1) };
    s.tableau = s.tableau.map((c, i) => (i === 9 ? { cards: [], down: 0 } : c));
    expect(dealBlocked(s)).toMatch(/Fill every column/);
    expect(reducer(s, { type: 'draw' })).toBe(s);
  });

  it('undo takes a deal back', () => {
    const start = deal(5, 1);
    let s = reducer(start, { type: 'draw' });
    s = reducer(s, { type: 'undo' });
    expect(s.stock).toEqual(start.stock);
    expect(s.tableau).toEqual(start.tableau);
  });
});

describe('hints', () => {
  it('suggests joining two runs of one suit', () => {
    const s = table([up(card(HEARTS, 9)), up(card(SPADES, 9)), up(card(SPADES, 8))]);
    expect(findHint(s)).toEqual({ from: 't2', to: 't1', count: 1 });
  });

  it('suggests dealing when nothing useful moves, and nothing when the stock is gone', () => {
    const stuck = Array.from({ length: 10 }, () => up(card(SPADES, 5)));
    expect(findHint(table(stuck, { stock: Array.from({ length: 10 }, (_, i) => 150 + i) }))).toBe('draw');
    expect(findHint(table(stuck))).toBeNull();
  });

  it('keeps all 104 cards through a long game played from hints', () => {
    let s = deal(31, 1);
    for (let i = 0; i < 600 && !s.done; i++) {
      const hint = findHint(s);
      if (!hint) break;
      const next = reducer(s, hint === 'draw' ? { type: 'draw' } : { type: 'move', move: hint });
      expect(next).not.toBe(s);
      s = next;
      expect(allCards(s)).toEqual(Array.from({ length: 104 }, (_, k) => k));
      for (const c of s.tableau) expect(c.down).toBeLessThan(Math.max(1, c.cards.length));
    }
  });
});
