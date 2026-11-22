// The hangman screen speaks the language of its words.
import type { Lang } from '../words/lang';

export interface Strings {
  title: string;
  misses: (count: number, max: number) => string;
  streak: (count: number) => string;
  clue: string;
  newWord: string;
  language: string;
  won: string;
  lost: string;
  wordWas: string;
  nextWord: string;
  home: string;
  guessed: (won: number, played: number) => string;
  bestStreak: (count: number) => string;
  flower: (petals: number) => string;
  keyboard: string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    title: 'Hangman',
    misses: (n, max) => `Misses ${n} of ${max}`,
    streak: (n) => `Streak ${n}`,
    clue: 'Clue',
    newWord: 'New word',
    language: 'Language',
    won: 'Well done!',
    lost: 'Not this time',
    wordWas: 'The word was',
    nextWord: 'Next word',
    home: 'Home',
    guessed: (won, played) => `${won} of ${played} words guessed`,
    bestStreak: (n) => `best streak ${n}`,
    flower: (n) => `Flower with ${n} of 6 petals left`,
    keyboard: 'Keyboard',
  },
  pt: {
    title: 'Forca',
    misses: (n, max) => `Erros ${n} de ${max}`,
    streak: (n) => `Sequência ${n}`,
    clue: 'Dica',
    newWord: 'Nova palavra',
    language: 'Idioma',
    won: 'Muito bem!',
    lost: 'Não foi dessa vez',
    wordWas: 'A palavra era',
    nextWord: 'Próxima palavra',
    home: 'Início',
    guessed: (won, played) => `${won} de ${played} palavras acertadas`,
    bestStreak: (n) => `melhor sequência ${n}`,
    flower: (n) => `Flor com ${n} de 6 pétalas`,
    keyboard: 'Teclado',
  },
  es: {
    title: 'Ahorcado',
    misses: (n, max) => `Fallos ${n} de ${max}`,
    streak: (n) => `Racha ${n}`,
    clue: 'Pista',
    newWord: 'Otra palabra',
    language: 'Idioma',
    won: '¡Muy bien!',
    lost: 'Esta vez no',
    wordWas: 'La palabra era',
    nextWord: 'Siguiente palabra',
    home: 'Inicio',
    guessed: (won, played) => `${won} de ${played} palabras acertadas`,
    bestStreak: (n) => `mejor racha ${n}`,
    flower: (n) => `Flor con ${n} de 6 pétalos`,
    keyboard: 'Teclado',
  },
};
