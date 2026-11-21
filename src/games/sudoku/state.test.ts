import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './logic';
import { formatTime } from '../../shell/format';
import { digitCounts, newGame, reducer, type SudokuState } from './state';

const fresh = () => newGame(generatePuzzle('easy', 42));
const firstEmpty = (s: SudokuState) => s.values.findIndex((d) => d === 0);
const wrongDigit = (s: SudokuState, cell: number) => (s.solution[cell] % 9) + 1;

describe('sudoku moves', () => {
  it('places a digit in the selected empty cell', () => {
    let s = fresh();
    const cell = firstEmpty(s);
    s = reducer(s, { type: 'select', cell });
    s = reducer(s, { type: 'digit', digit: s.solution[cell] });
    expect(s.values[cell]).toBe(s.solution[cell]);
    expect(s.mistakes).toBe(0);
  });

  it('never changes a given clue', () => {
    let s = fresh();
    const given = s.puzzle.findIndex((d) => d !== 0);
    s = reducer(s, { type: 'select', cell: given });
    const after = reducer(reducer(s, { type: 'digit', digit: wrongDigit(s, given) }), { type: 'erase' });
    expect(after.values[given]).toBe(s.puzzle[given]);
  });

  it('counts a wrong digit as a mistake and lets undo take it back', () => {
    let s = fresh();
    const cell = firstEmpty(s);
    s = reducer(s, { type: 'select', cell });
    s = reducer(s, { type: 'digit', digit: wrongDigit(s, cell) });
    expect(s.mistakes).toBe(1);
    s = reducer(s, { type: 'undo' });
    expect(s.values[cell]).toBe(0);
  });

  it('toggles pencil marks in notes mode and clears them when a peer is filled', () => {
    let s = fresh();
    const cell = firstEmpty(s);
    const digit = s.solution[cell];
    // Another empty cell in the same row.
    const row = Math.floor(cell / 9);
    const peer = s.values.findIndex((d, i) => d === 0 && i !== cell && Math.floor(i / 9) === row);
    s = reducer(s, { type: 'toggleNotes' });
    s = reducer(s, { type: 'select', cell: peer });
    s = reducer(s, { type: 'digit', digit });
    expect(s.notes[peer]).toBe(1 << (digit - 1));
    expect(s.values[peer]).toBe(0);
    s = reducer(s, { type: 'toggleNotes' });
    s = reducer(s, { type: 'select', cell });
    s = reducer(s, { type: 'digit', digit });
    expect(s.notes[peer]).toBe(0);
  });

  it('a hint fills a correct digit and counts it', () => {
    let s = fresh();
    s = reducer(s, { type: 'hint' });
    expect(s.hints).toBe(1);
    expect(s.selected).not.toBeNull();
    expect(s.values[s.selected!]).toBe(s.solution[s.selected!]);
  });

  it('finishes when the last cell is filled correctly, then ignores further input', () => {
    let s = fresh();
    for (let i = 0; i < 81; i++) {
      if (s.values[i]) continue;
      s = reducer(s, { type: 'select', cell: i });
      s = reducer(s, { type: 'digit', digit: s.solution[i] });
    }
    expect(s.done).toBe(true);
    const frozen = reducer(reducer(s, { type: 'erase' }), { type: 'tick', seconds: 5 });
    expect(frozen.values).toEqual(s.values);
    expect(frozen.elapsed).toBe(s.elapsed);
  });

  it('moves the selection with arrow steps and stays on the board', () => {
    let s = reducer(fresh(), { type: 'select', cell: 0 });
    s = reducer(s, { type: 'move', dx: -1, dy: -1 });
    expect(s.selected).toBe(0);
    s = reducer(s, { type: 'move', dx: 1, dy: 1 });
    expect(s.selected).toBe(10);
  });
});

describe('helpers', () => {
  it('counts digits on the board', () => {
    const s = fresh();
    const counts = digitCounts(s.solution);
    expect(counts.slice(1)).toEqual(new Array(9).fill(9));
  });

  it('formats times', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});
