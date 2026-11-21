// Builds src/games/crossword/puzzles.json from scripts/crossword-words.txt.
//
// Grids are lattice style: words run along every other row and column, so each
// word crosses others at alternate letters. That keeps good fills possible with
// a modest, hand-written word list. Output is deterministic: same words, same puzzles.
//
// Run with: npm run crosswords

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WORDS_FILE = fileURLToPath(new URL('./crossword-words.txt', import.meta.url));
const OUT_FILE = fileURLToPath(new URL('../src/games/crossword/puzzles.json', import.meta.url));

const LEVELS = [
  { key: 's', size: 5, count: 20, extraBlocks: [0, 1], minEntries: 4, sameShape: 7 },
  { key: 'm', size: 7, count: 20, extraBlocks: [2, 5], minEntries: 8, sameShape: 2 },
  { key: 'l', size: 9, count: 20, extraBlocks: [5, 10], minEntries: 14, sameShape: 1 },
];
const MIN_LEN = 3;
const MAX_LEN = 7;
/** No answer appears in more than this many puzzles. */
const MAX_USES = 3;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Word list ----------

function readWords() {
  const clues = new Map();
  for (const raw of readFileSync(WORDS_FILE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const bar = line.indexOf('|');
    const word = line.slice(0, bar);
    const clue = line.slice(bar + 1).trim();
    if (bar < 0 || !/^[A-Z]+$/.test(word) || word.length < MIN_LEN || word.length > MAX_LEN || !clue) {
      throw new Error(`Bad line in word list: ${line}`);
    }
    if (clues.has(word)) throw new Error(`Duplicate word: ${word}`);
    if (clue.toUpperCase().includes(word)) throw new Error(`Clue gives away its answer: ${line}`);
    clues.set(word, clue);
  }
  return clues;
}

// ---------- Grid shapes ----------

/** A random symmetric lattice shape: true marks a white cell. */
function randomShape(size, extraPairs, rng) {
  const white = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) white.push(!(r % 2 === 1 && c % 2 === 1));
  }
  for (let k = 0; k < extraPairs; k++) {
    const i = Math.floor(rng() * size * size);
    white[i] = false;
    white[size * size - 1 - i] = false;
  }
  return white;
}

/** Runs of two or more white cells in a row or column. */
function findEntries(white, size) {
  const entries = [];
  const scan = (dir) => {
    for (let a = 0; a < size; a++) {
      let run = [];
      for (let b = 0; b <= size; b++) {
        const i = dir === 'across' ? a * size + b : b * size + a;
        if (b < size && white[i]) {
          run.push(i);
        } else {
          if (run.length >= 2) entries.push({ dir, cells: run });
          run = [];
        }
      }
    }
  };
  scan('across');
  scan('down');
  return entries;
}

function isUsableShape(white, size, minEntries) {
  const entries = findEntries(white, size);
  if (entries.length < minEntries) return null;
  if (entries.some((e) => e.cells.length < MIN_LEN || e.cells.length > MAX_LEN)) return null;

  const uses = new Array(size * size).fill(0);
  for (const e of entries) for (const i of e.cells) uses[i]++;
  // Every white cell belongs to a word, and every word crosses enough others to be gettable.
  if (white.some((w, i) => w && uses[i] === 0)) return null;
  for (const e of entries) {
    const crossings = e.cells.filter((i) => uses[i] === 2).length;
    if (crossings < (e.cells.length >= 4 ? 2 : 1)) return null;
  }
  if (!entries.some((e) => e.dir === 'across') || !entries.some((e) => e.dir === 'down')) return null;

  // All the white cells form one connected piece.
  const start = white.indexOf(true);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.pop();
    const r = Math.floor(i / size);
    const c = i % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const j = nr * size + nc;
      if (white[j] && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  if (seen.size !== white.filter(Boolean).length) return null;
  return entries;
}

// ---------- Filling ----------

/** Put a word in every entry so that crossings agree, favouring words used least so far. */
function fill(entries, size, byLength, usage, rng) {
  const letters = new Array(size * size).fill('');
  const chosen = new Array(entries.length).fill(null);
  const used = new Set();
  let budget = 30000;

  const candidates = (e) =>
    byLength[e.cells.length].filter(
      (w) => !used.has(w) && (usage.get(w) ?? 0) < MAX_USES && e.cells.every((cell, k) => !letters[cell] || letters[cell] === w[k]),
    );

  const step = () => {
    if (--budget < 0) return false;
    let best = -1;
    let bestOptions = null;
    for (let i = 0; i < entries.length; i++) {
      if (chosen[i]) continue;
      const options = candidates(entries[i]);
      if (options.length === 0) return false;
      if (!bestOptions || options.length < bestOptions.length) {
        best = i;
        bestOptions = options;
      }
    }
    if (best < 0) return true;
    const ranked = bestOptions
      .map((w) => ({ w, score: (usage.get(w) ?? 0) + rng() * 0.9 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 25);
    const e = entries[best];
    for (const { w } of ranked) {
      const placed = [];
      e.cells.forEach((cell, k) => {
        if (!letters[cell]) {
          letters[cell] = w[k];
          placed.push(cell);
        }
      });
      chosen[best] = w;
      used.add(w);
      if (step()) return true;
      chosen[best] = null;
      used.delete(w);
      for (const cell of placed) letters[cell] = '';
    }
    return false;
  };

  return step() ? { letters, chosen } : null;
}

// ---------- Assembly ----------

function assemble(id, size, white, entries, filled, clues) {
  const rows = [];
  for (let r = 0; r < size; r++) {
    let row = '';
    for (let c = 0; c < size; c++) row += white[r * size + c] ? filled.letters[r * size + c] : '#';
    rows.push(row);
  }
  // Number the cells that start a word, reading left to right, top to bottom.
  const starts = new Map();
  entries.forEach((e, i) => {
    if (!starts.has(e.cells[0])) starts.set(e.cells[0], []);
    starts.get(e.cells[0]).push(i);
  });
  const numbered = [];
  let n = 0;
  for (const cell of [...starts.keys()].sort((a, b) => a - b)) {
    n++;
    for (const i of starts.get(cell)) {
      const e = entries[i];
      const answer = filled.chosen[i];
      numbered.push({
        n,
        dir: e.dir,
        row: Math.floor(cell / size),
        col: cell % size,
        answer,
        clue: clues.get(answer),
      });
    }
  }
  numbered.sort((a, b) => (a.dir === b.dir ? a.n - b.n : a.dir === 'across' ? -1 : 1));
  return { id, size, rows, entries: numbered };
}

function main() {
  const clues = readWords();
  const byLength = {};
  for (const w of clues.keys()) (byLength[w.length] ??= []).push(w);
  const usage = new Map();
  const rng = mulberry32(20261121);
  const puzzles = [];

  for (const level of LEVELS) {
    const shapeUses = new Map();
    let made = 0;
    for (let attempt = 0; made < level.count; attempt++) {
      if (attempt > 200000) throw new Error(`Could not build enough ${level.size}x${level.size} puzzles`);
      const [lo, hi] = level.extraBlocks;
      const white = randomShape(level.size, lo + Math.floor(rng() * (hi - lo + 1)), rng);
      const entries = isUsableShape(white, level.size, level.minEntries);
      if (!entries) continue;
      const shapeKey = white.map((w) => (w ? '.' : '#')).join('');
      if ((shapeUses.get(shapeKey) ?? 0) >= level.sameShape) continue;
      const filled = fill(entries, level.size, byLength, usage, rng);
      if (!filled) continue;
      shapeUses.set(shapeKey, (shapeUses.get(shapeKey) ?? 0) + 1);
      for (const w of filled.chosen) usage.set(w, (usage.get(w) ?? 0) + 1);
      made++;
      const id = `${level.key}${String(made).padStart(2, '0')}`;
      puzzles.push(assemble(id, level.size, white, entries, filled, clues));
    }
  }

  writeFileSync(OUT_FILE, JSON.stringify(puzzles) + '\n');
  const counts = [...usage.values()];
  console.log(
    `Wrote ${puzzles.length} puzzles using ${usage.size} of ${clues.size} words; ` +
      `most repeated word appears ${Math.max(...counts)} times.`,
  );
  for (const level of LEVELS) {
    const set = puzzles.filter((p) => p.size === level.size);
    const words = set.map((p) => p.entries.length);
    console.log(`  ${level.size}x${level.size}: ${set.length} puzzles, ${Math.min(...words)}-${Math.max(...words)} words each`);
  }
}

main();
