import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { formatTime } from '../../shell/format';
import { GameHeader } from '../../shell/GameHeader';
import { randomSeed } from '../../shell/random';
import { Sheet } from '../../shell/Sheet';
import { useHaptics } from '../../shell/settings';
import { load, remove, save } from '../../shell/storage';
import type { GameProps } from '../registry';
import { computeLayout, dropCandidates } from './layout';
import {
  bestTarget,
  canAutoFinish,
  canMove,
  deal,
  findHint,
  isRed,
  movable,
  rankOf,
  reducer,
  suitOf,
  type DrawCount,
  type PileId,
  type SolitaireAction,
  type SolitaireState,
} from './logic';
import { GAME_KEY, STATS_KEY } from './save';
import './solitaire.css';

interface ModeStats {
  started: number;
  won: number;
  bestTime: number | null;
  bestMoves: number | null;
}
type Stats = Record<DrawCount, ModeStats>;

const emptyMode = (): ModeStats => ({ started: 0, won: 0, bestTime: null, bestMoves: null });
const loadStats = (): Stats => ({ 1: emptyMode(), 3: emptyMode(), ...load<Partial<Stats>>(STATS_KEY, {}) });

/** A saved game is only trusted if all 52 cards are present exactly once. */
function loadGame(): SolitaireState | null {
  const g = load<SolitaireState | null>(GAME_KEY, null);
  if (!g || g.done) return null;
  try {
    const all = [...g.stock, ...g.waste, ...g.foundations.flat(), ...g.tableau.flatMap((p) => p.cards)];
    const ok = all.length === 52 && new Set(all).size === 52 && g.tableau.length === 7 && g.foundations.length === 4;
    return ok ? { ...g, history: g.history ?? [] } : null;
  } catch {
    return null;
  }
}

type Action = SolitaireAction | { type: 'load'; state: SolitaireState };

function rootReducer(s: SolitaireState | null, a: Action): SolitaireState | null {
  if (a.type === 'load') return a.state;
  return s ? reducer(s, a) : s;
}

const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_PATHS = [
  'M12 2C9 6.5 4 9.5 4 14a4 4 0 0 0 7 2.6c-.2 2-1 3.4-2.5 4.4h7c-1.5-1-2.3-2.4-2.5-4.4A4 4 0 0 0 20 14c0-4.5-5-7.5-8-12z',
  'M12 21C7 16.5 3 13.2 3 8.8A4.8 4.8 0 0 1 12 6.5 4.8 4.8 0 0 1 21 8.8c0 4.4-4 7.7-9 12.2z',
  'M12 2l7.5 10L12 22 4.5 12z',
  'M12 2.5a4.3 4.3 0 0 0-3.6 6.6 4.3 4.3 0 1 0 2.9 6.5c-.2 2-1 3.4-2.5 4.4h6.4c-1.5-1-2.3-2.4-2.5-4.4a4.3 4.3 0 1 0 2.9-6.5A4.3 4.3 0 0 0 12 2.5z',
];

const Suit = ({ suit, className }: { suit: number; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d={SUIT_PATHS[suit]} />
  </svg>
);

interface CardProps {
  id: number;
  x: number;
  y: number;
  z: number;
  up: boolean;
  dragging: boolean;
  lifted: boolean;
  hinted: boolean;
  refused: boolean;
}

const Card = memo(function Card(p: CardProps) {
  const cls = ['pc', p.up ? 'up' : 'down'];
  if (p.up && isRed(p.id)) cls.push('red');
  if (p.dragging) cls.push('dragging');
  if (p.hinted) cls.push('hinted');
  if (p.refused) cls.push('refused');
  const style: CSSProperties = {
    transform: `translate3d(${p.x}px, ${p.y}px, 0)`,
    zIndex: p.z + (p.dragging ? 2000 : p.lifted ? 1000 : 0),
  };
  return (
    <div
      className={cls.join(' ')}
      style={style}
      data-card={p.id}
      role="img"
      aria-label={p.up ? `${RANKS[rankOf(p.id)]} of ${SUIT_NAMES[suitOf(p.id)]}` : 'Face-down card'}
    >
      {p.up && (
        <span className="pc-face">
          <span className="pc-corner">
            {RANKS[rankOf(p.id)]}
            <Suit suit={suitOf(p.id)} />
          </span>
          <Suit suit={suitOf(p.id)} className="pc-big" />
        </span>
      )}
    </div>
  );
});

interface Press {
  pointerId: number;
  startX: number;
  startY: number;
  /** Null when the press is on the stock. */
  source: { from: PileId; count: number; ids: number[] } | null;
  dragging: boolean;
}

interface Drag {
  ids: number[];
  dx: number;
  dy: number;
}

export default function Solitaire({ onExit }: GameProps) {
  const buzz = useHaptics();
  const [state, dispatch] = useReducer(rootReducer, null, loadGame);
  const [picking, setPicking] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [winOpen, setWinOpen] = useState(false);
  const [records, setRecords] = useState({ time: false, moves: false });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [lifted, setLifted] = useState<ReadonlySet<number>>(new Set());
  const [hint, setHint] = useState<{ ids: number[]; target: PileId } | null>(null);
  const [refused, setRefused] = useState<number[]>([]);
  const [note, setNote] = useState('');

  const board = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const frame = useRef(0);

  const latest = useRef(state);
  latest.current = state;
  const latestStats = useRef(stats);
  latestStats.current = stats;

  // ---------- Saving ----------

  const persist = useCallback(() => {
    const s = latest.current;
    if (s && !s.done) save(GAME_KEY, { ...s, history: s.history.slice(-80) });
  }, []);

  useEffect(persist, [persist, state?.moves, state?.seed]);
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

  // ---------- Clock ----------

  // The clock starts with the first move.
  const running = Boolean(state) && !state!.done && state!.moves > 0 && !picking;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: 'tick', seconds: 1 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // ---------- Starting and finishing ----------

  const start = useCallback((draw: DrawCount) => {
    dispatch({ type: 'load', state: deal(randomSeed(), draw) });
    const prev = latestStats.current;
    const next = { ...prev, [draw]: { ...prev[draw], started: prev[draw].started + 1 } };
    save(STATS_KEY, next);
    setStats(next);
    setWinOpen(false);
    setPicking(false);
    setHint(null);
    setNote('');
  }, []);

  const done = state?.done ?? false;
  useEffect(() => {
    const s = latest.current;
    if (!done || !s) return;
    remove(GAME_KEY);
    buzz([30, 60, 30, 60, 80]);
    const prev = latestStats.current;
    const old = prev[s.draw];
    const time = old.bestTime === null || s.elapsed < old.bestTime;
    const moves = old.bestMoves === null || s.moves < old.bestMoves;
    const next = {
      ...prev,
      [s.draw]: {
        ...old,
        won: old.won + 1,
        bestTime: time ? s.elapsed : old.bestTime,
        bestMoves: moves ? s.moves : old.bestMoves,
      },
    };
    save(STATS_KEY, next);
    setStats(next);
    setRecords({ time: time && old.won > 0, moves: moves && old.won > 0 });
    setWinOpen(true);
  }, [done, buzz]);

  // When nothing is hidden any more, play the remaining cards out automatically.
  const finishing = state ? canAutoFinish(state) : false;
  useEffect(() => {
    if (!finishing || drag) return;
    const id = window.setInterval(() => dispatch({ type: 'auto' }), 90);
    return () => window.clearInterval(id);
  }, [finishing, drag]);

  // ---------- Layout ----------

  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [Boolean(state)]);

  const layout = useMemo(
    () => (state && size.w > 0 ? computeLayout(state, state.draw, size.w, size.h) : null),
    // Only the piles matter; the clock ticking must not recompute the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.stock, state?.waste, state?.foundations, state?.tableau, state?.draw, size],
  );

  // Cards changing pile fly above everything else until they land.
  const lastPiles = useRef<PileId[]>([]);
  useLayoutEffect(() => {
    if (!layout) return;
    const moved: number[] = [];
    layout.cards.forEach((c) => {
      if (lastPiles.current[c.id] && lastPiles.current[c.id] !== c.pile) moved.push(c.id);
      lastPiles.current[c.id] = c.pile;
    });
    if (moved.length === 0) return;
    setLifted(new Set(moved));
    const id = window.setTimeout(() => setLifted(new Set()), 260);
    return () => window.clearTimeout(id);
  }, [layout]);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 1800);
    return () => window.clearTimeout(id);
  }, [hint]);

  useEffect(() => {
    if (refused.length === 0) return;
    const id = window.setTimeout(() => setRefused([]), 320);
    return () => window.clearTimeout(id);
  }, [refused]);

  // ---------- Touch ----------

  const act = useCallback((action: SolitaireAction) => {
    setHint(null);
    setNote('');
    dispatch(action);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!state || !layout || press.current || finishing || state.done) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card],[data-slot]');
    if (!el) return;
    let source: Press['source'] = null;
    if (el.dataset.slot !== undefined) {
      if (el.dataset.slot !== 'stock') return;
    } else {
      const placed = layout.cards[Number(el.dataset.card)];
      if (placed.pile !== 'stock') {
        if (!placed.up) return;
        const pileSize =
          placed.pile === 'waste'
            ? state.waste.length
            : placed.pile[0] === 'f'
              ? state.foundations[Number(placed.pile.slice(1))].length
              : state.tableau[Number(placed.pile.slice(1))].cards.length;
        const count = pileSize - placed.index;
        const ids = movable(state, placed.pile, count);
        if (!ids) return;
        source = { from: placed.pile, count, ids };
      }
    }
    board.current?.setPointerCapture(e.pointerId);
    press.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, source, dragging: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId || !p.source) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!p.dragging && Math.hypot(dx, dy) < 8) return;
    p.dragging = true;
    const ids = p.source.ids;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setDrag({ ids, dx, dy }));
  };

  const endPress = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    press.current = null;
    cancelAnimationFrame(frame.current);
    setDrag(null);
    if (cancelled || !state || !layout) return;

    if (!p.source) {
      if (state.stock.length > 0 || state.waste.length > 0) {
        buzz(8);
        act({ type: 'draw' });
      }
      return;
    }
    const { from, count, ids } = p.source;
    let to: PileId | null = null;
    if (p.dragging) {
      const lead = layout.cards[ids[0]];
      const x = lead.x + e.clientX - p.startX;
      const y = lead.y + e.clientY - p.startY;
      to = dropCandidates(layout.metrics, x, y).find((pile) => canMove(state, { from, to: pile, count })) ?? null;
    } else {
      to = bestTarget(state, from, count);
      if (!to) setRefused(ids);
    }
    if (to) {
      buzz(8);
      act({ type: 'move', move: { from, to, count } });
    }
  };

  const showHint = () => {
    if (!state) return;
    const h = findHint(state, state.draw);
    if (h === null) {
      setNote('No moves found. Undo, or deal a new game.');
    } else if (h === 'draw') {
      setHint({ ids: state.stock.slice(-1), target: 'stock' });
    } else {
      setHint({ ids: movable(state, h.from, h.count) ?? [], target: h.to });
    }
  };

  // ---------- Screens ----------

  const picker = (
    <Sheet title="New game" onClose={state ? () => setPicking(false) : onExit}>
      {state && !state.done && state.moves > 0 && <p className="sheet-text">This replaces the game in progress.</p>}
      <div className="level-list">
        {([1, 3] as DrawCount[]).map((draw) => {
          const s = stats[draw];
          return (
            <button key={draw} className="level-btn" onClick={() => start(draw)}>
              <span>{draw === 1 ? 'Draw 1' : 'Draw 3'}</span>
              <small>
                {draw === 1 ? 'Easier' : 'Classic'}
                {s.won > 0 && ` · ${s.won} won`}
                {s.bestTime !== null && ` · best ${formatTime(s.bestTime)}`}
              </small>
            </button>
          );
        })}
      </div>
      <p className="sheet-note">Deals are shuffled at random, so not every game can be won.</p>
    </Sheet>
  );

  if (!state) {
    return (
      <div className="screen solitaire">
        <GameHeader title="Solitaire" onExit={onExit} />
        {picker}
      </div>
    );
  }

  const dragIds = drag?.ids ?? [];
  const boardStyle = layout
    ? ({ '--cw': `${layout.metrics.cardW}px`, '--ch': `${layout.metrics.cardH}px` } as CSSProperties)
    : undefined;

  return (
    <div className="screen solitaire">
      <GameHeader title="Solitaire" onExit={onExit}>
        <span className="timer" aria-label={`Time ${formatTime(state.elapsed)}`}>
          {formatTime(state.elapsed)}
        </span>
      </GameHeader>

      <div className="status">
        <span>Draw {state.draw}</span>
        <span>Moves {state.moves}</span>
        <span className="status-note" role="status">
          {finishing ? 'Finishing…' : note}
        </span>
      </div>

      <div
        className="table"
        ref={board}
        style={boardStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPress(e, false)}
        onPointerCancel={(e) => endPress(e, true)}
      >
        {layout?.slots.map((slot) => (
          <div
            key={slot.pile}
            className={`slot slot-${slot.pile[0]}${hint?.target === slot.pile ? ' hinted' : ''}`}
            data-slot={slot.pile}
            style={{ transform: `translate3d(${slot.x}px, ${slot.y}px, 0)` }}
          >
            {slot.pile[0] === 'f' && 'A'}
            {slot.pile === 'stock' && state.waste.length > 0 && (
              <svg viewBox="0 0 24 24" aria-label="Turn the waste pile over">
                <path d="M5 12a7 7 0 0 1 12-4.9L19 9M19 4v5h-5M19 12a7 7 0 0 1-12 4.9L5 15M5 20v-5h5" />
              </svg>
            )}
          </div>
        ))}
        {layout?.cards.map((c) => {
          const dragging = dragIds.includes(c.id);
          return (
            <Card
              key={c.id}
              id={c.id}
              x={c.x + (dragging ? drag!.dx : 0)}
              y={c.y + (dragging ? drag!.dy : 0)}
              z={c.z}
              up={c.up}
              dragging={dragging}
              lifted={lifted.has(c.id)}
              hinted={Boolean(hint && (hint.ids.includes(c.id) || isTopOf(state, hint.target, c.id)))}
              refused={refused.includes(c.id)}
            />
          );
        })}
      </div>

      <div className="tools">
        <button onClick={() => act({ type: 'undo' })} disabled={state.history.length === 0 || state.done || finishing}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3" />
          </svg>
          Undo
        </button>
        <button onClick={showHint} disabled={state.done || finishing}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2z" />
          </svg>
          Hint
        </button>
        <button onClick={() => setPicking(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New game
        </button>
      </div>

      {state.done && winOpen && !picking && (
        <Sheet title="You won!" onClose={() => setWinOpen(false)}>
          <p className="sheet-text">
            Draw {state.draw} in {formatTime(state.elapsed)} and {state.moves} moves
            {records.time && records.moves
              ? ' — new best time and fewest moves'
              : records.time
                ? ' — a new best time'
                : records.moves
                  ? ' — your fewest moves yet'
                  : ''}
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

/** Whether a card is the top card of the pile a hint points at. */
function isTopOf(s: SolitaireState, pile: PileId, id: number): boolean {
  if (pile === 'stock' || pile === 'waste') return false;
  const cards = pile[0] === 'f' ? s.foundations[Number(pile.slice(1))] : s.tableau[Number(pile.slice(1))].cards;
  return cards.length > 0 && cards[cards.length - 1] === id;
}
