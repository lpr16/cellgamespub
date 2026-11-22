// Spider, described for the shared card table.
import { fanDown, tableMetrics } from '../cards/layout';
import type { CardRules, PlacedCard, Slot } from '../cards/types';
import {
  bestTarget,
  canMove,
  deal,
  dealBlocked,
  faceOf,
  findHint,
  foundationId,
  movable,
  reducer,
  tableauId,
  type SpiderState,
  type SuitCount,
} from './logic';

export const spiderRules: CardRules<SpiderState> = {
  id: 'spider',
  title: 'Spider',
  className: 'spider',
  modes: [
    { key: '1', label: 'One suit', note: 'Easiest' },
    { key: '2', label: 'Two suits', note: 'Harder' },
    { key: '4', label: 'Four suits', note: 'Hardest' },
  ],
  newGameNote: 'Build runs from king down to ace in one suit to clear them. Not every deal can be won.',
  deal: (seed, mode) => deal(seed, (Number(mode) || 1) as SuitCount),
  modeOf: (s) => String(s.suits),
  reduce: reducer,

  // Top row: finished runs on the left, the stock on the right. Ten columns below.
  layout(s, width, height) {
    const { metrics, pitch } = tableMetrics(width, height, 10);
    const { cardW, cardH, tableauY } = metrics;
    const cards: PlacedCard[] = new Array(104);
    const slots: Slot[] = [];
    const face = (id: number) => faceOf(id, s.suits);

    for (let i = 0; i < 8; i++) {
      const pile = foundationId(i);
      slots.push({ pile, x: i * pitch, y: 0, kind: 'cell' });
      (s.foundations[i] ?? []).forEach((id, index) => {
        cards[id] = { id, face: face(id), x: i * pitch, y: 0, z: index, up: true, pile, index };
      });
    }

    // Each deal still to come peeks out a little to the left of the one above it.
    const stockX = 9 * pitch;
    slots.push({ pile: 'stock', x: stockX, y: 0, kind: 'stock' });
    s.stock.forEach((id, index) => {
      const x = stockX - Math.floor(index / 10) * cardW * 0.16;
      cards[id] = { id, face: face(id), x, y: 0, z: index, up: false, pile: 'stock', index };
    });

    const room = height - tableauY - cardH;
    for (let i = 0; i < 10; i++) {
      const pile = tableauId(i);
      slots.push({ pile, x: i * pitch, y: tableauY, kind: 'tableau' });
      fanDown(cards, pile, s.tableau[i].cards, face, s.tableau[i].down, i * pitch, tableauY, room, cardH);
    }
    return { metrics, cards, slots };
  },

  tableDeps: (s) => [s.tableau, s.stock, s.foundations, s.suits, s.seed],
  pickUp(s, pile, index) {
    if (pile[0] !== 't') return null;
    const count = s.tableau[Number(pile.slice(1))].cards.length - index;
    const ids = movable(s, pile, count);
    return ids ? { from: pile, count, ids } : null;
  },
  canMove,
  bestTarget,
  hint: findHint,
  hasAuto: () => false,
  canDraw: (s) => s.stock.length > 0,
  drawBlocked: dealBlocked,
  status: (s) => [`Runs ${s.foundations.length}/8`, `Deals ${Math.ceil(s.stock.length / 10)}`],
  isValid(g) {
    const all = [...g.stock, ...g.foundations.flat(), ...g.tableau.flatMap((c) => c.cards)];
    return all.length === 104 && new Set(all).size === 104 && g.tableau.length === 10 && [1, 2, 4].includes(g.suits);
  },
};
