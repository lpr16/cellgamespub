// The screen shared by every card game: a table of draggable, animated cards with
// undo, hints, a clock, saving and statistics. Each game supplies its rules.
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
import { dropCandidates } from './layout';
import {
  isRedFace,
  rankOfFace,
  suitOfFace,
  type CardAction,
  type CardRules,
  type CardState,
  type PickUp,
  type PileId,
} from './types';
import './cards.css';

interface ModeStats {
  started: number;
  won: number;
  bestTime: number | null;
  bestMoves: number | null;
}
type Stats = Record<string, ModeStats>;

const emptyMode = (): ModeStats => ({ started: 0, won: 0, bestTime: null, bestMoves: null });

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
  face: number;
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
  if (p.up && isRedFace(p.face)) cls.push('red');
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
      aria-label={p.up ? `${RANKS[rankOfFace(p.face)]} of ${SUIT_NAMES[suitOfFace(p.face)]}` : 'Face-down card'}
    >
      {p.up && (
        <span className="pc-face">
          <span className="pc-corner">
            {RANKS[rankOfFace(p.face)]}
            <Suit suit={suitOfFace(p.face)} />
          </span>
          <Suit suit={suitOfFace(p.face)} className="pc-big" />
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
  source: PickUp | null;
  dragging: boolean;
}

interface Drag {
  ids: number[];
  dx: number;
  dy: number;
}

type Action<S> = CardAction | { type: 'load'; state: S };

export function CardGameScreen<S extends CardState>({ rules, onExit }: { rules: CardRules<S>; onExit: () => void }) {
  const buzz = useHaptics();
  const gameKey = `${rules.id}.game`;
  const statsKey = `${rules.id}.stats`;

  const reducer = useCallback(
    (s: S | null, a: Action<S>): S | null => (a.type === 'load' ? a.state : s ? rules.reduce(s, a) : s),
    [rules],
  );
  const [state, dispatch] = useReducer(reducer, null, (): S | null => {
    const saved = load<S | null>(gameKey, null);
    try {
      return saved && !saved.done && rules.isValid(saved) ? { ...saved, history: saved.history ?? [] } : null;
    } catch {
      return null;
    }
  });
  const [picking, setPicking] = useState(false);
  const [stats, setStats] = useState<Stats>(() => load<Stats>(statsKey, {}));
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
    if (s && !s.done) save(gameKey, { ...s, history: s.history.slice(-80) });
  }, [gameKey]);

  // A number that changes whenever the cards on the table do (and not when the clock ticks).
  const deps = state ? rules.tableDeps(state) : null;
  const lastDeps = useRef<unknown[] | null>(null);
  const version = useRef(0);
  if (!sameItems(lastDeps.current, deps)) {
    lastDeps.current = deps;
    version.current++;
  }
  const tableVersion = version.current;

  useEffect(persist, [persist, tableVersion]);
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

  const start = useCallback(
    (mode: string) => {
      dispatch({ type: 'load', state: rules.deal(randomSeed(), mode) });
      const prev = latestStats.current;
      const old = prev[mode] ?? emptyMode();
      const next = { ...prev, [mode]: { ...old, started: old.started + 1 } };
      save(statsKey, next);
      setStats(next);
      setWinOpen(false);
      setPicking(false);
      setHint(null);
      setNote('');
    },
    [rules, statsKey],
  );

  const done = state?.done ?? false;
  useEffect(() => {
    const s = latest.current;
    if (!done || !s) return;
    remove(gameKey);
    buzz([30, 60, 30, 60, 80]);
    const mode = rules.modeOf(s);
    const prev = latestStats.current;
    const old = prev[mode] ?? emptyMode();
    const time = old.bestTime === null || s.elapsed < old.bestTime;
    const moves = old.bestMoves === null || s.moves < old.bestMoves;
    const next = {
      ...prev,
      [mode]: {
        ...old,
        won: old.won + 1,
        bestTime: time ? s.elapsed : old.bestTime,
        bestMoves: moves ? s.moves : old.bestMoves,
      },
    };
    save(statsKey, next);
    setStats(next);
    setRecords({ time: time && old.won > 0, moves: moves && old.won > 0 });
    setWinOpen(true);
  }, [done, buzz, rules, gameKey, statsKey]);

  // Moves that need no thought are played automatically, one card at a time.
  const autoPlaying = state ? rules.hasAuto(state) : false;
  useEffect(() => {
    if (!autoPlaying || drag) return;
    const id = window.setInterval(() => dispatch({ type: 'auto' }), 90);
    return () => window.clearInterval(id);
  }, [autoPlaying, drag]);

  // ---------- Layout ----------

  const hasState = Boolean(state);
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasState]);

  const layout = useMemo(
    () => (state && size.w > 0 ? rules.layout(state, size.w, size.h) : null),
    // Only the piles matter; the clock ticking must not recompute the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, size, tableVersion],
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

  const act = useCallback((action: CardAction) => {
    setHint(null);
    setNote('');
    dispatch(action);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!state || !layout || press.current || autoPlaying || state.done) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card],[data-slot]');
    if (!el) return;
    let source: PickUp | null = null;
    if (el.dataset.slot !== undefined) {
      if (el.dataset.slot !== 'stock') return;
    } else {
      const placed = layout.cards[Number(el.dataset.card)];
      if (placed.pile !== 'stock') {
        source = rules.pickUp(state, placed.pile, placed.index);
        if (!source) {
          if (placed.up) setRefused([placed.id]);
          return;
        }
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
      if (!rules.canDraw(state)) return;
      const blocked = rules.drawBlocked?.(state) ?? null;
      if (blocked) {
        setNote(blocked);
      } else {
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
      to = dropCandidates(layout, x, y).find((pile) => rules.canMove(state, { from, to: pile, count })) ?? null;
    } else {
      to = rules.bestTarget(state, from, count);
      if (!to) setRefused(ids);
    }
    if (to) {
      buzz(8);
      act({ type: 'move', move: { from, to, count } });
    }
  };

  const showHint = () => {
    if (!state || !layout) return;
    const h = rules.hint(state);
    if (h === null) {
      setNote('No moves found. Undo, or start a new game.');
    } else if (h === 'draw') {
      const stock = layout.cards.filter((c) => c.pile === 'stock');
      setHint({ ids: stock.length ? [stock.reduce((a, b) => (b.z > a.z ? b : a)).id] : [], target: 'stock' });
    } else {
      setHint({ ids: rules.pickUp(state, h.from, pileSize(layout, h.from) - h.count)?.ids ?? [], target: h.to });
    }
  };

  // ---------- Screens ----------

  const modeLabel = (key: string) => rules.modes.find((m) => m.key === key)?.label ?? key;

  const picker = (
    <Sheet title="New game" onClose={state ? () => setPicking(false) : onExit}>
      {state && !state.done && state.moves > 0 && <p className="sheet-text">This replaces the game in progress.</p>}
      <div className="level-list">
        {rules.modes.map((mode) => {
          const s = stats[mode.key] ?? emptyMode();
          return (
            <button key={mode.key} className="level-btn" onClick={() => start(mode.key)}>
              <span>{mode.label}</span>
              <small>
                {mode.note}
                {s.won > 0 && ` · ${s.won} won`}
                {s.bestTime !== null && ` · best ${formatTime(s.bestTime)}`}
              </small>
            </button>
          );
        })}
      </div>
      {rules.newGameNote && <p className="sheet-note">{rules.newGameNote}</p>}
    </Sheet>
  );

  if (!state) {
    return (
      <div className={`screen card-game ${rules.className}`}>
        <GameHeader title={rules.title} onExit={onExit} />
        {picker}
      </div>
    );
  }

  const dragIds = drag?.ids ?? [];
  const boardStyle = layout
    ? ({ '--cw': `${layout.metrics.cardW}px`, '--ch': `${layout.metrics.cardH}px` } as CSSProperties)
    : undefined;
  const hintTop = hint && layout ? topCard(layout, hint.target) : -1;
  const stockEmpty = layout ? !layout.cards.some((c) => c.pile === 'stock') : false;

  return (
    <div className={`screen card-game ${rules.className}`}>
      <GameHeader title={rules.title} onExit={onExit}>
        <span className="timer" aria-label={`Time ${formatTime(state.elapsed)}`}>
          {formatTime(state.elapsed)}
        </span>
      </GameHeader>

      <div className="status">
        {rules.status(state).map((text) => (
          <span key={text}>{text}</span>
        ))}
        <span>Moves {state.moves}</span>
        <span className="status-note" role="status">
          {note}
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
            className={`slot slot-${slot.kind}${hint?.target === slot.pile ? ' hinted' : ''}`}
            data-slot={slot.pile}
            style={{ transform: `translate3d(${slot.x}px, ${slot.y}px, 0)` }}
          >
            {slot.kind === 'foundation' && 'A'}
            {slot.kind === 'stock' && stockEmpty && rules.canDraw(state) && (
              <svg viewBox="0 0 24 24" aria-label="Turn the pile over">
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
              face={c.face}
              x={c.x + (dragging ? drag!.dx : 0)}
              y={c.y + (dragging ? drag!.dy : 0)}
              z={c.z}
              up={c.up}
              dragging={dragging}
              lifted={lifted.has(c.id)}
              hinted={Boolean(hint && (hint.ids.includes(c.id) || c.id === hintTop))}
              refused={refused.includes(c.id)}
            />
          );
        })}
      </div>

      <div className="tools">
        <button onClick={() => act({ type: 'undo' })} disabled={state.history.length === 0 || state.done || autoPlaying}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3" />
          </svg>
          Undo
        </button>
        <button onClick={showHint} disabled={state.done || autoPlaying}>
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
            {modeLabel(rules.modeOf(state))} in {formatTime(state.elapsed)} and {state.moves} moves
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

function sameItems(a: unknown[] | null, b: unknown[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function pileSize(layout: { cards: { pile: PileId }[] }, pile: PileId): number {
  return layout.cards.filter((c) => c.pile === pile).length;
}

/** The card on top of a pile, or -1 if the pile is empty. */
function topCard(layout: { cards: { id: number; pile: PileId; index: number }[] }, pile: PileId): number {
  let top = -1;
  let best = -1;
  for (const c of layout.cards) {
    if (c.pile === pile && c.index > best) {
      best = c.index;
      top = c.id;
    }
  }
  return pile === 'stock' ? -1 : top;
}
