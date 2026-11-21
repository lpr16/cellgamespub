// Klondike solitaire rules. Pure functions, no UI.
import { mulberry32, shuffle } from '../../shell/random';

// Cards are numbered 0..51: suit = floor(id / 13), rank = id % 13 + 1 (ace is 1, king is 13).
export const SPADES = 0;
export const HEARTS = 1;
export const DIAMONDS = 2;
export const CLUBS = 3;

export const rankOf = (id: number) => (id % 13) + 1;
export const suitOf = (id: number) => Math.floor(id / 13);
export const isRed = (id: number) => suitOf(id) === HEARTS || suitOf(id) === DIAMONDS;

export type PileId = 'stock' | 'waste' | `f${number}` | `t${number}`;

export interface TableauPile {
  /** Bottom card first. */
  cards: number[];
  /** How many cards at the bottom are still face down. */
  down: number;
}

/** Where every card is. In each pile the last card is the one on top. */
export interface Table {
  stock: number[];
  waste: number[];
  foundations: number[][];
  tableau: TableauPile[];
}

export type DrawCount = 1 | 3;

export interface SolitaireState extends Table {
  draw: DrawCount;
  seed: number;
  moves: number;
  elapsed: number;
  history: Table[];
  done: boolean;
}

export interface Move {
  from: PileId;
  to: PileId;
  /** Number of cards taken from the top of the source pile. */
  count: number;
}

export type SolitaireAction =
  | { type: 'move'; move: Move }
  | { type: 'draw' }
  | { type: 'auto' }
  | { type: 'undo' }
  | { type: 'tick'; seconds: number };

const HISTORY_LIMIT = 400;

const pileIndex = (id: PileId) => Number(id.slice(1));
const isFoundation = (id: PileId) => id[0] === 'f';
const isTableau = (id: PileId) => id[0] === 't';
export const foundationId = (i: number) => `f${i}` as PileId;
export const tableauId = (i: number) => `t${i}` as PileId;

export function deal(seed: number, draw: DrawCount): SolitaireState {
  const deck = shuffle(
    Array.from({ length: 52 }, (_, i) => i),
    mulberry32(seed),
  );
  const tableau: TableauPile[] = [];
  for (let i = 0; i < 7; i++) {
    tableau.push({ cards: deck.splice(0, i + 1), down: i });
  }
  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    draw,
    seed,
    moves: 0,
    elapsed: 0,
    history: [],
    done: false,
  };
}

/** The cards a move would pick up, bottom first, or null if they can't be picked up. */
export function movable(t: Table, from: PileId, count: number): number[] | null {
  if (count < 1) return null;
  if (from === 'waste') {
    return count === 1 && t.waste.length > 0 ? t.waste.slice(-1) : null;
  }
  if (isFoundation(from)) {
    const pile = t.foundations[pileIndex(from)];
    return count === 1 && pile?.length ? pile.slice(-1) : null;
  }
  if (isTableau(from)) {
    const pile = t.tableau[pileIndex(from)];
    if (!pile || count > pile.cards.length - pile.down) return null;
    return pile.cards.slice(-count);
  }
  return null;
}

/** Whether these cards may be put down on a pile. */
export function canPlace(t: Table, cards: number[], to: PileId): boolean {
  const lead = cards[0];
  if (isFoundation(to)) {
    const pile = t.foundations[pileIndex(to)];
    if (!pile || cards.length !== 1) return false;
    if (pile.length === 0) return rankOf(lead) === 1;
    const top = pile[pile.length - 1];
    return suitOf(top) === suitOf(lead) && rankOf(lead) === rankOf(top) + 1;
  }
  if (isTableau(to)) {
    const pile = t.tableau[pileIndex(to)];
    if (!pile) return false;
    if (pile.cards.length === 0) return rankOf(lead) === 13;
    const top = pile.cards[pile.cards.length - 1];
    return isRed(top) !== isRed(lead) && rankOf(lead) === rankOf(top) - 1;
  }
  return false;
}

export function canMove(t: Table, m: Move): boolean {
  if (m.from === m.to) return false;
  if (isFoundation(m.from) && !isTableau(m.to)) return false;
  const cards = movable(t, m.from, m.count);
  return cards !== null && canPlace(t, cards, m.to);
}

/** Carry out a move that has already been checked, turning over the card it uncovers. */
function applyMove(t: Table, m: Move): Table {
  const next: Table = { ...t, foundations: t.foundations.slice(), tableau: t.tableau.slice() };
  let cards: number[];
  if (m.from === 'waste') {
    cards = t.waste.slice(-1);
    next.waste = t.waste.slice(0, -1);
  } else if (isFoundation(m.from)) {
    const i = pileIndex(m.from);
    cards = t.foundations[i].slice(-1);
    next.foundations[i] = t.foundations[i].slice(0, -1);
  } else {
    const i = pileIndex(m.from);
    const pile = t.tableau[i];
    cards = pile.cards.slice(-m.count);
    const rest = pile.cards.slice(0, -m.count);
    next.tableau[i] = { cards: rest, down: Math.min(pile.down, Math.max(0, rest.length - 1)) };
  }
  if (isFoundation(m.to)) {
    const i = pileIndex(m.to);
    next.foundations[i] = [...next.foundations[i], ...cards];
  } else {
    const i = pileIndex(m.to);
    next.tableau[i] = { ...next.tableau[i], cards: [...next.tableau[i].cards, ...cards] };
  }
  return next;
}

/** Turn cards from the stock onto the waste, or turn the waste back over when the stock is empty. */
function drawCards(t: Table, count: number): Table | null {
  if (t.stock.length === 0) {
    if (t.waste.length === 0) return null;
    return { ...t, stock: t.waste.slice().reverse(), waste: [] };
  }
  const n = Math.min(count, t.stock.length);
  return {
    ...t,
    stock: t.stock.slice(0, -n),
    waste: [...t.waste, ...t.stock.slice(-n).reverse()],
  };
}

const isWon = (t: Table) => t.foundations.reduce((n, f) => n + f.length, 0) === 52;

/** The foundation a single card can go to right now, if any. */
function foundationFor(t: Table, card: number): PileId | null {
  for (let i = 0; i < 4; i++) {
    if (canPlace(t, [card], foundationId(i))) return foundationId(i);
  }
  return null;
}

/**
 * Where a tapped card should go: a foundation if it fits, otherwise the first
 * tableau pile that takes it. Moves that achieve nothing are left out.
 */
export function bestTarget(t: Table, from: PileId, count: number): PileId | null {
  if (isFoundation(from)) return null;
  const cards = movable(t, from, count);
  if (!cards) return null;
  if (count === 1) {
    const f = foundationFor(t, cards[0]);
    if (f) return f;
  }
  let emptyTarget: PileId | null = null;
  for (let i = 0; i < 7; i++) {
    const to = tableauId(i);
    if (to === from || !canPlace(t, cards, to)) continue;
    if (t.tableau[i].cards.length > 0) return to;
    // Shifting a whole pile to another empty space changes nothing.
    const wholePile = isTableau(from) && count === t.tableau[pileIndex(from)].cards.length;
    if (!wholePile) emptyTarget ??= to;
  }
  return emptyTarget;
}

/** A useful next step for a stuck player: a move, a draw from the stock, or nothing. */
export function findHint(t: Table, draw: DrawCount = 1): Move | 'draw' | null {
  // 1. Anything that can go up to a foundation.
  const sources: PileId[] = ['waste', ...t.tableau.map((_, i) => tableauId(i))];
  for (const from of sources) {
    const cards = movable(t, from, 1);
    const to = cards && foundationFor(t, cards[0]);
    if (to) return { from, to, count: 1 };
  }
  // 2. A whole face-up run that uncovers a face-down card.
  for (let i = 0; i < 7; i++) {
    const pile = t.tableau[i];
    if (pile.down === 0) continue;
    const count = pile.cards.length - pile.down;
    const to = bestTarget(t, tableauId(i), count);
    if (to && isTableau(to)) return { from: tableauId(i), to, count };
  }
  // 3. The waste card onto the tableau.
  if (t.waste.length > 0) {
    const to = bestTarget(t, 'waste', 1);
    if (to) return { from: 'waste', to, count: 1 };
  }
  // 4. Part of a run, when that frees a card for a foundation.
  for (let i = 0; i < 7; i++) {
    const pile = t.tableau[i];
    const faceUp = pile.cards.length - pile.down;
    for (let count = 1; count < faceUp; count++) {
      const exposed = pile.cards[pile.cards.length - count - 1];
      if (!foundationFor(t, exposed)) continue;
      const cards = pile.cards.slice(-count);
      for (let j = 0; j < 7; j++) {
        if (j !== i && t.tableau[j].cards.length > 0 && canPlace(t, cards, tableauId(j))) {
          return { from: tableauId(i), to: tableauId(j), count };
        }
      }
    }
  }
  // 5. More cards to look at.
  const unseen = t.stock.length > 0 || t.waste.length > (draw === 1 ? 1 : 3);
  return unseen ? 'draw' : null;
}

/** Once every tableau card is face up the rest can be played out without thinking. */
export function canAutoFinish(s: SolitaireState): boolean {
  if (s.done || s.tableau.some((p) => p.down > 0)) return false;
  return s.draw === 1 || (s.stock.length === 0 && s.waste.length === 0);
}

function autoStep(s: SolitaireState): Move | 'draw' | null {
  const sources: PileId[] = ['waste', ...s.tableau.map((_, i) => tableauId(i))];
  for (const from of sources) {
    const cards = movable(s, from, 1);
    const to = cards && foundationFor(s, cards[0]);
    if (to) return { from, to, count: 1 };
  }
  return s.stock.length > 0 || s.waste.length > 0 ? 'draw' : null;
}

const table = (s: Table): Table => ({
  stock: s.stock,
  waste: s.waste,
  foundations: s.foundations,
  tableau: s.tableau,
});

function commit(s: SolitaireState, next: Table): SolitaireState {
  const history = [...s.history, table(s)];
  return {
    ...s,
    ...next,
    history: history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history,
    moves: s.moves + 1,
    done: isWon(next),
  };
}

export function reducer(s: SolitaireState, a: SolitaireAction): SolitaireState {
  switch (a.type) {
    case 'tick':
      return s.done ? s : { ...s, elapsed: s.elapsed + a.seconds };

    case 'move':
      if (s.done || !canMove(s, a.move)) return s;
      return commit(s, applyMove(s, a.move));

    case 'draw': {
      if (s.done) return s;
      const next = drawCards(s, s.draw);
      return next ? commit(s, next) : s;
    }

    case 'auto': {
      if (!canAutoFinish(s)) return s;
      const step = autoStep(s);
      if (step === null) return s;
      if (step === 'draw') {
        const next = drawCards(s, s.draw);
        return next ? commit(s, next) : s;
      }
      return commit(s, applyMove(s, step));
    }

    case 'undo': {
      if (s.done || s.history.length === 0) return s;
      const last = s.history[s.history.length - 1];
      return { ...s, ...last, history: s.history.slice(0, -1), moves: s.moves + 1 };
    }
  }
}
