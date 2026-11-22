import { memo, useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { formatTime } from '../../shell/format';
import { GameHeader } from '../../shell/GameHeader';
import { randomSeed } from '../../shell/random';
import { Sheet } from '../../shell/Sheet';
import { useHaptics } from '../../shell/settings';
import { load, remove, save } from '../../shell/storage';
import type { GameProps } from '../registry';
import { BOARDS, LEVELS, PICTURES, newGame, pairsFound, reducer, type Level, type MemoryAction, type MemoryState } from './logic';
import { GAME_KEY, STATS_KEY } from './save';
import './memory.css';

interface LevelStats {
  played: number;
  won: number;
  bestTurns: number | null;
  bestTime: number | null;
}
type Stats = Record<Level, LevelStats>;

const emptyLevel = (): LevelStats => ({ played: 0, won: 0, bestTurns: null, bestTime: null });
const loadStats = (): Stats => ({
  easy: emptyLevel(),
  medium: emptyLevel(),
  hard: emptyLevel(),
  ...load<Partial<Stats>>(STATS_KEY, {}),
});

/** A saved game is only trusted if it fits its board and every picture appears twice. */
function loadGame(): MemoryState | null {
  const g = load<MemoryState | null>(GAME_KEY, null);
  if (!g || g.done || !BOARDS[g.level] || !Array.isArray(g.deck) || !Array.isArray(g.matched)) return null;
  const { cols, rows } = BOARDS[g.level];
  const ok =
    g.deck.length === cols * rows &&
    g.matched.length === g.deck.length &&
    g.deck.every((p) => PICTURES[p] !== undefined && g.deck.filter((q) => q === p).length === 2);
  // Cards left face up mid-turn start face down again.
  return ok ? { ...g, open: [] } : null;
}

type Action = MemoryAction | { type: 'load'; state: MemoryState };

function rootReducer(s: MemoryState | null, a: Action): MemoryState | null {
  if (a.type === 'load') return a.state;
  return s ? reducer(s, a) : s;
}

interface CardProps {
  position: number;
  picture: number;
  faceUp: boolean;
  matched: boolean;
  onFlip: (position: number) => void;
}

const Card = memo(function Card(p: CardProps) {
  const picture = PICTURES[p.picture];
  return (
    <button
      className={`mem-card${p.faceUp ? ' up' : ''}${p.matched ? ' matched' : ''}`}
      onClick={() => p.onFlip(p.position)}
      aria-label={p.faceUp ? picture.name : `Card ${p.position + 1}, face down`}
    >
      <span className="mem-inner">
        <span className="mem-back" />
        {/* The picture is only in the page while the card is face up, so it can't be peeked at. */}
        <span className="mem-front">{p.faceUp ? picture.symbol : ''}</span>
      </span>
    </button>
  );
});

export default function Memory({ onExit }: GameProps) {
  const buzz = useHaptics();
  const [state, dispatch] = useReducer(rootReducer, null, loadGame);
  const [picking, setPicking] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [winOpen, setWinOpen] = useState(false);
  const [records, setRecords] = useState({ turns: false, time: false });

  const latest = useRef(state);
  latest.current = state;
  const latestStats = useRef(stats);
  latestStats.current = stats;

  const persist = useCallback(() => {
    const s = latest.current;
    if (s && !s.done) save(GAME_KEY, s);
  }, []);

  useEffect(persist, [persist, state?.matched, state?.seed, state?.turns]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) persist();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persist);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [persist]);

  // The clock starts with the first card turned.
  const started = Boolean(state) && (state!.turns > 0 || state!.open.length > 0);
  const running = started && !state!.done && !picking;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: 'tick', seconds: 1 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // A pair that didn't match stays visible for a moment, then turns back.
  const mismatch = state?.open.length === 2 ? state.open : null;
  useEffect(() => {
    if (!mismatch) return;
    const id = window.setTimeout(() => dispatch({ type: 'settle' }), 1100);
    return () => window.clearTimeout(id);
  }, [mismatch]);

  const found = state ? pairsFound(state) : 0;
  const lastFound = useRef(found);
  useEffect(() => {
    if (found > lastFound.current) buzz([15, 40, 15]);
    lastFound.current = found;
  }, [found, buzz]);

  const start = useCallback((level: Level) => {
    dispatch({ type: 'load', state: newGame(level, randomSeed()) });
    const prev = latestStats.current;
    const next = { ...prev, [level]: { ...prev[level], played: prev[level].played + 1 } };
    save(STATS_KEY, next);
    setStats(next);
    setWinOpen(false);
    setPicking(false);
  }, []);

  const done = state?.done ?? false;
  useEffect(() => {
    const s = latest.current;
    if (!done || !s) return;
    remove(GAME_KEY);
    buzz([30, 60, 30, 60, 80]);
    const prev = latestStats.current;
    const old = prev[s.level];
    const turns = old.bestTurns === null || s.turns < old.bestTurns;
    const time = old.bestTime === null || s.elapsed < old.bestTime;
    const next = {
      ...prev,
      [s.level]: {
        ...old,
        won: old.won + 1,
        bestTurns: turns ? s.turns : old.bestTurns,
        bestTime: time ? s.elapsed : old.bestTime,
      },
    };
    save(STATS_KEY, next);
    setStats(next);
    setRecords({ turns: turns && old.won > 0, time: time && old.won > 0 });
    setWinOpen(true);
  }, [done, buzz]);

  const flip = useCallback(
    (position: number) => {
      buzz(8);
      dispatch({ type: 'flip', position });
    },
    [buzz],
  );

  const picker = (
    <Sheet title="New game" onClose={state ? () => setPicking(false) : onExit}>
      {state && !state.done && state.turns > 0 && <p className="sheet-text">This replaces the game in progress.</p>}
      <div className="level-list">
        {LEVELS.map((level) => {
          const board = BOARDS[level];
          const s = stats[level];
          return (
            <button key={level} className="level-btn" onClick={() => start(level)}>
              <span>{board.label}</span>
              <small>
                {(board.cols * board.rows) / 2} pairs
                {s.bestTurns !== null && ` · best ${s.bestTurns} turns`}
              </small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );

  if (!state) {
    return (
      <div className="screen memory">
        <GameHeader title="Memory" onExit={onExit} />
        {picker}
      </div>
    );
  }

  const board = BOARDS[state.level];
  const pairs = state.deck.length / 2;

  return (
    <div className="screen memory">
      <GameHeader title="Memory" onExit={onExit}>
        <span className="timer" aria-label={`Time ${formatTime(state.elapsed)}`}>
          {formatTime(state.elapsed)}
        </span>
      </GameHeader>

      <div className="status">
        <span>{board.label}</span>
        <span>
          Pairs {found}/{pairs}
        </span>
        <span>Turns {state.turns}</span>
        <button className="link-btn" onClick={() => setPicking(true)}>
          New game
        </button>
      </div>

      <div className="mem-wrap">
        <div className="mem-grid" style={{ '--cols': board.cols, '--rows': board.rows } as CSSProperties}>
          {state.deck.map((picture, i) => (
            <Card
              key={i}
              position={i}
              picture={picture}
              faceUp={state.matched[i] || state.open.includes(i)}
              matched={state.matched[i]}
              onFlip={flip}
            />
          ))}
        </div>
      </div>

      {state.done && winOpen && !picking && (
        <Sheet title="All pairs found!" onClose={() => setWinOpen(false)}>
          <p className="sheet-text">
            {board.label} in {state.turns} turns and {formatTime(state.elapsed)}
            {records.turns ? ' — your fewest turns yet' : records.time ? ' — a new best time' : ''}
          </p>
          <button className="primary-btn" onClick={() => setPicking(true)}>
            New game
          </button>
          <button className="ghost-btn" onClick={onExit}>
            Home
          </button>
        </Sheet>
      )}

      {picking && picker}
    </div>
  );
}
