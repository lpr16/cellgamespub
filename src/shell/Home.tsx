import { useEffect, useState, type CSSProperties } from 'react';
import { GAMES } from '../games/registry';
import { SettingsSheet } from './SettingsSheet';

export function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Read saved games after mounting: a game being closed writes its final save
  // just as this screen appears, and reading during render would miss it.
  const [resumes, setResumes] = useState<Record<string, string | null>>({});
  useEffect(() => {
    setResumes(Object.fromEntries(GAMES.map((g) => [g.id, g.resume?.() ?? null])));
  }, []);

  return (
    <div className="screen home">
      <header className="home-head">
        <h1>Cell Games</h1>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      </header>

      <ul className="game-grid">
        {GAMES.map((game) => {
          const ready = Boolean(game.component);
          const resume = ready ? resumes[game.id] : null;
          const style = { '--accent': game.accent } as CSSProperties;
          const body = (
            <>
              <span className="game-art">{game.art}</span>
              <span className="game-name">{game.name}</span>
              <span className="game-blurb">{resume ? `Continue · ${resume}` : game.blurb}</span>
              {!ready && <span className="game-soon">Coming soon</span>}
            </>
          );
          return (
            <li key={game.id}>
              {ready ? (
                <a className="game-card" href={`#/${game.id}`} style={style}>
                  {body}
                </a>
              ) : (
                <div className="game-card is-soon" style={style} aria-disabled="true">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
