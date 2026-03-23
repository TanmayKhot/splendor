# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fully playable browser-based Splendor board game supporting 2-player local mode and 1-player vs AI mode. Stack: TypeScript, React 18, Zustand, Vite, Vitest + Express proxy server for AI API calls. All implementation phases (1–7) are complete — 101 tests passing, production build clean, engine purity verified.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server (Vite at :5173) + AI proxy server (:3001) via concurrently
npm run server       # run only the AI proxy server
npm run build        # production build → dist/
npm run preview      # preview production build
npm run test         # run all tests (101 tests, 4 test files)
npx vitest run src/game/engine.test.ts   # run a single test file
```

## Architecture

**Critical rule:** `src/game/` must have zero React imports. All game rules are pure TypeScript functions. This separation enables AI agents to run game logic without a UI.

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
- `src/ai/` — AI player layer (no React imports)
  - `aiTypes.ts` — `AiProvider`, `AiConfig`, `AiState`, `AiAction`, `AiResponse` types
  - `aiService.ts` — Builds prompts from `GameState`, calls `/api/ai/chat`, parses `AiAction` from the response
  - `aiService.test.ts` — AI service unit tests
- `src/store/gameStore.ts` — Zustand store; single source of truth; holds `aiMode`, `aiConfig`, `aiState`; calls engine functions before mutating state
- `src/components/` — React components; read from store, dispatch actions, never compute game logic
  - `GameSetup.tsx` — Mode toggle (local / vs AI), player name inputs, AI provider/model/API key config, "Test Connection", "Start Game"
  - `AiPlayerController.tsx` — Invisible component that drives AI turns: calls `aiService`, dispatches actions
  - `AiReasoningPanel.tsx` — Shows AI thinking status, reasoning bullets, action summary; retry/manual-override buttons on error
  - `Card.tsx` — Single development card with Buy/Reserve buttons
  - `CardTiers.tsx` — 3 tiers of 4 visible cards + deck buttons
  - `GemPool.tsx` — Central gem supply with selection UI
  - `NobleRow.tsx` — Noble tiles display
  - `PlayerPanel.tsx` — Player gems (with X/10 counter), bonuses, nobles, reserved cards; shows AI model name in muted text for AI player
  - `TurnIndicator.tsx` — Current player indicator
  - `DiscardModal.tsx` — Gem discard when over 10
  - `NobleModal.tsx` — Noble selection when eligible
  - `GameOver.tsx` — Winner display with play-again option
- `server/index.ts` — Express proxy server (port 3001); exposes `POST /api/ai/chat`; forwards requests to Anthropic, OpenAI, Google Gemini, OpenRouter, or a custom endpoint; keeps API keys server-side
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

## AI player

The AI proxy server (`server/index.ts`) is required for AI mode — `npm run dev` starts both Vite and the proxy together. Vite proxies `/api` to `:3001`.

Supported providers: `anthropic`, `openai`, `gemini`, `openrouter`, `custom`. Default models are set per-provider in `GameSetup.tsx`. The AI player's name in the UI is displayed as `AI Player` with the model name shown in muted text alongside it (e.g. `AI Player (claude-sonnet-4-20250514)`).

`AiPlayerController` watches the store; when it's the AI's turn and no modal is pending, it invokes `aiService.getAiMove(gameState, aiConfig)` and dispatches the returned `AiAction`. After 3 consecutive failures it surfaces a manual-override option.

## Styling

Dark luxury theme with CSS in `src/App.css`. Gem colors: white, blue, green, red, black, gold. Cards show gem-colored bonus indicators and cost circles.

## Game data reference

Full card data (90 cards across 3 tiers) and noble tiles (10) are defined in `rules.md`. `constants.ts` is the TypeScript encoding of that data. Cross-check against `rules.md` when editing card data.
