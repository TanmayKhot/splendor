# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fully playable browser-based 2-player local Splendor board game. Client-side only (no backend). Stack: TypeScript, React 18, Zustand, Vite, Vitest. All implementation phases (1–6) are complete — 79 tests passing, production build clean, engine purity verified.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview production build
npm run test         # run all tests (79 tests, 3 test files)
npx vitest run src/game/engine.test.ts   # run a single test file
```

## Architecture

**Critical rule:** `src/game/` must have zero React imports. All game rules are pure TypeScript functions. This separation enables future AI agents to run game logic without a UI.

### Layered data flow
```
components → (read) → Zustand store ← (dispatch actions) ← components
                           ↓
                    engine.ts (pure functions, no side effects)
                           ↓
                    types.ts + constants.ts
```

### Key directories

- `src/game/` — Pure game logic only
  - `types.ts` — All TypeScript types (`GemColor`, `CardCost`, `GameState`, etc.)
  - `constants.ts` — Hard-coded card data (90 cards), noble tiles (10), gem counts
  - `engine.ts` — Validation + state transition functions; called by the store
  - `engine.test.ts` — Engine unit tests
  - `selectors.ts` — Derived state helpers (e.g. can player afford card?)
- `src/store/gameStore.ts` — Zustand store; single source of truth; calls engine functions before mutating state
- `src/components/` — React components; read from store, dispatch actions, never compute game logic
  - `GameSetup.tsx` — Player name inputs, "Start Game" button
  - `Card.tsx` — Single development card with Buy/Reserve buttons
  - `CardTiers.tsx` — 3 tiers of 4 visible cards + deck buttons
  - `GemPool.tsx` — Central gem supply with selection UI
  - `NobleRow.tsx` — Noble tiles display
  - `PlayerPanel.tsx` — Player gems (with X/10 counter), bonuses, nobles, reserved cards
  - `TurnIndicator.tsx` — Current player indicator
  - `DiscardModal.tsx` — Gem discard when over 10
  - `NobleModal.tsx` — Noble selection when eligible
  - `GameOver.tsx` — Winner display with play-again option
- `tests/` — Additional Vitest unit tests
  - `constants.test.ts` — Card/noble data validation
  - `store.test.ts` — Store action and turn flow tests

### Important type distinctions

- `GemColor` includes `'gold'`; `ColoredGem = Exclude<GemColor, 'gold'>` excludes it
- `CardCost = Partial<Record<ColoredGem, number>>` — used for card/noble costs (gold never appears here)
- `GemCost = Partial<Record<GemColor, number>>` — used for gem payments (gold allowed)
- `GameState.phase`: `'setup' | 'playing' | 'ending' | 'ended'` — `'ending'` means end game triggered but final round not yet complete

### Store action contracts

Every store action must:
1. Call the corresponding `can*` validator from `engine.ts` and no-op if invalid (never corrupt state)
2. Update state immutably
3. After the action: check gem discard → check noble eligibility → check win trigger → advance turn

### End-game flow

`shouldTriggerEndGame()` → sets `phase: 'ending'` → Player 2 completes their turn → `determineWinner()` → `phase: 'ended'`

### `takeGems` action

Accepts 1–3 distinct non-gold colors. Fewer than 3 is legal when the supply has gems in only 1 or 2 colors.

### `reserveCard` signature

`reserveCard(source: DevelopmentCard | { fromDeck: CardTier })` — passing a `DevelopmentCard` reserves a visible card; passing `{ fromDeck }` reserves the top of a deck (player sees it, opponent does not).

## Styling

Dark luxury theme with CSS in `src/App.css`. Gem colors: white, blue, green, red, black, gold. Cards show gem-colored bonus indicators and cost circles.

## Game data reference

Full card data (90 cards across 3 tiers) and noble tiles (10) are defined in `rules.md`. `constants.ts` is the TypeScript encoding of that data. Cross-check against `rules.md` when editing card data.
