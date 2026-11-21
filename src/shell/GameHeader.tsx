import type { ReactNode } from 'react';

/** Top bar of every game: back to the home screen, the game's name, then its own controls. */
export function GameHeader(props: { title: string; onExit: () => void; children?: ReactNode }) {
  return (
    <header className="game-head">
      <button className="icon-btn" onClick={props.onExit} aria-label="Back to games">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 6l-6 6 6 6" />
        </svg>
      </button>
      <h1>{props.title}</h1>
      {props.children}
    </header>
  );
}
