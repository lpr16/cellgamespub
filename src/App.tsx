import { Suspense, useCallback, useEffect, useState } from 'react';
import { GAMES } from './games/registry';
import { Home } from './shell/Home';

// The open game lives in the address hash so the phone's back button returns home.
const currentRoute = () => window.location.hash.replace(/^#\/?/, '');

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const exit = useCallback(() => {
    // Going back keeps the history clean when the game was opened from home.
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '';
  }, []);

  const game = GAMES.find((g) => g.id === route && g.component);
  if (!game?.component) return <Home />;

  const Game = game.component;
  return (
    <Suspense fallback={<div className="screen loading">Loading {game.name}…</div>}>
      <Game onExit={exit} />
    </Suspense>
  );
}
