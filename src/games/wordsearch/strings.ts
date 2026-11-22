// The word search screen speaks the language of its words.
import type { Lang } from '../words/lang';
import type { Level } from './logic';

export interface Strings {
  title: string;
  levelNotes: Record<Level, string>;
  found: (found: number, total: number) => string;
  howTo: string;
  hint: string;
  newGame: string;
  replaces: string;
  language: string;
  allFound: string;
  solvedIn: (level: string, time: string) => string;
  newBest: string;
  best: (time: string) => string;
  wins: (count: number) => string;
  home: string;
  gridLabel: string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    title: 'Word search',
    levelNotes: {
      easy: '8 × 8 · across and down',
      medium: '10 × 10 · with diagonals',
      hard: '12 × 12 · every direction',
    },
    found: (a, b) => `Found ${a} of ${b}`,
    howTo: 'Drag across a word, or tap its first and last letters.',
    hint: 'Hint',
    newGame: 'New game',
    replaces: 'This replaces the game in progress.',
    language: 'Language',
    allFound: 'All found!',
    solvedIn: (level, time) => `${level} in ${time}`,
    newBest: 'a new best time',
    best: (time) => `best ${time}`,
    wins: (n) => `${n} solved`,
    home: 'Home',
    gridLabel: 'Letter grid',
  },
  pt: {
    title: 'Caça-palavras',
    levelNotes: {
      easy: '8 × 8 · horizontal e vertical',
      medium: '10 × 10 · com diagonais',
      hard: '12 × 12 · todas as direções',
    },
    found: (a, b) => `${a} de ${b} encontradas`,
    howTo: 'Arraste sobre a palavra ou toque na primeira e na última letra.',
    hint: 'Dica',
    newGame: 'Novo jogo',
    replaces: 'Isso substitui o jogo em andamento.',
    language: 'Idioma',
    allFound: 'Tudo encontrado!',
    solvedIn: (level, time) => `${level} em ${time}`,
    newBest: 'novo recorde',
    best: (time) => `melhor ${time}`,
    wins: (n) => `${n} ${n === 1 ? 'resolvido' : 'resolvidos'}`,
    home: 'Início',
    gridLabel: 'Grade de letras',
  },
  es: {
    title: 'Sopa de letras',
    levelNotes: {
      easy: '8 × 8 · horizontal y vertical',
      medium: '10 × 10 · con diagonales',
      hard: '12 × 12 · todas las direcciones',
    },
    found: (a, b) => `${a} de ${b} encontradas`,
    howTo: 'Arrastra sobre la palabra o toca la primera y la última letra.',
    hint: 'Pista',
    newGame: 'Juego nuevo',
    replaces: 'Esto reemplaza el juego en curso.',
    language: 'Idioma',
    allFound: '¡Todo encontrado!',
    solvedIn: (level, time) => `${level} en ${time}`,
    newBest: 'nuevo récord',
    best: (time) => `mejor ${time}`,
    wins: (n) => `${n} ${n === 1 ? 'resuelto' : 'resueltos'}`,
    home: 'Inicio',
    gridLabel: 'Cuadrícula de letras',
  },
};
