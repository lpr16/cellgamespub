// What a card game has to provide so the shared table can deal, draw and animate it.

/** Name of a pile, such as "stock", "f0" (a foundation) or "t3" (a tableau column). */
export type PileId = string;

export interface Move {
  from: PileId;
  to: PileId;
  /** Number of cards taken from the top of the source pile. */
  count: number;
}

export type CardAction =
  | { type: 'move'; move: Move }
  /** Turn or deal cards from the stock. */
  | { type: 'draw' }
  /** One step of automatic play (see CardRules.hasAuto). */
  | { type: 'auto' }
  | { type: 'undo' }
  | { type: 'tick'; seconds: number };

/** Fields every card game keeps. */
export interface CardState {
  seed: number;
  moves: number;
  elapsed: number;
  history: unknown[];
  done: boolean;
}

export interface PlacedCard {
  /** Unique within the game; used to follow a card as it moves. */
  id: number;
  /** What is printed on it: suit * 13 + rank - 1. */
  face: number;
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
  kind: 'foundation' | 'tableau' | 'stock' | 'cell';
}

export interface Metrics {
  cardW: number;
  cardH: number;
  /** Top of the tableau columns; everything above is the top row. */
  tableauY: number;
}

export interface TableLayout {
  metrics: Metrics;
  cards: PlacedCard[];
  slots: Slot[];
}

export interface PickUp {
  from: PileId;
  count: number;
  ids: number[];
}

export interface CardRules<S extends CardState> {
  /** Prefix for saved data, e.g. "solitaire" saves under "solitaire.game". */
  id: string;
  title: string;
  /** CSS class on the screen; sets the accent colour. */
  className: string;
  /** Choices offered when starting a game. */
  modes: { key: string; label: string; note: string }[];
  /** Small print under the choices. */
  newGameNote?: string;
  deal(seed: number, mode: string): S;
  modeOf(s: S): string;
  reduce(s: S, a: CardAction): S;
  layout(s: S, width: number, height: number): TableLayout;
  /** The parts of the state the layout depends on, so a ticking clock doesn't redraw the table. */
  tableDeps(s: S): unknown[];
  /** What pressing this card would pick up, or null if it can't be moved. */
  pickUp(s: S, pile: PileId, index: number): PickUp | null;
  canMove(s: S, m: Move): boolean;
  /** Where a tapped card should go. */
  bestTarget(s: S, from: PileId, count: number): PileId | null;
  hint(s: S): Move | 'draw' | null;
  /** True while an 'auto' action would still do something. */
  hasAuto(s: S): boolean;
  /** Whether pressing the stock does anything at all. */
  canDraw(s: S): boolean;
  /** Why the stock can't be used right now, if there is a rule in the way. */
  drawBlocked?(s: S): string | null;
  /** Short facts for the status row, such as "Draw 3". */
  status(s: S): string[];
  /** Whether saved data is a game this version can continue. */
  isValid(saved: S): boolean;
}

export const rankOfFace = (face: number) => (face % 13) + 1;
export const suitOfFace = (face: number) => Math.floor(face / 13) % 4;
/** Hearts (1) and diamonds (2) are red. */
export const isRedFace = (face: number) => suitOfFace(face) === 1 || suitOfFace(face) === 2;
