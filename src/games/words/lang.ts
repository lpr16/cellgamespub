// The language shared by the word games (crosswords, word search, hangman).
// Kept tiny: the home screen pulls it in through the games' save summaries.
import { load, save } from '../../shell/storage';

export type Lang = 'en' | 'pt' | 'es';
export const LANGS: Lang[] = ['en', 'pt', 'es'];

/** Each language's name, in the language itself. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', pt: 'Português', es: 'Español' };

const LANG_KEY = 'words.lang';
/** Where the crossword kept its own choice before the word games shared one. */
const OLD_CROSSWORD_KEY = 'crossword.lang';

/** The language to offer first, from the phone's own language. */
export function defaultLang(): Lang {
  const tag = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return tag.startsWith('pt') ? 'pt' : tag.startsWith('es') ? 'es' : 'en';
}

const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

/** The player's chosen language, falling back to the crossword's earlier choice, then the phone's. */
export function loadLang(): Lang {
  const chosen = load<unknown>(LANG_KEY, null);
  if (isLang(chosen)) return chosen;
  const old = load<unknown>(OLD_CROSSWORD_KEY, null);
  return isLang(old) ? old : defaultLang();
}

export function saveLang(lang: Lang): void {
  save(LANG_KEY, lang);
}

/**
 * Upper case without accents, as letters appear in a puzzle grid: É becomes E and Ç becomes C.
 * Ñ is kept, because in Spanish it is a letter of its own.
 */
export function plain(text: string): string {
  return text
    .toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'Ñ');
}

/**
 * Turn a typed character into a puzzle letter: accents are dropped (É becomes E, Ç becomes C),
 * and Ñ counts as a letter only in Spanish. Returns '' for anything that isn't a letter.
 */
export function toGridLetter(key: string, lang: Lang): string {
  if (key.length !== 1) return '';
  const upper = key.toUpperCase();
  if (upper === 'Ñ') return lang === 'es' ? 'Ñ' : 'N';
  const letter = plain(upper);
  return /^[A-Z]$/.test(letter) ? letter : '';
}

/** On-screen keyboard rows for each language, top to bottom. */
export const KEY_ROWS: Record<Lang, string[]> = {
  en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  pt: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  es: ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'],
};
