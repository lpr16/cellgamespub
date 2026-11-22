// Klondike, described for the shared card table.
import type { CardRules, Move as TableMove } from '../cards/types';
import { computeLayout } from './layout';
import {
  bestTarget,
  canAutoFinish,
  canMove,
  deal,
  findHint,
  movable,
  reducer,
  type DrawCount,
  type Move,
  type PileId,
  type SolitaireState,
} from './logic';

function pileSize(s: SolitaireState, pile: string): number {
  if (pile === 'waste') return s.waste.length;
  if (pile === 'stock') return s.stock.length;
  const i = Number(pile.slice(1));
  return pile[0] === 'f' ? s.foundations[i].length : s.tableau[i].cards.length;
}

export const klondikeRules: CardRules<SolitaireState> = {
  id: 'solitaire',
  title: 'Solitaire',
  className: 'solitaire',
  modes: [
    { key: '1', label: 'Draw 1', note: 'Easier' },
    { key: '3', label: 'Draw 3', note: 'Classic' },
  ],
  newGameNote: 'Deals are shuffled at random, so not every game can be won.',
  deal: (seed, mode) => deal(seed, (mode === '3' ? 3 : 1) as DrawCount),
  modeOf: (s) => String(s.draw),
  reduce: reducer,
  layout: (s, width, height) => computeLayout(s, s.draw, width, height),
  tableDeps: (s) => [s.stock, s.waste, s.foundations, s.tableau, s.draw, s.seed],
  pickUp(s, pile, index) {
    const count = pileSize(s, pile) - index;
    const ids = movable(s, pile as PileId, count);
    return ids ? { from: pile, count, ids } : null;
  },
  canMove: (s, m: TableMove) => canMove(s, m as Move),
  bestTarget: (s, from, count) => bestTarget(s, from as PileId, count),
  hint: (s) => findHint(s, s.draw),
  hasAuto: canAutoFinish,
  canDraw: (s) => s.stock.length > 0 || s.waste.length > 0,
  status: (s) => [`Draw ${s.draw}`],
  isValid(g) {
    const all = [...g.stock, ...g.waste, ...g.foundations.flat(), ...g.tableau.flatMap((p) => p.cards)];
    return all.length === 52 && new Set(all).size === 52 && g.tableau.length === 7 && g.foundations.length === 4;
  },
};
