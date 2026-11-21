import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { formatTime } from '../../shell/format';
import { GameHeader } from '../../shell/GameHeader';
import { Sheet } from '../../shell/Sheet';
import { useHaptics } from '../../shell/settings';
import { load, save } from '../../shell/storage';
import type { GameProps } from '../registry';
import {
  MARK_REVEALED,
  MARK_WRONG,
  buildPuzzle,
  currentEntry,
  isEntryFull,
  isFull,
  newState,
  puzzleName,
  reducer,
  type CrosswordAction,
  type CrosswordState,
  type Puzzle,
  type PuzzleData,
} from './logic';
import puzzlesJson from './puzzles.json';
import { CURRENT_KEY, PROGRESS_KEY, type Progress, type SavedPuzzle } from './save';
import './crossword.css';

const PUZZLES = (puzzlesJson as PuzzleData[]).map(buildPuzzle);
const BY_ID = new Map(PUZZLES.map((p) => [p.id, p]));

const LEVELS = [
  { key: 's', label: 'Small', grid: '5 × 5' },
  { key: 'm', label: 'Medium', grid: '7 × 7' },
  { key: 'l', label: 'Large', grid: '9 × 9' },
];

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function toSaved(s: CrosswordState): SavedPuzzle {
  return {
    letters: s.letters.map((l) => l || '.').join(''),
    marks: s.marks.join(''),
    elapsed: s.elapsed,
    helped: s.helped,
    done: s.done,
  };
}

/** Rebuild play state from storage, starting afresh if the saved data doesn't fit the puzzle. */
function fromSaved(p: Puzzle, saved: SavedPuzzle | undefined): CrosswordState {
  const fresh = newState(p);
  const cells = p.solution.length;
  if (!saved || saved.letters?.length !== cells || saved.marks?.length !== cells) return fresh;
  return {
    ...fresh,
    letters: [...saved.letters].map((ch, i) => (ch === '.' || p.solution[i] === '' ? '' : ch)),
    marks: [...saved.marks].map(Number),
    elapsed: saved.elapsed ?? 0,
    helped: Boolean(saved.helped),
    done: Boolean(saved.done),
  };
}

type Action = CrosswordAction | { type: 'open'; state: CrosswordState } | { type: 'close' };

function rootReducer(s: CrosswordState | null, a: Action): CrosswordState | null {
  if (a.type === 'open') return a.state;
  if (a.type === 'close') return null;
  const puzzle = s && BY_ID.get(s.puzzleId);
  return s && puzzle ? reducer(puzzle, s, a) : s;
}

/** Carry on with the puzzle that was open last time, unless it is finished. */
function initialState(): CrosswordState | null {
  const id = load<string | null>(CURRENT_KEY, null);
  const puzzle = id ? BY_ID.get(id) : undefined;
  const saved = id ? load<Progress>(PROGRESS_KEY, {})[id] : undefined;
  return puzzle && saved && !saved.done ? fromSaved(puzzle, saved) : null;
}

interface CellProps {
  index: number;
  letter: string;
  number: number;
  selected: boolean;
  inWord: boolean;
  mark: number;
  onSelect: (index: number) => void;
}

const Cell = memo(function Cell(p: CellProps) {
  const cls = ['cw-cell'];
  if (p.inWord) cls.push('in-word');
  if (p.selected) cls.push('selected');
  if (p.mark === MARK_WRONG) cls.push('wrong');
  if (p.mark === MARK_REVEALED) cls.push('revealed');
  return (
    <button className={cls.join(' ')} onClick={() => p.onSelect(p.index)} aria-label={p.letter || 'Empty square'}>
      {p.number > 0 && <span className="cw-num">{p.number}</span>}
      {p.letter}
    </button>
  );
});

export default function Crossword({ onExit }: GameProps) {
  const buzz = useHaptics();
  const [state, dispatch] = useReducer(rootReducer, null, initialState);
  const [progress, setProgress] = useState<Progress>(() => load(PROGRESS_KEY, {}));
  const [sheet, setSheet] = useState<'none' | 'clues' | 'help' | 'won'>('none');

  const puzzle = state ? BY_ID.get(state.puzzleId)! : null;

  const latest = useRef(state);
  latest.current = state;
  const latestProgress = useRef(progress);
  latestProgress.current = progress;

  // ---------- Saving ----------

  const persist = useCallback((show: boolean) => {
    const s = latest.current;
    if (!s) return;
    const next = { ...latestProgress.current, [s.puzzleId]: toSaved(s) };
    latestProgress.current = next;
    save(PROGRESS_KEY, next);
    if (show) setProgress(next);
  }, []);

  useEffect(() => persist(true), [persist, state?.letters, state?.marks, state?.puzzleId]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) persist(false);
    };
    const onLeave = () => persist(false);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      persist(false);
    };
  }, [persist]);

  // ---------- Opening and closing puzzles ----------

  const open = useCallback(
    (id: string) => {
      const p = BY_ID.get(id);
      if (!p) return;
      persist(true);
      save(CURRENT_KEY, id);
      dispatch({ type: 'open', state: fromSaved(p, latestProgress.current[id]) });
      setSheet('none');
    },
    [persist],
  );

  const showList = useCallback(() => {
    persist(true);
    dispatch({ type: 'close' });
    setSheet('none');
  }, [persist]);

  // ---------- Clock ----------

  const running = Boolean(state) && !state!.done && sheet === 'none';
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: 'tick', seconds: 1 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Celebrate when a puzzle is finished now, not when a finished one is reopened.
  const seen = useRef({ id: state?.puzzleId, done: state?.done });
  useEffect(() => {
    const before = seen.current;
    seen.current = { id: state?.puzzleId, done: state?.done };
    if (state?.done && before.id === state.puzzleId && !before.done) {
      buzz([30, 60, 30, 60, 80]);
      setSheet('won');
    }
  }, [state?.done, state?.puzzleId, buzz]);

  // ---------- Input ----------

  const select = useCallback((cell: number) => dispatch({ type: 'select', cell }), []);
  const typeLetter = useCallback(
    (letter: string) => {
      buzz(6);
      dispatch({ type: 'letter', letter });
    },
    [buzz],
  );

  const playing = Boolean(state) && sheet === 'none';
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toUpperCase());
      else if (e.key === 'Backspace') dispatch({ type: 'backspace' });
      else if (e.key === 'Tab') dispatch({ type: 'step', delta: e.shiftKey ? -1 : 1 });
      else if (e.key === 'Enter' || e.key === ' ') dispatch({ type: 'toggleDir' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, typeLetter]);

  const nextPuzzle = useMemo(() => {
    if (!state) return null;
    const open = (p: Puzzle) => p.id !== state.puzzleId && !progress[p.id]?.done;
    const at = PUZZLES.findIndex((p) => p.id === state.puzzleId);
    return [...PUZZLES.slice(at + 1), ...PUZZLES.slice(0, at)].find(open) ?? null;
  }, [state, progress]);

  // ---------- Puzzle list ----------

  if (!state || !puzzle) {
    return (
      <div className="screen crossword">
        <GameHeader title="Crosswords" onExit={onExit} />
        <div className="cw-list">
          {LEVELS.map((level) => {
            const set = PUZZLES.filter((p) => p.id[0] === level.key);
            const solved = set.filter((p) => progress[p.id]?.done).length;
            return (
              <section key={level.key}>
                <h2>
                  {level.label}
                  <small>
                    {level.grid} · {solved} of {set.length} solved
                  </small>
                </h2>
                <div className="cw-tiles">
                  {set.map((p) => {
                    const saved = progress[p.id];
                    const started = saved && /[A-Z]/.test(saved.letters);
                    const status = saved?.done ? 'solved' : started ? 'started' : 'new';
                    const number = Number(p.id.slice(1));
                    return (
                      <button
                        key={p.id}
                        className={`cw-tile ${status}`}
                        onClick={() => open(p.id)}
                        aria-label={`${level.label} ${number}, ${status === 'new' ? 'not started' : status}`}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Play ----------

  const entry = currentEntry(puzzle, state);
  const full = !state.done && isFull(puzzle, state);
  const across = puzzle.entries.filter((e) => e.dir === 'across');
  const down = puzzle.entries.filter((e) => e.dir === 'down');
  const help = (action: CrosswordAction) => {
    dispatch(action);
    setSheet('none');
  };

  return (
    <div className="screen crossword">
      <GameHeader title={puzzleName(puzzle.id)} onExit={onExit}>
        <span className="timer" aria-label={`Time ${formatTime(state.elapsed)}`}>
          {formatTime(state.elapsed)}
        </span>
      </GameHeader>

      <div className="status">
        <button className="link-btn" onClick={showList}>
          All puzzles
        </button>
        <span className="status-note" />
        <button className="link-btn" onClick={() => setSheet('clues')}>
          Clues
        </button>
        <button className="link-btn" onClick={() => setSheet('help')} disabled={state.done}>
          Help
        </button>
      </div>

      <div className="cw-wrap">
        <div
          className={`cw-grid${state.done ? ' is-done' : ''}`}
          style={{ '--n': puzzle.size } as CSSProperties}
          role="grid"
          aria-label="Crossword grid"
        >
          {puzzle.solution.map((answer, i) =>
            answer === '' ? (
              <div key={i} className="cw-block" />
            ) : (
              <Cell
                key={i}
                index={i}
                letter={state.letters[i]}
                number={puzzle.numbers[i]}
                selected={i === state.cell && !state.done}
                inWord={!state.done && entry.cells.includes(i)}
                mark={state.marks[i]}
                onSelect={select}
              />
            ),
          )}
        </div>
      </div>

      {full && (
        <p className="cw-banner" role="status">
          Every square is filled, but something is wrong. Try Help.
        </p>
      )}

      <div className="cw-clue">
        <button className="icon-btn" onClick={() => dispatch({ type: 'step', delta: -1 })} aria-label="Previous clue">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 6l-6 6 6 6" />
          </svg>
        </button>
        <button className="cw-clue-text" onClick={() => dispatch({ type: 'toggleDir' })}>
          <small>
            {entry.n} {entry.dir === 'across' ? 'Across' : 'Down'} · {entry.answer.length} letters
          </small>
          {entry.clue}
        </button>
        <button className="icon-btn" onClick={() => dispatch({ type: 'step', delta: 1 })} aria-label="Next clue">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="kb" aria-label="Keyboard">
        {KEY_ROWS.map((row, r) => (
          <div className="kb-row" key={row}>
            {[...row].map((letter) => (
              <button key={letter} onClick={() => typeLetter(letter)} disabled={state.done}>
                {letter}
              </button>
            ))}
            {r === 2 && (
              <button
                className="kb-wide"
                onClick={() => dispatch({ type: 'backspace' })}
                disabled={state.done}
                aria-label="Delete"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5-6zM12 10l4 4M16 10l-4 4" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {sheet === 'clues' && (
        <Sheet title="Clues" onClose={() => setSheet('none')}>
          {[
            { title: 'Across', list: across },
            { title: 'Down', list: down },
          ].map((group) => (
            <section key={group.title} className="cw-clues">
              <h3>{group.title}</h3>
              {group.list.map((e) => (
                <button
                  key={e.index}
                  className={`${e.index === entry.index ? 'current' : ''}${isEntryFull(state, e) ? ' filled' : ''}`}
                  onClick={() => help({ type: 'goto', entry: e.index })}
                >
                  <b>{e.n}</b>
                  <span>
                    {e.clue} <small>({e.answer.length})</small>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </Sheet>
      )}

      {sheet === 'help' && (
        <Sheet title="Help" onClose={() => setSheet('none')}>
          <div className="level-list">
            <button className="level-btn" onClick={() => help({ type: 'check' })}>
              <span>Check puzzle</span>
              <small>Marks wrong letters</small>
            </button>
            <button className="level-btn" onClick={() => help({ type: 'reveal', what: 'letter' })}>
              <span>Reveal letter</span>
              <small>The selected square</small>
            </button>
            <button className="level-btn" onClick={() => help({ type: 'reveal', what: 'word' })}>
              <span>Reveal word</span>
              <small>
                {entry.n} {entry.dir === 'across' ? 'Across' : 'Down'}
              </small>
            </button>
            <button className="level-btn" onClick={() => help({ type: 'clear' })}>
              <span>Clear puzzle</span>
              <small>Start again</small>
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'won' && (
        <Sheet title="Solved!" onClose={() => setSheet('none')}>
          <p className="sheet-text">
            {puzzleName(puzzle.id)} in {formatTime(state.elapsed)}
            {state.helped && ' · with help'}
          </p>
          {nextPuzzle && (
            <button className="primary-btn" onClick={() => open(nextPuzzle.id)}>
              Next: {puzzleName(nextPuzzle.id)}
            </button>
          )}
          <button className="ghost-btn" onClick={showList}>
            All puzzles
          </button>
        </Sheet>
      )}
    </div>
  );
}
