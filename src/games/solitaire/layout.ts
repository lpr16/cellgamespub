// Turns the state of a Klondike table into pixel positions for every card. Pure, no UI.
import { fanDown, tableMetrics } from '../cards/layout';
import type { PlacedCard, Slot, TableLayout } from '../cards/types';
import { foundationId, tableauId, type DrawCount, type Table } from './logic';

// Columns, left to right: four foundations, the waste (two columns wide when fanned), the stock.
const WASTE_COL = 4;
const STOCK_COL = 6;

export function computeLayout(t: Table, draw: DrawCount, width: number, height: number): TableLayout {
  const { metrics, pitch } = tableMetrics(width, height, 7);
  const { cardW, cardH, tableauY } = metrics;
  const cards: PlacedCard[] = new Array(52);
  const slots: Slot[] = [];
  const colX = (col: number) => col * pitch;
  const face = (id: number) => id;

  for (let i = 0; i < 4; i++) {
    const pile = foundationId(i);
    slots.push({ pile, x: colX(i), y: 0, kind: 'foundation' });
    t.foundations[i].forEach((id, index) => {
      cards[id] = { id, face: id, x: colX(i), y: 0, z: index, up: true, pile, index };
    });
  }

  slots.push({ pile: 'stock', x: colX(STOCK_COL), y: 0, kind: 'stock' });
  t.stock.forEach((id, index) => {
    cards[id] = { id, face: id, x: colX(STOCK_COL), y: 0, z: index, up: false, pile: 'stock', index };
  });

  // The last few waste cards are spread out so a draw of three can be read at a glance.
  const fanned = draw === 3 ? 3 : 1;
  const fanStep = cardW * 0.34;
  const hidden = Math.max(0, t.waste.length - fanned);
  t.waste.forEach((id, index) => {
    const step = Math.max(0, index - hidden);
    cards[id] = { id, face: id, x: colX(WASTE_COL) + step * fanStep, y: 0, z: index, up: true, pile: 'waste', index };
  });

  const room = height - tableauY - cardH;
  for (let i = 0; i < 7; i++) {
    const pile = tableauId(i);
    slots.push({ pile, x: colX(i), y: tableauY, kind: 'tableau' });
    fanDown(cards, pile, t.tableau[i].cards, face, t.tableau[i].down, colX(i), tableauY, room, cardH);
  }

  return { metrics, cards, slots };
}
