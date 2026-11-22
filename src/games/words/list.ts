// The word lists the word games draw from: every answer and clue written for the
// crosswords, with accents. Built by scripts/build-crosswords.mjs.
import { plain, type Lang } from './lang';
import wordsEn from './words.en.json';
import wordsEs from './words.es.json';
import wordsPt from './words.pt.json';

export interface WordEntry {
  /** The word as it is written, with accents: "MAÇÃ". */
  display: string;
  /** The word as it goes in a grid: "MACA". */
  answer: string;
  clue: string;
}

const RAW: Record<Lang, string[][]> = { en: wordsEn, pt: wordsPt, es: wordsEs };
const cache: Partial<Record<Lang, WordEntry[]>> = {};

export function wordsFor(lang: Lang): WordEntry[] {
  cache[lang] ??= RAW[lang].map(([display, clue]) => ({ display, answer: plain(display), clue }));
  return cache[lang];
}
