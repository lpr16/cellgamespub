import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { savedSummary as crosswordSummary } from './crossword/save';
import { savedSummary as freecellSummary } from './freecell/save';
import { savedSummary as hangmanSummary } from './hangman/save';
import { savedSummary as memorySummary } from './memory/save';
import { savedSummary as solitaireSummary } from './solitaire/save';
import { savedSummary as spiderSummary } from './spider/save';
import { savedSummary as sudokuSummary } from './sudoku/save';
import { savedSummary as wordSearchSummary } from './wordsearch/save';

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

const freecellArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="6" y="8" width="11" height="15" rx="2.5" className="art-line" />
    <rect x="20" y="8" width="11" height="15" rx="2.5" className="art-line" />
    <rect x="34" y="8" width="11" height="15" rx="2.5" className="art-fill" />
    <rect x="48" y="8" width="11" height="15" rx="2.5" className="art-fill" />
    <rect x="13" y="29" width="17" height="24" rx="3.5" className="art-fill art-dim" />
    <rect x="13" y="35" width="17" height="24" rx="3.5" className="art-fill" />
    <rect x="35" y="29" width="17" height="24" rx="3.5" className="art-fill art-dim" />
    <rect x="35" y="35" width="17" height="24" rx="3.5" className="art-fill" />
  </svg>
);

const spiderArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="16" y="6" width="32" height="22" rx="5" className="art-fill art-dim" />
    <rect x="16" y="15" width="32" height="22" rx="5" className="art-fill art-dim" />
    <rect x="16" y="24" width="32" height="22" rx="5" className="art-fill" />
    <rect x="16" y="33" width="32" height="26" rx="5" className="art-fill" />
    <text x="24" y="45.5" className="art-text art-small">K</text>
    <text x="40" y="55" className="art-text art-small">A</text>
  </svg>
);

const memoryArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="7" y="7" width="22" height="22" rx="5" className="art-fill" />
    <rect x="35" y="7" width="22" height="22" rx="5" className="art-ink art-dim" />
    <rect x="7" y="35" width="22" height="22" rx="5" className="art-ink art-dim" />
    <rect x="35" y="35" width="22" height="22" rx="5" className="art-fill" />
    <circle cx="18" cy="18" r="5" className="art-ink" />
    <circle cx="46" cy="46" r="5" className="art-ink" />
  </svg>
);

const wordSearchArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="6" y="6" width="52" height="52" rx="8" className="art-fill" />
    <rect x="10" y="25" width="44" height="14" rx="7" className="art-ink art-dim" />
    <text x="17.5" y="21" className="art-text art-dim">A</text>
    <text x="32" y="21" className="art-text art-dim">B</text>
    <text x="46.5" y="21" className="art-text art-dim">C</text>
    <text x="17.5" y="36.5" className="art-text">S</text>
    <text x="32" y="36.5" className="art-text">O</text>
    <text x="46.5" y="36.5" className="art-text">L</text>
    <text x="17.5" y="52" className="art-text art-dim">X</text>
    <text x="32" y="52" className="art-text art-dim">Y</text>
    <text x="46.5" y="52" className="art-text art-dim">Z</text>
  </svg>
);

const hangmanArt = (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="30.5" y="32" width="3" height="27" rx="1.5" className="art-ink art-dim" />
    <path d="M32 50c-8-1-12-5-13-11 7 0 12 4 13 11z" className="art-ink art-dim" />
    {[0, 1, 2, 3, 4].map((i) => (
      <ellipse key={i} cx="32" cy="11" rx="6.5" ry="10" className="art-ink" transform={`rotate(${i * 60} 32 24)`} />
    ))}
    <ellipse cx="32" cy="11" rx="6.5" ry="10" className="art-line" strokeDasharray="2 2.5" transform="rotate(300 32 24)" />
    <circle cx="32" cy="24" r="7" className="art-fill" />
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
    blurb: 'Klondike, draw one or three',
    accent: 'var(--solitaire)',
    art: solitaireArt,
    component: lazy(() => import('./solitaire/Solitaire')),
    resume: solitaireSummary,
  },
  {
    id: 'freecell',
    name: 'FreeCell',
    blurb: 'Every card in view',
    accent: 'var(--freecell)',
    art: freecellArt,
    component: lazy(() => import('./freecell/FreeCell')),
    resume: freecellSummary,
  },
  {
    id: 'spider',
    name: 'Spider',
    blurb: 'One, two or four suits',
    accent: 'var(--spider)',
    art: spiderArt,
    component: lazy(() => import('./spider/Spider')),
    resume: spiderSummary,
  },
  {
    id: 'memory',
    name: 'Memory',
    blurb: 'Find the matching pairs',
    accent: 'var(--memory)',
    art: memoryArt,
    component: lazy(() => import('./memory/Memory')),
    resume: memorySummary,
  },
  {
    id: 'crossword',
    name: 'Crosswords',
    blurb: 'English, Português, Español',
    accent: 'var(--crossword)',
    art: crosswordArt,
    component: lazy(() => import('./crossword/Crossword')),
    resume: crosswordSummary,
  },
  {
    id: 'wordsearch',
    name: 'Word search',
    blurb: 'English, Português, Español',
    accent: 'var(--wordsearch)',
    art: wordSearchArt,
    component: lazy(() => import('./wordsearch/WordSearch')),
    resume: wordSearchSummary,
  },
  {
    id: 'hangman',
    name: 'Hangman',
    blurb: 'Guess the word, save the flower',
    accent: 'var(--hangman)',
    art: hangmanArt,
    component: lazy(() => import('./hangman/Hangman')),
    resume: hangmanSummary,
  },
  {
    id: 'mahjong',
    name: 'Mahjong',
    blurb: 'Tile matching',
    accent: 'var(--mahjong)',
    art: mahjongArt,
  },
];
