// The crossword screen speaks the language of its puzzles.
import type { Lang } from './names';

export interface Strings {
  /** Name of this language, in the language itself. */
  language: string;
  title: string;
  solvedOf: (solved: number, total: number) => string;
  across: string;
  down: string;
  acrossClues: string;
  downClues: string;
  letters: (count: number) => string;
  allPuzzles: string;
  clues: string;
  help: string;
  checkPuzzle: string;
  checkNote: string;
  revealLetter: string;
  revealLetterNote: string;
  revealWord: string;
  clearPuzzle: string;
  clearNote: string;
  solved: string;
  solvedIn: (name: string, time: string) => string;
  withHelp: string;
  next: (name: string) => string;
  wrongBanner: string;
  previousClue: string;
  nextClue: string;
  deleteKey: string;
  emptySquare: string;
  statusNew: string;
  statusStarted: string;
  statusSolved: string;
  /** Keyboard rows, top to bottom. */
  keys: string[];
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    language: 'English',
    title: 'Crosswords',
    solvedOf: (a, b) => `${a} of ${b} solved`,
    across: 'Across',
    down: 'Down',
    acrossClues: 'Across',
    downClues: 'Down',
    letters: (n) => `${n} letters`,
    allPuzzles: 'All puzzles',
    clues: 'Clues',
    help: 'Help',
    checkPuzzle: 'Check puzzle',
    checkNote: 'Marks wrong letters',
    revealLetter: 'Reveal letter',
    revealLetterNote: 'The selected square',
    revealWord: 'Reveal word',
    clearPuzzle: 'Clear puzzle',
    clearNote: 'Start again',
    solved: 'Solved!',
    solvedIn: (name, time) => `${name} in ${time}`,
    withHelp: 'with help',
    next: (name) => `Next: ${name}`,
    wrongBanner: 'Every square is filled, but something is wrong. Try Help.',
    previousClue: 'Previous clue',
    nextClue: 'Next clue',
    deleteKey: 'Delete',
    emptySquare: 'Empty square',
    statusNew: 'not started',
    statusStarted: 'started',
    statusSolved: 'solved',
    keys: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  },
  pt: {
    language: 'Português',
    title: 'Palavras cruzadas',
    solvedOf: (a, b) => `${a} de ${b} resolvidas`,
    across: 'Horizontal',
    down: 'Vertical',
    acrossClues: 'Horizontais',
    downClues: 'Verticais',
    letters: (n) => `${n} letras`,
    allPuzzles: 'Todas as cruzadas',
    clues: 'Dicas',
    help: 'Ajuda',
    checkPuzzle: 'Conferir',
    checkNote: 'Marca as letras erradas',
    revealLetter: 'Revelar letra',
    revealLetterNote: 'O quadrado selecionado',
    revealWord: 'Revelar palavra',
    clearPuzzle: 'Limpar tudo',
    clearNote: 'Começar de novo',
    solved: 'Resolvida!',
    solvedIn: (name, time) => `${name} em ${time}`,
    withHelp: 'com ajuda',
    next: (name) => `Próxima: ${name}`,
    wrongBanner: 'Está tudo preenchido, mas há algo errado. Toque em Ajuda.',
    previousClue: 'Dica anterior',
    nextClue: 'Próxima dica',
    deleteKey: 'Apagar',
    emptySquare: 'Quadrado vazio',
    statusNew: 'não iniciada',
    statusStarted: 'iniciada',
    statusSolved: 'resolvida',
    keys: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  },
  es: {
    language: 'Español',
    title: 'Crucigramas',
    solvedOf: (a, b) => `${a} de ${b} resueltos`,
    across: 'Horizontal',
    down: 'Vertical',
    acrossClues: 'Horizontales',
    downClues: 'Verticales',
    letters: (n) => `${n} letras`,
    allPuzzles: 'Todos los crucigramas',
    clues: 'Pistas',
    help: 'Ayuda',
    checkPuzzle: 'Comprobar',
    checkNote: 'Marca las letras incorrectas',
    revealLetter: 'Revelar letra',
    revealLetterNote: 'La casilla seleccionada',
    revealWord: 'Revelar palabra',
    clearPuzzle: 'Borrar todo',
    clearNote: 'Empezar de nuevo',
    solved: '¡Resuelto!',
    solvedIn: (name, time) => `${name} en ${time}`,
    withHelp: 'con ayuda',
    next: (name) => `Siguiente: ${name}`,
    wrongBanner: 'Todo está completo, pero hay algún error. Toca Ayuda.',
    previousClue: 'Pista anterior',
    nextClue: 'Pista siguiente',
    deleteKey: 'Borrar',
    emptySquare: 'Casilla vacía',
    statusNew: 'sin empezar',
    statusStarted: 'empezado',
    statusSolved: 'resuelto',
    keys: ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'],
  },
};

/**
 * Turn a typed character into a grid letter: accents are dropped (É becomes E, Ç becomes C),
 * and Ñ counts as a letter only in Spanish. Returns '' for anything that isn't a letter.
 */
export function toGridLetter(key: string, lang: Lang): string {
  if (key.length !== 1) return '';
  const upper = key.toUpperCase();
  if (upper === 'Ñ') return lang === 'es' ? 'Ñ' : 'N';
  const plain = upper.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /^[A-Z]$/.test(plain) ? plain : '';
}

/** The language to offer first, from the phone's own language. */
export function defaultLang(): Lang {
  const tag = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return tag.startsWith('pt') ? 'pt' : tag.startsWith('es') ? 'es' : 'en';
}
