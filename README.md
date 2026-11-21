# Cell Games

A suite of classic games for phones, built as one installable, offline web app.

| Game | Status |
| --- | --- |
| Sudoku | Playable |
| Solitaire (Klondike) | Planned |
| Mahjong (tile matching) | Planned |
| Crosswords (mini puzzles) | Planned |

## Run it

```sh
npm install
npm run dev       # develop with live reload
npm test          # unit tests for the game rules
npm run build     # type-check and build into dist/
npm run preview   # serve the built app
```

## Layout

- `src/shell/` — home screen, settings, saving, shared sheets and buttons.
- `src/games/registry.tsx` — the list of games; each one loads only when opened.
- `src/games/<game>/` — one folder per game. Rules live in plain TypeScript
  (`logic.ts`, `state.ts`) with tests beside them; the screen is a separate React component.

Saved games, statistics and settings are kept in the browser's local storage on the device.
