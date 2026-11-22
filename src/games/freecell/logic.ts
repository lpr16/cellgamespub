// FreeCell rules. Pure functions, no UI.
// Cards are numbered 0..51: suit = floor(id / 13), rank = id % 13 + 1 (ace is 1, king is 13).
import { mulberry32, shuffle } from '../../shell/random';
import type { CardAction, Move, PileId } from '../cards/types';

export const rankOf = (id: number) => (id % 13) + 1;
export const suitOf = (id: number) => Math.floor(id / 13);
export const isRed = (id: number) => suitOf(id) === 1 || suitOf(id) === 2;

/** Where every card is. In each pile the last card is the one on top. */
export interface Table {
  /** Four holding spaces, one card each. */
  cells: (number | null)[];
  foundations: number[][];
  /** Eight columns, bottom card first. Every card is face up. */
  tableau: number[][];
}

export interface FreeCellState extends Table {
  seed: number;
  moves: number;
  elapsed: number;
  history: Table[];
  done: boolean;
}

const HISTORY_LIMIT = 400;

const index = (id: PileId) => Number(id.slice(1));
export const cellId = (i: number) => `c${i}`;
export const foundationId = (i: number) => `f${i}`;
export const tableauId = (i: number) => `t${i}`;

export function deal(seed: number): FreeCellState {
  const deck = shuffle(
    Array.from({ length: 52 }, (_, i) => i),
    mulberry32(seed),
  );
  const tableau: number[][] = Array.from({ length: 8 }, () => []);
  deck.forEach((card, i) => tableau[i % 8].push(card));
  return {
    cells: [null, null, null, null],
    foundations: [[], [], [], []],
    tableau,
    seed,
    moves: 0,
    elapsed: 0,
    history: [],
    done: false,
  };
}

/** One card lower and of the other colour: may sit on `below` in a column. */
const stacks = (card: number, below: number) => isRed(card) !== isRed(below) && rankOf(card) === rankOf(below) - 1;

/** The cards a move would pick up, bottom first, or null if they can't be picked up together. */
export function movable(t: Table, from: PileId, count: number): number[] | null {
  if (count < 1) return null;
  if (from[0] === 'c') {
    const card = t.cells[index(from)];
    return count === 1 && card !== null && card !== undefined ? [card] : null;
  }
  if (from[0] !== 't') return null;
  const pile = t.tableau[index(from)];
  if (!pile || count > pile.length) return null;
  const cards = pile.slice(-count);
  for (let i = 1; i < cards.length; i++) {
    if (!stacks(cards[i], cards[i - 1])) return null;
  }
  return cards;
}

function canPlace(t: Table, cards: number[], to: PileId): boolean {
  const lead = cards[0];
  if (to[0] === 'c') return cards.length === 1 && t.cells[index(to)] === null;
  if (to[0] === 'f') {
    const pile = t.foundations[index(to)];
    if (!pile || cards.length !== 1) return false;
    if (pile.length === 0) return rankOf(lead) === 1;
    const top = pile[pile.length - 1];
    return suitOf(top) === suitOf(lead) && rankOf(lead) === rankOf(top) + 1;
  }
  if (to[0] === 't') {
    const pile = t.tableau[index(to)];
    if (!pile) return false;
    return pile.length === 0 || stacks(lead, pile[pile.length - 1]);
  }
  return false;
}

/**
 * Only one card moves at a time, so a run can travel only if the free cells and
 * empty columns could shuttle it across: (free cells + 1) doubled for each empty column.
 */
export function maxRun(t: Table, to: PileId): number {
  const freeCells = t.cells.filter((c) => c === null).length;
  let emptyColumns = t.tableau.filter((p) => p.length === 0).length;
  if (to[0] === 't' && t.tableau[index(to)]?.length === 0) emptyColumns--;
  return (freeCells + 1) * 2 ** emptyColumns;
}

export function canMove(t: Table, m: Move): boolean {
  if (m.from === m.to) return false;
  const cards = movable(t, m.from, m.count);
  return cards !== null && canPlace(t, cards, m.to) && cards.length <= maxRun(t, m.to);
}

function applyMove(t: Table, m: Move): Table {
  const next: Table = { cells: t.cells.slice(), foundations: t.foundations.slice(), tableau: t.tableau.slice() };
  let cards: number[];
  if (m.from[0] === 'c') {
    cards = [t.cells[index(m.from)]!];
    next.cells[index(m.from)] = null;
  } else {
    const i = index(m.from);
    cards = t.tableau[i].slice(-m.count);
    next.tableau[i] = t.tableau[i].slice(0, -m.count);
  }
  if (m.to[0] === 'c') next.cells[index(m.to)] = cards[0];
  else if (m.to[0] === 'f') next.foundations[index(m.to)] = [...next.foundations[index(m.to)], ...cards];
  else next.tableau[index(m.to)] = [...next.tableau[index(m.to)], ...cards];
  return next;
}

const isWon = (t: Table) => t.foundations.reduce((n, f) => n + f.length, 0) === 52;

function foundationFor(t: Table, card: number): PileId | null {
  for (let i = 0; i < 4; i++) {
    if (canPlace(t, [card], foundationId(i))) return foundationId(i);
  }
  return null;
}

/** Highest rank already on the foundations for each suit. */
function builtTo(t: Table): number[] {
  const built = [0, 0, 0, 0];
  for (const pile of t.foundations) {
    if (pile.length) built[suitOf(pile[0])] = pile.length;
  }
  return built;
}

/** The single cards that could be picked up right now: column tops and free cells. */
function loose(t: Table): { from: PileId; card: number }[] {
  const out: { from: PileId; card: number }[] = [];
  t.tableau.forEach((pile, i) => {
    if (pile.length) out.push({ from: tableauId(i), card: pile[pile.length - 1] });
  });
  t.cells.forEach((card, i) => {
    if (card !== null) out.push({ from: cellId(i), card });
  });
  return out;
}

/**
 * A card that can go up to a foundation and will never be needed below again:
 * every card of the other colour that could sit on it is already up.
 */
export function safeAutoMove(t: Table): Move | null {
  const built = builtTo(t);
  for (const { from, card } of loose(t)) {
    const to = foundationFor(t, card);
    if (!to) continue;
    const others = isRed(card) ? [0, 3] : [1, 2];
    if (rankOf(card) <= 2 || others.every((suit) => built[suit] >= rankOf(card) - 1)) {
      return { from, to, count: 1 };
    }
  }
  return null;
}

/**
 * Where a tapped card should go: a foundation, then a column it continues,
 * then an empty column, and as a last resort a free cell.
 */
export function bestTarget(t: Table, from: PileId, count: number): PileId | null {
  const cards = movable(t, from, count);
  if (!cards) return null;
  if (count === 1) {
    const f = foundationFor(t, cards[0]);
    if (f) return f;
  }
  let empty: PileId | null = null;
  for (let i = 0; i < 8; i++) {
    const to = tableauId(i);
    if (!canMove(t, { from, to, count })) continue;
    if (t.tableau[i].length > 0) return to;
    // Shifting a whole column into another empty column changes nothing.
    const wholeColumn = from[0] === 't' && count === t.tableau[index(from)].length;
    if (!wholeColumn) empty ??= to;
  }
  if (empty) return empty;
  if (count === 1 && from[0] === 't') {
    const free = t.cells.indexOf(null);
    if (free >= 0) return cellId(free);
  }
  return null;
}

/** Length of the ordered run on top of a column. */
function runLength(pile: number[]): number {
  let n = pile.length ? 1 : 0;
  while (n < pile.length && stacks(pile[pile.length - n], pile[pile.length - n - 1])) n++;
  return n;
}

/** A sensible next step for a stuck player, or null when nothing useful is left. */
export function findHint(t: Table): Move | null {
  // 1. Anything that can go up to a foundation.
  for (const { from, card } of loose(t)) {
    const to = foundationFor(t, card);
    if (to) return { from, to, count: 1 };
  }
  // 2. A whole ordered run onto another column that continues it.
  for (let i = 0; i < 8; i++) {
    const pile = t.tableau[i];
    const count = runLength(pile);
    if (count === 0 || count === pile.length) continue;
    for (let j = 0; j < 8; j++) {
      if (j === i || t.tableau[j].length === 0) continue;
      const m = { from: tableauId(i), to: tableauId(j), count };
      if (canMove(t, m)) return m;
    }
  }
  // 3. A card out of a free cell onto a column.
  for (let c = 0; c < 4; c++) {
    if (t.cells[c] === null) continue;
    for (let j = 0; j < 8; j++) {
      const m = { from: cellId(c), to: tableauId(j), count: 1 };
      if (t.tableau[j].length > 0 && canMove(t, m)) return m;
    }
  }
  // 4. A run into an empty column, when that frees the cards under it.
  for (let i = 0; i < 8; i++) {
    const pile = t.tableau[i];
    const count = runLength(pile);
    if (count === 0 || count === pile.length) continue;
    for (let j = 0; j < 8; j++) {
      const m = { from: tableauId(i), to: tableauId(j), count };
      if (t.tableau[j].length === 0 && canMove(t, m)) return m;
    }
  }
  // 5. Park a column's top card in a free cell. Best is one that uncovers a card with
  //    somewhere to go; failing that, the shortest column, since emptying one opens up the most.
  const free = t.cells.indexOf(null);
  if (free >= 0) {
    for (let i = 0; i < 8; i++) {
      const pile = t.tableau[i];
      if (pile.length < 2) continue;
      const beneath = pile[pile.length - 2];
      const useful =
        foundationFor(t, beneath) !== null ||
        t.tableau.some((other, j) => j !== i && other.length > 0 && stacks(beneath, other[other.length - 1]));
      if (useful) return { from: tableauId(i), to: cellId(free), count: 1 };
    }
    const order = t.tableau
      .map((pile, i) => ({ i, length: pile.length }))
      .filter((p) => p.length > 0)
      .sort((a, b) => a.length - b.length);
    if (order.length) return { from: tableauId(order[0].i), to: cellId(free), count: 1 };
  }
  return null;
}

const table = (s: Table): Table => ({ cells: s.cells, foundations: s.foundations, tableau: s.tableau });

export function reducer(s: FreeCellState, a: CardAction): FreeCellState {
  switch (a.type) {
    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'move': {
      if (s.done || !canMove(s, a.move)) return s;
      const next = applyMove(s, a.move);
      const history = [...s.history, table(s)];
      return {
        ...s,
        ...next,
        history: history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history,
        moves: s.moves + 1,
        done: isWon(next),
      };
    }

    case 'auto': {
      // Automatic moves belong to the player's last move: undo takes them back with it.
      const m = s.done ? null : safeAutoMove(s);
      if (!m) return s;
      const next = applyMove(s, m);
      return { ...s, ...next, done: isWon(next) };
    }

    case 'undo': {
      if (s.done || s.history.length === 0) return s;
      const last = s.history[s.history.length - 1];
      return { ...s, ...last, history: s.history.slice(0, -1), moves: s.moves + 1 };
    }

    case 'draw':
      return s;
  }
}
