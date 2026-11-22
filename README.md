# Cell Games

A suite of classic games for phones, built as one installable, offline web app.

| Game | Status |
| --- | --- |
| Sudoku | Playable |
| Solitaire (Klondike, draw one or three) | Playable |
| FreeCell | Playable |
| Spider (one, two or four suits) | Playable |
| Memory pairs | Playable |
| Mahjong (tile matching) | Planned |
| Crosswords (60 puzzles each in English, Portuguese and Spanish) | Playable |

## Run it

```sh
npm install
npm run dev       # develop with live reload
npm test          # unit tests for the game rules
npm run build     # type-check and build into dist/
npm run preview   # serve the built app
npm run crosswords  # rebuild the crossword puzzles from the word list
```

## Publishing

The public copy of this project is `lpr16/cellgamespub`. Every push to its default branch runs
`.github/workflows/deploy.yml`, which tests and builds the app and pushes the result to the
`gh-pages` branch. GitHub Pages serves that branch (Settings → Pages → Deploy from a branch →
`gh-pages`) at https://lpr16.github.io/cellgamespub/.

## Layout

- `src/shell/` — home screen, settings, saving, shared sheets and buttons.
- `src/games/registry.tsx` — the list of games; each one loads only when opened.
- `src/games/cards/` — the table shared by the card games: drawing, dragging and animating cards,
  undo, hints, saving and statistics. Klondike, FreeCell and Spider each supply only their rules.
- `src/games/<game>/` — one folder per game. Rules live in plain TypeScript
  (`logic.ts`, `state.ts`) with tests beside them; the screen is a separate React component.

## Crossword puzzles

The puzzles are generated, not hand-drawn. Each language has a word list,
`scripts/crossword-words.<language>.txt`, holding answers and their clues. `npm run crosswords`
fills grids from those lists and writes `src/games/crossword/puzzles.<language>.json`, which are
checked in (`npm run crosswords pt` rebuilds one language). To add or change clues, edit a word
list and run the script again. The tests check every shipped puzzle.

Answers are written with their accents in the word lists; the grid drops them, as printed
crosswords do (É is entered as E, Ç as C). Spanish keeps Ñ as its own letter. The crossword
screen's own text follows the language of the puzzles (`src/games/crossword/strings.ts`).

Saved games, statistics and settings are kept in the browser's local storage on the device.
