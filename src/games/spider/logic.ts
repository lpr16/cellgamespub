// Spider solitaire rules. Pure functions, no UI.
// 104 cards with ids 0..103. What a card shows depends on how many suits are in play
// (see faceOf): one suit is the gentlest game, four the full one.
import { mulberry32, shuffle } from '../../shell/random';
import type { CardAction, Move, PileId } from '../cards/types';

export type SuitCount = 1 | 2 | 4;

export interface Column {
  /** Bottom card first. */
  cards: number[];
  /** How many cards at the bottom are still face down. */
  down: number;
}

/** Where every card is. In each pile the last card is the one on top. */
export interface Table {
  tableau: Column[];
  /** Dealt ten at a time, one onto each column. */
  stock: number[];
  /** Finished king-to-ace runs, thirteen cards each. */
  foundations: number[][];
}

export interface SpiderState extends Table {
  suits: SuitCount;
  seed: number;
  moves: number;
  elapsed: number;
  history: Table[];
  done: boolean;
}

const HISTORY_LIMIT = 400;
const COLUMNS = 10;

/** Suit * 13 + rank - 1. The eight packs of thirteen cycle through the suits in play. */
export function faceOf(id: number, suits: SuitCount): number {
  const suit = Math.floor(id / 13) % suits;
  return suit * 13 + (id % 13);
}

const index = (id: PileId) => Number(id.slice(1));
export const tableauId = (i: number) => `t${i}`;
export const foundationId = (i: number) => `f${i}`;

export function deal(seed: number, suits: SuitCount): SpiderState {
  const deck = shuffle(
    Array.from({ length: 104 }, (_, i) => i),
    mulberry32(seed),
  );
  const tableau: Column[] = [];
  for (let i = 0; i < COLUMNS; i++) {
    const size = i < 4 ? 6 : 5;
    tableau.push({ cards: deck.splice(0, size), down: size - 1 });
  }
  return { tableau, stock: deck, foundations: [], suits, seed, moves: 0, elapsed: 0, history: [], done: false };
}

/** Rules helpers bound to the number of suits in play. */
function reader(suits: SuitCount) {
  const rank = (id: number) => (faceOf(id, suits) % 13) + 1;
  const suit = (id: number) => Math.floor(faceOf(id, suits) / 13);
  /** `card` continues a run that can travel together: same suit, one lower. */
  const follows = (card: number, below: number) => suit(card) === suit(below) && rank(card) === rank(below) - 1;
  return { rank, suit, follows };
}

/** The cards a move would pick up, bottom first: a face-up run in one suit. */
export function movable(s: SpiderState, from: PileId, count: number): number[] | null {
  if (from[0] !== 't' || count < 1) return null;
  const pile = s.tableau[index(from)];
  if (!pile || count > pile.cards.length - pile.down) return null;
  const { follows } = reader(s.suits);
  const cards = pile.cards.slice(-count);
  for (let i = 1; i < cards.length; i++) {
    if (!follows(cards[i], cards[i - 1])) return null;
  }
  return cards;
}

export function canMove(s: SpiderState, m: Move): boolean {
  if (m.from === m.to || m.to[0] !== 't') return false;
  const cards = movable(s, m.from, m.count);
  const target = s.tableau[index(m.to)];
  if (!cards || !target) return false;
  if (target.cards.length === 0) return true;
  // Any suit may be built on, as long as the rank is one higher.
  const { rank } = reader(s.suits);
  return rank(cards[0]) === rank(target.cards[target.cards.length - 1]) - 1;
}

/** Turn over the top card of a column if it is face down. */
const uncover = (c: Column): Column =>
  c.cards.length > 0 && c.down >= c.cards.length ? { cards: c.cards, down: c.cards.length - 1 } : c;

/** Lift finished king-to-ace runs off the columns. */
function collect(t: Table, suits: SuitCount): Table {
  const { rank, follows } = reader(suits);
  let tableau = t.tableau;
  let foundations = t.foundations;
  tableau.forEach((column, i) => {
    const { cards, down } = column;
    if (cards.length - down < 13) return;
    const run = cards.slice(-13);
    if (rank(run[0]) !== 13) return;
    for (let k = 1; k < 13; k++) if (!follows(run[k], run[k - 1])) return;
    if (tableau === t.tableau) tableau = tableau.slice();
    tableau[i] = uncover({ cards: cards.slice(0, -13), down });
    foundations = [...foundations, run];
  });
  return tableau === t.tableau ? t : { ...t, tableau, foundations };
}

function applyMove(s: SpiderState, m: Move): Table {
  const from = index(m.from);
  const to = index(m.to);
  const tableau = s.tableau.slice();
  const source = s.tableau[from];
  const cards = source.cards.slice(-m.count);
  tableau[from] = uncover({ cards: source.cards.slice(0, -m.count), down: source.down });
  tableau[to] = { cards: [...s.tableau[to].cards, ...cards], down: s.tableau[to].down };
  return collect({ tableau, stock: s.stock, foundations: s.foundations }, s.suits);
}

/** Why the stock can't be dealt, or null if it can. */
export function dealBlocked(s: SpiderState): string | null {
  if (s.stock.length === 0) return 'No cards left to deal.';
  const onTable = s.tableau.reduce((n, c) => n + c.cards.length, 0);
  // The usual rule: every column must hold a card first (when there are enough cards to do it).
  if (onTable >= COLUMNS && s.tableau.some((c) => c.cards.length === 0)) return 'Fill every column before dealing.';
  return null;
}

function dealRow(s: SpiderState): Table {
  const count = Math.min(COLUMNS, s.stock.length);
  const dealt = s.stock.slice(-count).reverse();
  const tableau = s.tableau.map((c, i) => (i < count ? { cards: [...c.cards, dealt[i]], down: c.down } : c));
  return collect({ tableau, stock: s.stock.slice(0, -count), foundations: s.foundations }, s.suits);
}

/** Length of the single-suit run on top of a column. */
function runLength(s: SpiderState, column: Column): number {
  const { follows } = reader(s.suits);
  const { cards, down } = column;
  let n = cards.length > down ? 1 : 0;
  while (n < cards.length - down && follows(cards[cards.length - n], cards[cards.length - n - 1])) n++;
  return n;
}

/**
 * Where a tapped run should go: onto the same suit if possible (keeping it movable),
 * then any card one higher, then an empty column.
 */
export function bestTarget(s: SpiderState, from: PileId, count: number): PileId | null {
  const cards = movable(s, from, count);
  if (!cards) return null;
  const { suit } = reader(s.suits);
  let other: PileId | null = null;
  let empty: PileId | null = null;
  for (let i = 0; i < COLUMNS; i++) {
    const to = tableauId(i);
    if (!canMove(s, { from, to, count })) continue;
    const target = s.tableau[i].cards;
    if (target.length === 0) {
      // Shifting a whole column into another empty column changes nothing.
      if (count < s.tableau[index(from)].cards.length) empty ??= to;
    } else if (suit(target[target.length - 1]) === suit(cards[0])) {
      return to;
    } else {
      other ??= to;
    }
  }
  return other ?? empty;
}

/** A useful next step for a stuck player: a move, a deal from the stock, or nothing. */
export function findHint(s: SpiderState): Move | 'draw' | null {
  const { rank, suit } = reader(s.suits);
  let fallback: Move | null = null;
  let toEmpty: Move | null = null;
  for (let i = 0; i < COLUMNS; i++) {
    const column = s.tableau[i];
    const count = runLength(s, column);
    if (count === 0) continue;
    const lead = column.cards[column.cards.length - count];
    const under = column.cards[column.cards.length - count - 1];
    const underFaceUp = column.cards.length - count > column.down;
    // The run already sits on a card one higher: moving it elsewhere of another suit gains nothing.
    const settled = under !== undefined && underFaceUp && rank(under) === rank(lead) + 1;
    for (let j = 0; j < COLUMNS; j++) {
      if (j === i) continue;
      const m = { from: tableauId(i), to: tableauId(j), count };
      if (!canMove(s, m)) continue;
      const target = s.tableau[j].cards;
      if (target.length === 0) {
        if (under !== undefined && !settled) toEmpty ??= m;
      } else if (suit(target[target.length - 1]) === suit(lead)) {
        // Joining two runs of one suit is the best kind of move, unless it only shuffles sideways.
        if (!(settled && suit(under) === suit(lead))) return m;
      } else if (!settled) {
        fallback ??= m;
      }
    }
  }
  if (fallback) return fallback;
  if (toEmpty) return toEmpty;
  return dealBlocked(s) === null ? 'draw' : null;
}

const table = (s: Table): Table => ({ tableau: s.tableau, stock: s.stock, foundations: s.foundations });

function commit(s: SpiderState, next: Table): SpiderState {
  const history = [...s.history, table(s)];
  return {
    ...s,
    ...next,
    history: history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history,
    moves: s.moves + 1,
    done: next.foundations.length === 8,
  };
}

export function reducer(s: SpiderState, a: CardAction): SpiderState {
  switch (a.type) {
    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'move':
      if (s.done || !canMove(s, a.move)) return s;
      return commit(s, applyMove(s, a.move));

    case 'draw':
      if (s.done || dealBlocked(s) !== null) return s;
      return commit(s, dealRow(s));

    case 'undo': {
      if (s.done || s.history.length === 0) return s;
      const last = s.history[s.history.length - 1];
      return { ...s, ...last, history: s.history.slice(0, -1), moves: s.moves + 1 };
    }

    case 'auto':
      return s;
  }
}
