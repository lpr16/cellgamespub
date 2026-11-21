import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { formatTime } from '../../shell/format';
import { GameHeader } from '../../shell/GameHeader';
import { randomSeed } from '../../shell/random';
import { Sheet } from '../../shell/Sheet';
import { useHaptics, useSettings } from '../../shell/settings';
import { load, remove, save } from '../../shell/storage';
import type { GameProps } from '../registry';
import { DIFFICULTIES, PEERS, findConflicts, generatePuzzle, type Difficulty } from './logic';
import { DIFFICULTY_LABELS, GAME_KEY, STATS_KEY } from './save';
import { digitCounts, isGiven, newGame, reducer, type SudokuAction, type SudokuState } from './state';
import './sudoku.css';

type Stats = Record<Difficulty, { started: number; won: number; best: number | null }>;

const emptyStats = (): Stats =>
  Object.fromEntries(DIFFICULTIES.map((d) => [d, { started: 0, won: 0, best: null }])) as Stats;

const loadStats = (): Stats => ({ ...emptyStats(), ...load<Partial<Stats>>(STATS_KEY, {}) });

/** A saved game is only trusted if it has the shape this version writes. */
function loadGame(): SudokuState | null {
  const g = load<SudokuState | null>(GAME_KEY, null);
  const ok =
    g &&
    !g.done &&
    [g.puzzle, g.solution, g.values, g.notes].every((a) => Array.isArray(a) && a.length === 81) &&
    DIFFICULTIES.includes(g.difficulty);
  return ok ? { ...g, history: g.history ?? [], selected: null } : null;
}

type Action = SudokuAction | { type: 'load'; state: SudokuState };

function rootReducer(s: SudokuState | null, a: Action): SudokuState | null {
  if (a.type === 'load') return a.state;
  return s ? reducer(s, a) : s;
}

interface CellProps {
  index: number;
  value: number;
  notes: number;
  given: boolean;
  selected: boolean;
  peer: boolean;
  same: boolean;
  wrong: boolean;
  onSelect: (index: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const row = Math.floor(p.index / 9);
  const col = p.index % 9;
  const cls = ['cell'];
  if (p.given) cls.push('given');
  if (p.peer) cls.push('peer');
  if (p.same) cls.push('same');
  if (p.selected) cls.push('selected');
  if (p.wrong) cls.push('wrong');
  if (col % 3 === 2 && col < 8) cls.push('edge-r');
  if (row % 3 === 2 && row < 8) cls.push('edge-b');
  const label = `Row ${row + 1}, column ${col + 1}, ${p.value ? p.value : 'empty'}${p.given ? ', given' : ''}`;
  return (
    <button className={cls.join(' ')} aria-label={label} aria-pressed={p.selected} onClick={() => p.onSelect(p.index)}>
      {p.value ? (
        p.value
      ) : p.notes ? (
        <span className="notes" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <span key={d}>{p.notes & (1 << (d - 1)) ? d : ''}</span>
          ))}
        </span>
      ) : null}
    </button>
  );
});

export default function Sudoku({ onExit }: GameProps) {
  const { settings } = useSettings();
  const buzz = useHaptics();
  const [state, dispatch] = useReducer(rootReducer, null, loadGame);
  const [paused, setPaused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [newBest, setNewBest] = useState(false);
  const [winOpen, setWinOpen] = useState(false);

  // Keep the latest state reachable from timers and page-hide handlers.
  const latest = useRef(state);
  latest.current = state;

  const persist = useCallback(() => {
    const s = latest.current;
    if (s && !s.done) save(GAME_KEY, { ...s, history: s.history.slice(-60) });
  }, []);

  // Save after every move, and when the app is hidden or closed.
  useEffect(persist, [persist, state?.values, state?.notes]);
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

  const running = Boolean(state) && !state!.done && !paused && !picking;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: 'tick', seconds: 1 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback((difficulty: Difficulty) => {
    dispatch({ type: 'load', state: newGame(generatePuzzle(difficulty, randomSeed())) });
    setStats((prev) => {
      const next = { ...prev, [difficulty]: { ...prev[difficulty], started: prev[difficulty].started + 1 } };
      save(STATS_KEY, next);
      return next;
    });
    setNewBest(false);
    setWinOpen(false);
    setPicking(false);
    setPaused(false);
  }, []);

  // Record the win once, when the last digit goes in.
  const latestStats = useRef(stats);
  latestStats.current = stats;
  const done = state?.done ?? false;
  useEffect(() => {
    const s = latest.current;
    if (!done || !s) return;
    remove(GAME_KEY);
    buzz([30, 60, 30, 60, 80]);
    const prev = latestStats.current;
    const old = prev[s.difficulty];
    // Only unaided solves count towards the best time.
    const best = s.hints === 0 && (old.best === null || s.elapsed < old.best);
    const next = {
      ...prev,
      [s.difficulty]: { ...old, won: old.won + 1, best: best ? s.elapsed : old.best },
    };
    save(STATS_KEY, next);
    setStats(next);
    setNewBest(best);
    setWinOpen(true);
  }, [done, buzz]);

  const mistakes = state?.mistakes ?? 0;
  const lastMistakes = useRef(mistakes);
  useEffect(() => {
    if (mistakes > lastMistakes.current && settings.showMistakes) buzz([20, 50, 20]);
    lastMistakes.current = mistakes;
  }, [mistakes, buzz, settings.showMistakes]);

  const select = useCallback((cell: number) => dispatch({ type: 'select', cell }), []);
  const enter = useCallback(
    (digit: number) => {
      buzz(8);
      dispatch({ type: 'digit', digit });
    },
    [buzz],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picking || paused || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '9') enter(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') dispatch({ type: 'erase' });
      else if (e.key === 'ArrowUp') dispatch({ type: 'move', dx: 0, dy: -1 });
      else if (e.key === 'ArrowDown') dispatch({ type: 'move', dx: 0, dy: 1 });
      else if (e.key === 'ArrowLeft') dispatch({ type: 'move', dx: -1, dy: 0 });
      else if (e.key === 'ArrowRight') dispatch({ type: 'move', dx: 1, dy: 0 });
      else if (e.key === 'n' || e.key === 'N') dispatch({ type: 'toggleNotes' });
      else if (e.key === 'u' || e.key === 'U') dispatch({ type: 'undo' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enter, picking, paused]);

  const values = state?.values;
  const wrong = useMemo(() => {
    if (!state || !values) return new Set<number>();
    if (!settings.showMistakes) return findConflicts(values);
    const set = new Set<number>();
    values.forEach((d, i) => {
      if (d && d !== state.solution[i]) set.add(i);
    });
    return set;
    // The solution only changes together with the values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, settings.showMistakes]);
  const counts = useMemo(() => (values ? digitCounts(values) : []), [values]);

  const picker = (
    <DifficultySheet
      stats={stats}
      replacing={Boolean(state) && !state!.done}
      onPick={start}
      onClose={state ? () => setPicking(false) : onExit}
    />
  );

  if (!state) {
    return (
      <div className="screen sudoku">
        <GameHeader title="Sudoku" onExit={onExit} />
        {picker}
      </div>
    );
  }

  const selected = state.selected;
  const selectedValue = selected !== null ? state.values[selected] : 0;
  const peerSet = selected !== null ? PEERS[selected] : [];
  const canEdit = selected !== null && !isGiven(state, selected) && !state.done;

  return (
    <div className="screen sudoku">
      <GameHeader title="Sudoku" onExit={onExit}>
        <span className="timer" aria-label={`Time ${formatTime(state.elapsed)}`}>
          {formatTime(state.elapsed)}
        </span>
        <button
          className="icon-btn"
          onClick={() => setPaused(true)}
          disabled={state.done}
          aria-label="Pause"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6v12M15 6v12" />
          </svg>
        </button>
      </GameHeader>

      <div className="status">
        <span>{DIFFICULTY_LABELS[state.difficulty]}</span>
        {settings.showMistakes && <span>Mistakes {state.mistakes}</span>}
        <button className="link-btn" onClick={() => setPicking(true)}>
          New game
        </button>
      </div>

      <div className="board-wrap">
        <div className={`board${paused ? ' is-hidden' : ''}`} role="grid" aria-label="Sudoku board">
          {state.values.map((value, i) => (
            <Cell
              key={i}
              index={i}
              value={value}
              notes={state.notes[i]}
              given={state.puzzle[i] !== 0}
              selected={i === selected}
              peer={peerSet.includes(i)}
              same={selectedValue !== 0 && value === selectedValue && i !== selected}
              wrong={wrong.has(i)}
              onSelect={select}
            />
          ))}
        </div>
      </div>

      <div className="controls">
        <div className="tools">
          <button onClick={() => dispatch({ type: 'undo' })} disabled={state.history.length === 0 || state.done}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3" />
            </svg>
            Undo
          </button>
          <button onClick={() => dispatch({ type: 'erase' })} disabled={!canEdit}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5-6zM12 10l4 4M16 10l-4 4" />
            </svg>
            Erase
          </button>
          <button
            className={state.notesMode ? 'on' : ''}
            aria-pressed={state.notesMode}
            onClick={() => dispatch({ type: 'toggleNotes' })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3" />
            </svg>
            Notes {state.notesMode ? 'on' : 'off'}
          </button>
          <button onClick={() => dispatch({ type: 'hint' })} disabled={state.done}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2z" />
            </svg>
            Hint
          </button>
        </div>

        <div className="pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            const left = 9 - (counts[d] ?? 0);
            return (
              <button
                key={d}
                className={left <= 0 ? 'spent' : ''}
                onClick={() => enter(d)}
                disabled={!canEdit}
                aria-label={`${d}, ${Math.max(left, 0)} left`}
              >
                {d}
                <small>{Math.max(left, 0)}</small>
              </button>
            );
          })}
        </div>
      </div>

      {paused && !state.done && (
        <Sheet title="Paused" onClose={() => setPaused(false)}>
          <p className="sheet-text">
            {DIFFICULTY_LABELS[state.difficulty]} · {formatTime(state.elapsed)}
          </p>
          <button className="primary-btn" onClick={() => setPaused(false)}>
            Resume
          </button>
        </Sheet>
      )}

      {state.done && winOpen && !picking && (
        <Sheet title="Solved!" onClose={() => setWinOpen(false)}>
          <p className="sheet-text">
            {DIFFICULTY_LABELS[state.difficulty]} in {formatTime(state.elapsed)}
            {newBest && ' — a new best time'}
            {state.hints > 0 && ` · ${state.hints} ${state.hints === 1 ? 'hint' : 'hints'}`}
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

function DifficultySheet(props: {
  stats: Stats;
  replacing: boolean;
  onPick: (d: Difficulty) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="New game" onClose={props.onClose}>
      {props.replacing && <p className="sheet-text">This replaces the game in progress.</p>}
      <div className="level-list">
        {DIFFICULTIES.map((d) => {
          const s = props.stats[d];
          return (
            <button key={d} className="level-btn" onClick={() => props.onPick(d)}>
              <span>{DIFFICULTY_LABELS[d]}</span>
              <small>
                {s.won > 0 ? `${s.won} solved` : 'Not solved yet'}
                {s.best !== null && ` · best ${formatTime(s.best)}`}
              </small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
