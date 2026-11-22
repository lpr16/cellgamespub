import {
  useCallback,
  useEffect,
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
import { LANGS, LANG_NAMES, loadLang, saveLang, type Lang } from '../words/lang';
import { wordsFor } from '../words/list';
import {
  LEVELS,
  generate,
  hintWord,
  lineCells,
  matchWord,
  newGame,
  reducer,
  snapEnd,
  type Level,
  type WordSearchAction,
  type WordSearchState,
} from './logic';
import { GAME_KEY, LEVEL_NAMES, STATS_KEY } from './save';
import { STRINGS } from './strings';
import './wordsearch.css';

type Stats = Record<Level, { started: number; won: number; best: number | null }>;

const emptyStats = (): Stats =>
  Object.fromEntries(LEVELS.map((l) => [l, { started: 0, won: 0, best: null }])) as Stats;
const loadStats = (): Stats => ({ ...emptyStats(), ...load<Partial<Stats>>(STATS_KEY, {}) });

/** A saved game is only trusted if its grid and words fit together. */
function loadGame(): WordSearchState | null {
  const g = load<WordSearchState | null>(GAME_KEY, null);
  try {
    const ok =
      g &&
      !g.done &&
      LANGS.includes(g.lang) &&
      LEVELS.includes(g.level) &&
      Array.isArray(g.grid) &&
      g.grid.length === g.size * g.size &&
      Array.isArray(g.found) &&
      g.words.every((w) => w.cells.map((c) => g.grid[c]).join('') === w.answer);
    return ok ? g : null;
  } catch {
    return null;
  }
}

type Action = WordSearchAction | { type: 'load'; state: WordSearchState };

function rootReducer(s: WordSearchState | null, a: Action): WordSearchState | null {
  if (a.type === 'load') return a.state;
  return s ? reducer(s, a) : s;
}

/** How many highlight colours there are; found words cycle through them. */
const COLOURS = 5;

interface Press {
  pointerId: number;
  start: number;
  end: number;
  /** Where the finger went down, in screen pixels. */
  x: number;
  y: number;
  moved: boolean;
}

export default function WordSearch({ onExit }: GameProps) {
  const buzz = useHaptics();
  const [state, dispatch] = useReducer(rootReducer, null, loadGame);
  const [pickLang, setPickLang] = useState<Lang>(loadLang);
  const [picking, setPicking] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [winOpen, setWinOpen] = useState(false);
  const [newBest, setNewBest] = useState(false);
  /** Cells under the finger while dragging. */
  const [selection, setSelection] = useState<number[] | null>(null);
  /** First letter chosen by a tap, waiting for the last. */
  const [anchor, setAnchor] = useState<number | null>(null);
  /** A selection that matched nothing, shown briefly. */
  const [missed, setMissed] = useState<number[] | null>(null);
  const [hintCell, setHintCell] = useState<number | null>(null);

  const grid = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);

  const latest = useRef(state);
  latest.current = state;
  const latestStats = useRef(stats);
  latestStats.current = stats;

  // The screen speaks the language of the game in play; before one exists, the chosen one.
  const lang = state?.lang ?? pickLang;
  const t = STRINGS[lang];

  // ---------- Saving ----------

  const persist = useCallback(() => {
    const s = latest.current;
    if (s && !s.done) save(GAME_KEY, s);
  }, []);

  useEffect(persist, [persist, state?.found, state?.seed, state?.hints]);
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

  const running = Boolean(state) && !state!.done && !picking;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: 'tick', seconds: 1 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // ---------- Starting and finishing ----------

  const start = useCallback((level: Level, language: Lang) => {
    saveLang(language);
    dispatch({ type: 'load', state: newGame(generate(language, level, randomSeed(), wordsFor(language))) });
    const prev = latestStats.current;
    const next = { ...prev, [level]: { ...prev[level], started: prev[level].started + 1 } };
    save(STATS_KEY, next);
    setStats(next);
    setWinOpen(false);
    setPicking(false);
    setSelection(null);
    setAnchor(null);
    setHintCell(null);
  }, []);

  const done = state?.done ?? false;
  useEffect(() => {
    const s = latest.current;
    if (!done || !s) return;
    remove(GAME_KEY);
    buzz([30, 60, 30, 60, 80]);
    const prev = latestStats.current;
    const old = prev[s.level];
    // Only unaided games count towards the best time.
    const best = s.hints === 0 && (old.best === null || s.elapsed < old.best);
    const next = { ...prev, [s.level]: { ...old, won: old.won + 1, best: best ? s.elapsed : old.best } };
    save(STATS_KEY, next);
    setStats(next);
    setNewBest(best && old.best !== null);
    setWinOpen(true);
  }, [done, buzz]);

  useEffect(() => {
    if (!missed) return;
    const id = window.setTimeout(() => setMissed(null), 350);
    return () => window.clearTimeout(id);
  }, [missed]);

  useEffect(() => {
    if (hintCell === null) return;
    const id = window.setTimeout(() => setHintCell(null), 2400);
    return () => window.clearTimeout(id);
  }, [hintCell]);

  // ---------- Touch ----------

  /** The finger's position in cell units, measured from the centre of the top-left cell. */
  const position = (e: ReactPointerEvent<HTMLDivElement>, size: number) => {
    const rect = grid.current!.getBoundingClientRect();
    return {
      row: ((e.clientY - rect.top) / rect.height) * size - 0.5,
      col: ((e.clientX - rect.left) / rect.width) * size - 0.5,
    };
  };

  const submit = (cells: number[]) => {
    if (!state) return;
    if (matchWord(state, cells) >= 0) {
      buzz(12);
      dispatch({ type: 'select', cells });
      setHintCell(null);
    } else {
      setMissed(cells);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!state || state.done || press.current) return;
    const { size } = state;
    const { row, col } = position(e, size);
    const r = Math.min(size - 1, Math.max(0, Math.round(row)));
    const c = Math.min(size - 1, Math.max(0, Math.round(col)));
    const start = r * size + c;
    grid.current?.setPointerCapture(e.pointerId);
    press.current = { pointerId: e.pointerId, start, end: start, x: e.clientX, y: e.clientY, moved: false };
    setSelection([start]);
    setMissed(null);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!state || !p || p.pointerId !== e.pointerId) return;
    if (!p.moved) {
      // A finger that barely shifts is a tap, not a drag.
      const cellPx = grid.current!.getBoundingClientRect().width / state.size;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < cellPx * 0.4) return;
    }
    const { row, col } = position(e, state.size);
    const end = snapEnd(state.size, p.start, row, col);
    if (end === p.end) return;
    p.end = end;
    p.moved = true;
    setSelection(lineCells(state.size, p.start, end));
  };

  const endPress = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const p = press.current;
    if (!state || !p || p.pointerId !== e.pointerId) return;
    press.current = null;
    setSelection(null);
    if (cancelled) return;

    if (p.moved) {
      // A drag: judge the line it covered. Dragging back to the start cancels it.
      setAnchor(null);
      const cells = lineCells(state.size, p.start, p.end);
      if (cells && cells.length > 1) submit(cells);
      return;
    }
    // A tap: the first picks the first letter, the second the last.
    if (anchor === null) {
      setAnchor(p.start);
    } else if (anchor === p.start) {
      setAnchor(null);
    } else {
      const cells = lineCells(state.size, anchor, p.start);
      if (cells) {
        submit(cells);
        setAnchor(null);
      } else {
        setAnchor(p.start);
      }
    }
  };

  const showHint = () => {
    if (!state) return;
    const index = hintWord(state);
    if (index < 0) return;
    dispatch({ type: 'hint' });
    setHintCell(state.words[index].cells[0]);
  };

  // ---------- Screens ----------

  const picker = (
    <Sheet title={STRINGS[pickLang].newGame} onClose={state ? () => setPicking(false) : onExit}>
      {state && !state.done && state.found.length > 0 && <p className="sheet-text">{STRINGS[pickLang].replaces}</p>}
      <div className="segmented ws-langs" role="radiogroup" aria-label={STRINGS[pickLang].language}>
        {LANGS.map((code) => (
          <button
            key={code}
            role="radio"
            aria-checked={code === pickLang}
            className={code === pickLang ? 'on' : ''}
            lang={code}
            onClick={() => setPickLang(code)}
          >
            {LANG_NAMES[code]}
          </button>
        ))}
      </div>
      <div className="level-list" lang={pickLang}>
        {LEVELS.map((level) => {
          const s = stats[level];
          return (
            <button key={level} className="level-btn" onClick={() => start(level, pickLang)}>
              <span>{LEVEL_NAMES[pickLang][level]}</span>
              <small>
                {STRINGS[pickLang].levelNotes[level]}
                {s.best !== null && ` · ${STRINGS[pickLang].best(formatTime(s.best))}`}
              </small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );

  if (!state) {
    return (
      <div className="screen wordsearch" lang={lang}>
        <GameHeader title={t.title} onExit={onExit} />
        {picker}
      </div>
    );
  }

  const { size } = state;
  const centre = (cell: number) => ({ x: (cell % size) + 0.5, y: Math.floor(cell / size) + 0.5 });
  const bar = (cells: number[], className: string, key: string | number) => {
    const a = centre(cells[0]);
    const b = centre(cells[cells.length - 1]);
    return <line key={key} className={className} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };
  /** Which colour each found word got: the order it was found in. */
  const colourOf = (wordIndex: number) => state.found.indexOf(wordIndex) % COLOURS;
  const levelName = LEVEL_NAMES[state.lang][state.level];

  return (
    <div className="screen wordsearch" lang={lang}>
      <GameHeader title={t.title} onExit={onExit}>
        <span className="timer" aria-label={formatTime(state.elapsed)}>
          {formatTime(state.elapsed)}
        </span>
      </GameHeader>

      <div className="status">
        <span>{levelName}</span>
        <span role="status">{t.found(state.found.length, state.words.length)}</span>
      </div>

      <div className="ws-wrap">
        <div
          className="ws-grid"
          ref={grid}
          style={{ '--n': size } as CSSProperties}
          role="img"
          aria-label={t.gridLabel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPress(e, false)}
          onPointerCancel={(e) => endPress(e, true)}
        >
          <svg className="ws-marks" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            {state.found.map((wordIndex, order) => bar(state.words[wordIndex].cells, `ws-bar c${order % COLOURS}`, wordIndex))}
            {anchor !== null && bar([anchor], 'ws-bar anchor', 'anchor')}
            {missed && bar(missed, 'ws-bar missed', 'missed')}
            {selection && bar(selection, 'ws-bar selecting', 'selecting')}
          </svg>
          {state.grid.map((letter, i) => (
            <span key={i} className={i === hintCell ? 'ws-letter hinted' : 'ws-letter'}>
              {letter}
            </span>
          ))}
        </div>
      </div>

      {state.found.length === 0 && <p className="ws-howto">{t.howTo}</p>}

      <ul className="ws-words">
        {state.words.map((w, i) => {
          const found = state.found.includes(i);
          return (
            <li key={w.answer} className={found ? `found c${colourOf(i)}` : ''}>
              {w.display}
            </li>
          );
        })}
      </ul>

      <div className="tools">
        <button onClick={showHint} disabled={state.done}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2z" />
          </svg>
          {t.hint}
        </button>
        <button
          onClick={() => {
            setPickLang(loadLang());
            setPicking(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t.newGame}
        </button>
      </div>

      {state.done && winOpen && !picking && (
        <Sheet title={t.allFound} onClose={() => setWinOpen(false)}>
          <p className="sheet-text">
            {t.solvedIn(levelName, formatTime(state.elapsed))}
            {newBest && ` — ${t.newBest}`}
          </p>
          <button
            className="primary-btn"
            onClick={() => {
              setPickLang(loadLang());
              setPicking(true);
            }}
          >
            {t.newGame}
          </button>
          <button className="ghost-btn" onClick={onExit}>
            {t.home}
          </button>
        </Sheet>
      )}

      {picking && picker}
    </div>
  );
}
