// Puzzle ids and their display names. Kept tiny: the home screen uses it too.

import { LANGS, type Lang } from '../words/lang';

export { LANGS, type Lang };

export const LEVEL_KEYS = ['s', 'm', 'l'] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

const LEVEL_NAMES: Record<Lang, Record<LevelKey, string>> = {
  en: { s: 'Small', m: 'Medium', l: 'Large' },
  pt: { s: 'Pequena', m: 'Média', l: 'Grande' },
  es: { s: 'Pequeño', m: 'Mediano', l: 'Grande' },
};

export const levelName = (lang: Lang, level: LevelKey) => LEVEL_NAMES[lang][level];

/** Ids look like "m03" for English and "pt-m03" or "es-m03" for the other languages. */
export function parseId(id: string): { lang: Lang; level: LevelKey; number: number } {
  const match = /^(?:(pt|es)-)?([sml])(\d+)$/.exec(id);
  if (!match) return { lang: 'en', level: 's', number: 0 };
  return { lang: (match[1] as Lang | undefined) ?? 'en', level: match[2] as LevelKey, number: Number(match[3]) };
}

/** "Medium 3" for "m03", "Média 3" for "pt-m03". */
export function puzzleName(id: string): string {
  const { lang, level, number } = parseId(id);
  return `${levelName(lang, level)} ${number}`;
}
