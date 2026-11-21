import { describe, expect, it } from 'vitest';
import {
  CLUBS,
  DIAMONDS,
  HEARTS,
  SPADES,
  bestTarget,
  canAutoFinish,
  canMove,
  deal,
  findHint,
  isRed,
  rankOf,
  reducer,
  suitOf,
  type SolitaireState,
  type Table,
} from './logic';

const card = (suit: number, rank: number) => suit * 13 + rank - 1;

/** A hand-built table; anything not given is empty. */
function table(parts: Partial<Table> & { tableau?: { cards: number[]; down: number }[] }): SolitaireState {
  const tableau = Array.from({ length: 7 }, (_, i) => parts.tableau?.[i] ?? { cards: [], down: 0 });
  return {
    stock: parts.stock ?? [],
    waste: parts.waste ?? [],
    foundations: parts.foundations ?? [[], [], [], []],
    tableau,
    draw: 1,
    seed: 0,
    moves: 0,
    elapsed: 0,
    history: [],
    done: false,
  };
}

const allCards = (s: Table) =>
  [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flatMap((p) => p.cards)].sort((a, b) => a - b);

describe('cards', () => {
  it('reads suit, rank and colour from a card number', () => {
    expect(rankOf(card(HEARTS, 12))).toBe(12);
    expect(suitOf(card(CLUBS, 1))).toBe(CLUBS);
    expect(isRed(card(DIAMONDS, 5))).toBe(true);
    expect(isRed(card(SPADES, 5))).toBe(false);
  });
});

describe('deal', () => {
  it('lays out 28 cards in seven piles and keeps 24 in the stock', () => {
    const s = deal(1, 1);
    expect(s.tableau.map((p) => p.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.tableau.map((p) => p.down)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.stock).toHaveLength(24);
    expect(allCards(s)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('is reproducible from a seed and differs between seeds', () => {
    expect(deal(5, 1)).toEqual(deal(5, 1));
    expect(deal(5, 1).stock).not.toEqual(deal(6, 1).stock);
  });
});

describe('tableau moves', () => {
  it('accepts a card one lower and of the other colour', () => {
    const s = table({
      tableau: [
        { cards: [card(SPADES, 8)], down: 0 },
        { cards: [card(HEARTS, 7)], down: 0 },
        { cards: [card(CLUBS, 7)], down: 0 },
        { cards: [card(HEARTS, 6)], down: 0 },
      ],
    });
    expect(canMove(s, { from: 't1', to: 't0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't2', to: 't0', count: 1 })).toBe(false); // same colour
    expect(canMove(s, { from: 't3', to: 't0', count: 1 })).toBe(false); // wrong rank
  });

  it('only lets a king onto an empty pile', () => {
    const s = table({
      tableau: [
        { cards: [], down: 0 },
        { cards: [card(HEARTS, 13)], down: 0 },
        { cards: [card(HEARTS, 12)], down: 0 },
      ],
    });
    expect(canMove(s, { from: 't1', to: 't0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't2', to: 't0', count: 1 })).toBe(false);
  });

  it('moves a run together and turns over the card underneath', () => {
    const s = table({
      tableau: [
        { cards: [card(SPADES, 9)], down: 0 },
        { cards: [card(CLUBS, 2), card(HEARTS, 8), card(CLUBS, 7)], down: 1 },
      ],
    });
    const next = reducer(s, { type: 'move', move: { from: 't1', to: 't0', count: 2 } });
    expect(next.tableau[0].cards).toEqual([card(SPADES, 9), card(HEARTS, 8), card(CLUBS, 7)]);
    expect(next.tableau[1]).toEqual({ cards: [card(CLUBS, 2)], down: 0 });
    expect(next.moves).toBe(1);
  });

  it('refuses to pick up face-down cards', () => {
    const s = table({
      tableau: [
        { cards: [card(SPADES, 9)], down: 0 },
        { cards: [card(HEARTS, 8), card(CLUBS, 7)], down: 1 },
      ],
    });
    expect(canMove(s, { from: 't1', to: 't0', count: 2 })).toBe(false);
  });
});

describe('foundations', () => {
  it('start with an ace and build up in one suit', () => {
    const s = table({
      waste: [card(HEARTS, 2)],
      foundations: [[card(HEARTS, 1)], [], [], []],
      tableau: [{ cards: [card(SPADES, 1)], down: 0 }, { cards: [card(SPADES, 2)], down: 0 }],
    });
    expect(canMove(s, { from: 'waste', to: 'f0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 'waste', to: 'f1', count: 1 })).toBe(false);
    expect(canMove(s, { from: 't0', to: 'f1', count: 1 })).toBe(true);
    expect(canMove(s, { from: 't1', to: 'f0', count: 1 })).toBe(false); // wrong suit
  });

  it('give a card back to the tableau but not to another foundation', () => {
    const s = table({
      foundations: [[card(HEARTS, 1), card(HEARTS, 2)], [], [], []],
      tableau: [{ cards: [card(SPADES, 3)], down: 0 }],
    });
    expect(canMove(s, { from: 'f0', to: 't0', count: 1 })).toBe(true);
    expect(canMove(s, { from: 'f0', to: 'f1', count: 1 })).toBe(false);
  });
});

describe('stock', () => {
  it('draws one card at a time', () => {
    let s = deal(3, 1);
    const top = s.stock[s.stock.length - 1];
    s = reducer(s, { type: 'draw' });
    expect(s.waste).toEqual([top]);
    expect(s.stock).toHaveLength(23);
  });

  it('draws three and shows the last one drawn on top', () => {
    let s = deal(3, 3);
    const [third, second, first] = s.stock.slice(-3);
    s = reducer(s, { type: 'draw' });
    expect(s.waste).toEqual([first, second, third]);
  });

  it('turns the waste back into the stock in the original order', () => {
    let s = deal(3, 1);
    const original = s.stock.slice();
    for (let i = 0; i < 24; i++) s = reducer(s, { type: 'draw' });
    expect(s.stock).toHaveLength(0);
    s = reducer(s, { type: 'draw' });
    expect(s.stock).toEqual(original);
    expect(s.waste).toHaveLength(0);
  });

  it('does nothing when both stock and waste are empty', () => {
    const s = table({});
    expect(reducer(s, { type: 'draw' })).toBe(s);
  });
});

describe('undo', () => {
  it('restores the table exactly', () => {
    const start = deal(11, 1);
    let s = reducer(start, { type: 'draw' });
    s = reducer(s, { type: 'undo' });
    expect(s.stock).toEqual(start.stock);
    expect(s.waste).toEqual(start.waste);
    expect(s.history).toHaveLength(0);
  });
});

describe('tap to move', () => {
  it('prefers a foundation, then an occupied pile', () => {
    const s = table({
      waste: [card(HEARTS, 1)],
      tableau: [{ cards: [], down: 0 }, { cards: [card(SPADES, 9)], down: 0 }, { cards: [card(HEARTS, 8)], down: 0 }],
    });
    expect(bestTarget(s, 'waste', 1)).toBe('f0');
    expect(bestTarget(s, 't2', 1)).toBe('t1');
  });

  it('does not shuffle a lone king between empty piles', () => {
    const s = table({ tableau: [{ cards: [card(SPADES, 13)], down: 0 }] });
    expect(bestTarget(s, 't0', 1)).toBeNull();
  });
});

describe('hints', () => {
  it('suggests uncovering a face-down card', () => {
    const s = table({
      tableau: [
        { cards: [card(SPADES, 9)], down: 0 },
        { cards: [card(CLUBS, 2), card(HEARTS, 8)], down: 1 },
      ],
    });
    expect(findHint(s)).toEqual({ from: 't1', to: 't0', count: 1 });
  });

  it('suggests drawing when nothing on the table moves, and gives up when the stock is spent', () => {
    const stuck = { tableau: [{ cards: [card(SPADES, 9)], down: 0 }] };
    expect(findHint(table({ ...stuck, stock: [card(CLUBS, 4)] }))).toBe('draw');
    expect(findHint(table(stuck))).toBeNull();
  });
});

describe('finishing', () => {
  it('plays out a fully uncovered game to a win', () => {
    // Four complete suits, king at the bottom of each pile, every card face up.
    const run = (suit: number) => Array.from({ length: 13 }, (_, i) => card(suit, 13 - i));
    let s = table({
      tableau: [SPADES, HEARTS, DIAMONDS, CLUBS].map((suit) => ({ cards: run(suit), down: 0 })),
    });
    expect(canAutoFinish(s)).toBe(true);
    for (let i = 0; i < 52; i++) s = reducer(s, { type: 'auto' });
    expect(s.done).toBe(true);
    expect(s.foundations.map((f) => f.length)).toEqual([13, 13, 13, 13]);
    expect(reducer(s, { type: 'draw' })).toBe(s);
  });

  it('is not offered while cards are still face down', () => {
    expect(canAutoFinish(deal(1, 1))).toBe(false);
  });

  it('keeps all 52 cards through a long random game', () => {
    let s = deal(77, 3);
    for (let i = 0; i < 300 && !s.done; i++) {
      const hint = findHint(s, s.draw);
      if (hint === null) break;
      s = reducer(s, hint === 'draw' ? { type: 'draw' } : { type: 'move', move: hint });
      expect(allCards(s)).toHaveLength(52);
      expect(new Set(allCards(s)).size).toBe(52);
      // The top card of every pile is always face up.
      for (const p of s.tableau) expect(p.down).toBeLessThan(Math.max(1, p.cards.length));
    }
  });
});
