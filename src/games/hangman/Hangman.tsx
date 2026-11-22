import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { GameHeader } from '../../shell/GameHeader';
import { Sheet } from '../../shell/Sheet';
import { useHaptics } from '../../shell/settings';
import { load, save } from '../../shell/storage';
import type { GameProps } from '../registry';
import { KEY_ROWS, LANGS, LANG_NAMES, loadLang, plain, saveLang, toGridLetter, type Lang } from '../words/lang';
import { wordsFor } from '../words/list';
import {
  MAX_MISSES,
  emptyStats,
  isHit,
  newRound,
  pickWord,
  recordRound,
  reducer,
  revealed,
  type HangmanAction,
  type HangmanState,
  type HangmanStats,
} from './logic';
import { GAME_KEY, STATS_KEY } from './save';
import { STRINGS } from './strings';
import './hangman.css';

const loadStats = (): HangmanStats => {
  const saved = { ...emptyStats(), ...load<Partial<HangmanStats>>(STATS_KEY, {}) };
  return { ...saved, recent: Array.isArray(saved.recent) ? saved.recent : [] };
};

function freshRound(lang: Lang, recent: string[]): HangmanState {
  return newRound(lang, pickWord(wordsFor(lang), recent, Math.random));
}

/** Carry on with the saved round if it is sound, otherwise start a new one. */
function initialRound(): HangmanState {
  const g = load<HangmanState | null>(GAME_KEY, null);
  const ok =
    g &&
    LANGS.includes(g.lang) &&
    typeof g.display === 'string' &&
    g.display.length > 0 &&
    typeof g.clue === 'string' &&
    Array.isArray(g.guessed) &&
    ['playing', 'won', 'lost'].includes(g.status);
  const lang = loadLang();
  if (!ok) return freshRound(lang, loadStats().recent);
  // A round that is under way is kept as it is. Otherwise follow the language chosen
  // since, here or in another word game.
  const underWay = g.status === 'playing' && g.guessed.length > 0;
  return underWay || g.lang === lang ? g : freshRound(lang, loadStats().recent);
}

type Action = HangmanAction | { type: 'load'; state: HangmanState };

function rootReducer(s: HangmanState, a: Action): HangmanState {
  return a.type === 'load' ? a.state : reducer(s, a);
}

/** A flower that loses a petal for every wrong letter. */
function Flower({ misses, status, label }: { misses: number; status: HangmanState['status']; label: string }) {
  return (
    <svg className={`hm-flower is-${status}`} viewBox="0 0 200 250" role="img" aria-label={label}>
      <path className="hm-stem" d="M100 118c-3 40 4 80 0 126" />
      <path className="hm-leaf" d="M99 188c-26-4-40-20-44-40 24 2 40 14 44 40z" />
      <path className="hm-leaf" d="M100 214c24-2 38-16 42-34-22 0-38 12-42 34z" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`rotate(${i * 60} 100 90)`}>
          <ellipse className="hm-petal-ghost" cx="100" cy="46" rx="21" ry="34" />
          <ellipse className={`hm-petal${i < misses ? ' gone' : ''}`} cx="100" cy="46" rx="21" ry="34" />
        </g>
      ))}
      <circle className="hm-heart" cx="100" cy="90" r="24" />
    </svg>
  );
}

export default function Hangman({ onExit }: GameProps) {
  const buzz = useHaptics();
  const [state, dispatch] = useReducer(rootReducer, null, initialRound);
  const [stats, setStats] = useState(loadStats);
  const [sheet, setSheet] = useState<'none' | 'end' | 'language'>('none');

  const t = STRINGS[state.lang];
  const latestStats = useRef(stats);
  latestStats.current = stats;

  useEffect(() => save(GAME_KEY, state), [state]);

  const keepStats = (next: HangmanStats) => {
    latestStats.current = next;
    save(STATS_KEY, next);
    setStats(next);
  };

  // Count a round when it ends now, not when a finished one is reopened.
  const seen = useRef({ word: state.display, status: state.status });
  useEffect(() => {
    const before = seen.current;
    seen.current = { word: state.display, status: state.status };
    if (state.status === 'playing' || before.word !== state.display || before.status !== 'playing') return;
    const won = state.status === 'won';
    buzz(won ? [30, 60, 30, 60, 80] : [60, 80, 60]);
    keepStats(recordRound(latestStats.current, state, won));
    setSheet('end');
    // keepStats only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, buzz]);

  /** Start another word. Leaving a word half-guessed counts as not getting it. */
  const next = useCallback(
    (lang: Lang) => {
      let current = latestStats.current;
      if (state.status === 'playing' && state.guessed.length > 0) {
        current = recordRound(current, state, false);
        keepStats(current);
      }
      saveLang(lang);
      dispatch({ type: 'load', state: freshRound(lang, [...current.recent, plain(state.display)]) });
      setSheet('none');
    },
    // keepStats only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  );

  const guess = useCallback(
    (letter: string) => {
      buzz(8);
      dispatch({ type: 'guess', letter });
    },
    [buzz],
  );

  const playing = state.status === 'playing' && sheet === 'none';
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const letter = toGridLetter(e.key, state.lang);
      if (!letter) return;
      guess(letter);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, guess, state.lang]);

  const letters = revealed(state);
  const answer = [...plain(state.display)];
  const over = state.status !== 'playing';

  return (
    <div className="screen hangman" lang={state.lang}>
      <GameHeader title={t.title} onExit={onExit} />

      <div className="status">
        <span role="status">{t.misses(state.misses, MAX_MISSES)}</span>
        <span>{t.streak(stats.streak)}</span>
        <button className="link-btn" onClick={() => setSheet('language')} aria-label={t.language}>
          {LANG_NAMES[state.lang]}
        </button>
      </div>

      <div className="hm-stage">
        <Flower misses={state.misses} status={state.status} label={t.flower(MAX_MISSES - state.misses)} />
      </div>

      <div className="hm-word" aria-label={letters.map((l) => l || '_').join(' ')}>
        {letters.map((letter, i) => (
          <span key={i} className={over && !state.guessed.includes(answer[i]) ? 'missed' : ''}>
            {letter}
          </span>
        ))}
      </div>

      <p className="hm-clue">{state.clueShown || over ? state.clue : ''}</p>

      <div className="tools">
        <button onClick={() => dispatch({ type: 'showClue' })} disabled={state.clueShown || over}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2z" />
          </svg>
          {t.clue}
        </button>
        <button onClick={() => next(state.lang)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {over ? t.nextWord : t.newWord}
        </button>
      </div>

      <div className="hm-kb" aria-label={t.keyboard}>
        {KEY_ROWS[state.lang].map((row) => (
          <div className="hm-kb-row" key={row}>
            {[...row].map((letter) => {
              const used = state.guessed.includes(letter);
              return (
                <button
                  key={letter}
                  className={used ? (isHit(state, letter) ? 'hit' : 'miss') : ''}
                  onClick={() => guess(letter)}
                  disabled={used || over}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {sheet === 'end' && (
        <Sheet title={state.status === 'won' ? t.won : t.lost} onClose={() => setSheet('none')}>
          <p className="hm-answer">
            {state.status === 'lost' && <small>{t.wordWas}</small>}
            <strong>{state.display}</strong>
            <span>{state.clue}</span>
          </p>
          <p className="sheet-text">
            {t.guessed(stats.won, stats.played)}
            {stats.best > 1 && ` · ${t.bestStreak(stats.best)}`}
          </p>
          <button className="primary-btn" onClick={() => next(state.lang)}>
            {t.nextWord}
          </button>
          <button className="ghost-btn" onClick={onExit}>
            {t.home}
          </button>
        </Sheet>
      )}

      {sheet === 'language' && (
        <Sheet title={t.language} onClose={() => setSheet('none')}>
          <div className="level-list">
            {LANGS.map((code) => (
              <button
                key={code}
                className={`level-btn${code === state.lang ? ' current' : ''}`}
                lang={code}
                onClick={() => (code === state.lang ? setSheet('none') : next(code))}
              >
                <span>{LANG_NAMES[code]}</span>
                <small>{STRINGS[code].title}</small>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
