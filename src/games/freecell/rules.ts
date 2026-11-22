// FreeCell, described for the shared card table.
import { fanDown, tableMetrics } from '../cards/layout';
import type { CardRules, PlacedCard, Slot } from '../cards/types';
import {
  bestTarget,
  canMove,
  cellId,
  deal,
  findHint,
  foundationId,
  movable,
  reducer,
  safeAutoMove,
  tableauId,
  type FreeCellState,
} from './logic';

function pileSize(s: FreeCellState, pile: string): number {
  const i = Number(pile.slice(1));
  if (pile[0] === 'c') return s.cells[i] === null ? 0 : 1;
  return pile[0] === 'f' ? s.foundations[i].length : s.tableau[i].length;
}

export const freecellRules: CardRules<FreeCellState> = {
  id: 'freecell',
  title: 'FreeCell',
  className: 'freecell',
  modes: [{ key: 'classic', label: 'New deal', note: 'Almost every deal can be won' }],
  deal: (seed) => deal(seed),
  modeOf: () => 'classic',
  reduce: reducer,

  // Top row: four free cells on the left, four foundations on the right. Eight columns below.
  layout(s, width, height) {
    const { metrics, pitch } = tableMetrics(width, height, 8);
    const { cardH, tableauY } = metrics;
    const cards: PlacedCard[] = new Array(52);
    const slots: Slot[] = [];
    const face = (id: number) => id;
    for (let i = 0; i < 4; i++) {
      const pile = cellId(i);
      slots.push({ pile, x: i * pitch, y: 0, kind: 'cell' });
      const id = s.cells[i];
      if (id !== null) cards[id] = { id, face: id, x: i * pitch, y: 0, z: 0, up: true, pile, index: 0 };
    }
    for (let i = 0; i < 4; i++) {
      const pile = foundationId(i);
      const x = (i + 4) * pitch;
      slots.push({ pile, x, y: 0, kind: 'foundation' });
      s.foundations[i].forEach((id, index) => {
        cards[id] = { id, face: id, x, y: 0, z: index, up: true, pile, index };
      });
    }
    const room = height - tableauY - cardH;
    for (let i = 0; i < 8; i++) {
      const pile = tableauId(i);
      slots.push({ pile, x: i * pitch, y: tableauY, kind: 'tableau' });
      fanDown(cards, pile, s.tableau[i], face, 0, i * pitch, tableauY, room, cardH);
    }
    return { metrics, cards, slots };
  },

  tableDeps: (s) => [s.cells, s.foundations, s.tableau, s.seed],
  pickUp(s, pile, index) {
    const count = pileSize(s, pile) - index;
    const ids = movable(s, pile, count);
    return ids ? { from: pile, count, ids } : null;
  },
  canMove,
  bestTarget,
  hint: findHint,
  hasAuto: (s) => !s.done && safeAutoMove(s) !== null,
  canDraw: () => false,
  status: () => [],
  isValid(g) {
    const all = [...g.cells.filter((c) => c !== null), ...g.foundations.flat(), ...g.tableau.flat()];
    return all.length === 52 && new Set(all).size === 52 && g.tableau.length === 8 && g.cells.length === 4;
  },
};
