# Cell Games

A suite of classic games for phones, built as one installable, offline web app.

| Game | Status |
| --- | --- |
| Sudoku | Playable |
| Solitaire (Klondike, draw one or three) | Playable |
| Mahjong (tile matching) | Planned |
| Crosswords (60 puzzles in three sizes) | Playable |

## Run it

```sh
npm install
npm run dev       # develop with live reload
npm test          # unit tests for the game rules
npm run build     # type-check and build into dist/
npm run preview   # serve the built app
npm run crosswords  # rebuild the crossword puzzles from the word list
```

## Layout

- `src/shell/` — home screen, settings, saving, shared sheets and buttons.
- `src/games/registry.tsx` — the list of games; each one loads only when opened.
- `src/games/<game>/` — one folder per game. Rules live in plain TypeScript
  (`logic.ts`, `state.ts`) with tests beside them; the screen is a separate React component.

## Crossword puzzles

The puzzles are generated, not hand-drawn. `scripts/crossword-words.txt` holds the answers and
their clues; `npm run crosswords` fills grids from that list and writes
`src/games/crossword/puzzles.json`, which is checked in. To add or change clues, edit the word
list and run the script again. The tests check every shipped puzzle.

Saved games, statistics and settings are kept in the browser's local storage on the device.
