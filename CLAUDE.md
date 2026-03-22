# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser-based 2-player Splendor board game. Client-side only (no backend). Stack: TypeScript, React 18, Zustand, Vite, Vitest.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview production build
npm run test         # run all tests
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
  - `selectors.ts` — Derived state helpers (e.g. can player afford card?)
- `src/store/gameStore.ts` — Zustand store; single source of truth; calls engine functions before mutating state
- `src/components/` — React components; read from store, dispatch actions, never compute game logic
- `tests/` — Vitest unit tests for engine and store

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

## Game data reference

Full card data (90 cards across 3 tiers) and noble tiles (10) are defined in `rules.md`. `constants.ts` is the TypeScript encoding of that data. Cross-check against `rules.md` when editing card data.
