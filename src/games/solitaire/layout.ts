// Turns the state of the table into pixel positions for every card. Pure, no UI.
import { foundationId, tableauId, type DrawCount, type PileId, type Table } from './logic';

export interface Metrics {
  cardW: number;
  cardH: number;
  /** Distance between the left edges of neighbouring columns. */
  pitch: number;
  /** Top of the seven tableau piles. */
  tableauY: number;
}

export interface PlacedCard {
  id: number;
  x: number;
  y: number;
  z: number;
  up: boolean;
  pile: PileId;
  /** Position in its pile, bottom card is 0. */
  index: number;
}

export interface Slot {
  pile: PileId;
  x: number;
  y: number;
}

export interface TableLayout {
  metrics: Metrics;
  /** One entry per card, indexed by card number. */
  cards: PlacedCard[];
  slots: Slot[];
}

// Columns, left to right: four foundations, the waste (two columns wide when fanned), the stock.
const WASTE_COL = 4;
const STOCK_COL = 6;

export function computeLayout(t: Table, draw: DrawCount, width: number, height: number): TableLayout {
  const gap = Math.max(3, Math.round(width * 0.012));
  let cardW = (width - 6 * gap) / 7;
  // On a very short screen the cards shrink so a few rows of the tableau still fit.
  cardW = Math.max(10, Math.min(cardW, (height * 0.22) / 1.4));
  const cardH = cardW * 1.4;
  const pitch = (width - cardW) / 6;
  const tableauY = cardH + Math.round(cardW * 0.28);
  const metrics: Metrics = { cardW, cardH, pitch, tableauY };

  const cards: PlacedCard[] = new Array(52);
  const slots: Slot[] = [];
  const colX = (col: number) => col * pitch;

  for (let i = 0; i < 4; i++) {
    const pile = foundationId(i);
    slots.push({ pile, x: colX(i), y: 0 });
    t.foundations[i].forEach((id, index) => {
      cards[id] = { id, x: colX(i), y: 0, z: index, up: true, pile, index };
    });
  }

  slots.push({ pile: 'stock', x: colX(STOCK_COL), y: 0 });
  t.stock.forEach((id, index) => {
    cards[id] = { id, x: colX(STOCK_COL), y: 0, z: index, up: false, pile: 'stock', index };
  });

  // The last few waste cards are spread out so a draw of three can be read at a glance.
  const fanned = draw === 3 ? 3 : 1;
  const fanStep = cardW * 0.34;
  const hidden = Math.max(0, t.waste.length - fanned);
  t.waste.forEach((id, index) => {
    const step = Math.max(0, index - hidden);
    cards[id] = { id, x: colX(WASTE_COL) + step * fanStep, y: 0, z: index, up: true, pile: 'waste', index };
  });

  const room = Math.max(0, height - tableauY - cardH);
  for (let i = 0; i < 7; i++) {
    const pile = tableauId(i);
    const { cards: ids, down } = t.tableau[i];
    slots.push({ pile, x: colX(i), y: tableauY });
    let downStep = cardH * 0.16;
    let upStep = cardH * 0.34;
    const needed = Math.min(down, ids.length - 1) * downStep + Math.max(0, ids.length - down - 1) * upStep;
    if (needed > room && needed > 0) {
      // A long pile is squeezed to stay on screen.
      const squeeze = room / needed;
      downStep *= squeeze;
      upStep *= squeeze;
    }
    let y = tableauY;
    ids.forEach((id, index) => {
      cards[id] = { id, x: colX(i), y, z: index, up: index >= down, pile, index };
      y += index < down ? downStep : upStep;
    });
  }

  return { metrics, cards, slots };
}

/**
 * The piles nearest to where a dragged card was let go, closest first.
 * `x` and `y` are the top-left corner of the lead card.
 */
export function dropCandidates(m: Metrics, x: number, y: number): PileId[] {
  const topRow = y < m.tableauY - m.cardH / 2;
  const exact = x / m.pitch;
  const cols = [Math.round(exact), exact > Math.round(exact) ? Math.round(exact) + 1 : Math.round(exact) - 1];
  const out: PileId[] = [];
  for (const col of cols) {
    // Only count a column the card actually overlaps.
    if (col < 0 || col > 6 || Math.abs(col * m.pitch - x) > m.cardW * 0.75) continue;
    if (topRow) {
      if (col < 4) out.push(foundationId(col));
    } else {
      out.push(tableauId(col));
    }
  }
  return out;
}
