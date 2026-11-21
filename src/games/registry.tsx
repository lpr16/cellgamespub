import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { savedSummary as sudokuSummary } from './sudoku/save';

export interface GameProps {
  onExit: () => void;
}

export interface GameEntry {
  id: string;
  name: string;
  blurb: string;
  /** CSS colour used for this game's card and highlights. */
  accent: string;
  art: ReactNode;
  /** Loaded only when the player opens the game. Missing means not built yet. */
  component?: LazyExoticComponent<ComponentType<GameProps>>;
  /** Text for a game in progress, shown on the home card. */
  resume?: () => string | null;
}

const sudokuArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="6" y="6" width="52" height="52" rx="8" className="art-fill" />
    <path d="M23.3 6v52M40.7 6v52M6 23.3h52M6 40.7h52" className="art-line" />
    <text x="14.7" y="19.5" className="art-text">5</text>
    <text x="32" y="36.8" className="art-text">3</text>
    <text x="49.3" y="54.2" className="art-text">9</text>
    <text x="49.3" y="19.5" className="art-text art-dim">1</text>
    <text x="14.7" y="54.2" className="art-text art-dim">7</text>
  </svg>
);

const solitaireArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="8" y="14" width="30" height="42" rx="5" className="art-fill art-dim" transform="rotate(-10 23 35)" />
    <rect x="24" y="10" width="30" height="42" rx="5" className="art-fill" transform="rotate(8 39 31)" />
    <path
      d="M39 22c-4 5-8 7.5-8 11.5a4.2 4.2 0 0 0 6.8 3.3L36.5 41h5l-1.3-4.2a4.2 4.2 0 0 0 6.8-3.3c0-4-4-6.5-8-11.5z"
      className="art-ink"
      transform="rotate(8 39 31)"
    />
  </svg>
);

const mahjongArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="17" y="11" width="34" height="46" rx="6" className="art-fill art-dim" />
    <rect x="13" y="7" width="34" height="46" rx="6" className="art-fill" />
    <circle cx="22.5" cy="18" r="4" className="art-ink" />
    <circle cx="37.5" cy="18" r="4" className="art-ink" />
    <circle cx="30" cy="30" r="4" className="art-ink" />
    <circle cx="22.5" cy="42" r="4" className="art-ink" />
    <circle cx="37.5" cy="42" r="4" className="art-ink" />
  </svg>
);

const crosswordArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="6" y="6" width="52" height="52" rx="8" className="art-fill" />
    <path d="M19 6v52M32 6v52M45 6v52M6 19h52M6 32h52M6 45h52" className="art-line" />
    <rect x="32" y="6" width="13" height="13" className="art-ink" />
    <rect x="6" y="32" width="13" height="13" className="art-ink" />
    <rect x="45" y="45" width="13" height="13" className="art-ink" />
    <text x="12.5" y="17" className="art-text art-small">A</text>
    <text x="25.5" y="30" className="art-text art-small">B</text>
    <text x="38.5" y="43" className="art-text art-small">C</text>
  </svg>
);

export const GAMES: GameEntry[] = [
  {
    id: 'sudoku',
    name: 'Sudoku',
    blurb: 'Four levels, one solution each',
    accent: 'var(--sudoku)',
    art: sudokuArt,
    component: lazy(() => import('./sudoku/Sudoku')),
    resume: sudokuSummary,
  },
  {
    id: 'solitaire',
    name: 'Solitaire',
    blurb: 'Klondike',
    accent: 'var(--solitaire)',
    art: solitaireArt,
  },
  {
    id: 'mahjong',
    name: 'Mahjong',
    blurb: 'Tile matching',
    accent: 'var(--mahjong)',
    art: mahjongArt,
  },
  {
    id: 'crossword',
    name: 'Crosswords',
    blurb: 'Mini puzzles',
    accent: 'var(--crossword)',
    art: crosswordArt,
  },
];
