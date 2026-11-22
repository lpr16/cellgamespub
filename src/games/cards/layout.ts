// Layout helpers shared by the card games. Pure, no UI.
import type { Metrics, PileId, PlacedCard, TableLayout } from './types';

/** Card size and column spacing for a table with this many columns. */
export function tableMetrics(width: number, height: number, columns: number) {
  const gap = Math.max(2, Math.round(width * (columns > 8 ? 0.007 : 0.012)));
  let cardW = (width - (columns - 1) * gap) / columns;
  // On a very short screen the cards shrink so a few rows of the tableau still fit.
  cardW = Math.max(10, Math.min(cardW, (height * 0.22) / 1.4));
  const cardH = cardW * 1.4;
  const pitch = columns > 1 ? (width - cardW) / (columns - 1) : 0;
  const tableauY = cardH + Math.round(cardW * 0.28);
  const metrics: Metrics = { cardW, cardH, tableauY };
  return { metrics, pitch };
}

/**
 * Lay a pile out downwards, overlapping. Face-down cards overlap more than face-up
 * ones, and a pile too long for the room it has is squeezed to stay on screen.
 */
export function fanDown(
  out: PlacedCard[],
  pile: PileId,
  ids: number[],
  faceOf: (id: number) => number,
  down: number,
  x: number,
  y: number,
  room: number,
  cardH: number,
): void {
  let downStep = cardH * 0.16;
  let upStep = cardH * 0.34;
  const needed = Math.min(down, Math.max(0, ids.length - 1)) * downStep + Math.max(0, ids.length - down - 1) * upStep;
  if (needed > room && needed > 0) {
    const squeeze = Math.max(0, room) / needed;
    downStep *= squeeze;
    upStep *= squeeze;
  }
  let at = y;
  ids.forEach((id, index) => {
    out[id] = { id, face: faceOf(id), x, y: at, z: index, up: index >= down, pile, index };
    at += index < down ? downStep : upStep;
  });
}

/**
 * The piles nearest to where a dragged card was let go, closest first.
 * `x` and `y` are the top-left corner of the lead card.
 */
export function dropCandidates(layout: TableLayout, x: number, y: number): PileId[] {
  const m = layout.metrics;
  const topRow = y < m.tableauY - m.cardH / 2;
  return layout.slots
    .filter((s) => s.y < m.tableauY === topRow)
    .map((s) => ({ pile: s.pile, distance: Math.abs(s.x - x) }))
    // Only count a column the card actually overlaps.
    .filter((s) => s.distance <= m.cardW * 0.75)
    .sort((a, b) => a.distance - b.distance)
    .map((s) => s.pile);
}
