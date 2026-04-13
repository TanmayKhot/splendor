# Plan: localStorage-Based User Profile System

## Context

Every time a user wants to play against AI, they must re-enter their API key — tedious for repeat players. This adds a localStorage-based profile that persists API keys (one per provider), player preferences, and game stats. No backend/database changes needed.

**Decisions made:**
- **Approach:** localStorage only (Option A)
- **Save UX:** Both auto-save on use AND a dedicated settings modal
- **Scope:** Full profile — API keys per provider, preferences, game stats

---

## New Files

### 1. `src/store/profileTypes.ts` — Type definitions

```typescript
export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string; // only for 'custom'
}

export interface GameStats {
  localWins: number; localLosses: number; localGames: number;
  aiWins: number; aiLosses: number; aiGames: number;
  onlineWins: number; onlineLosses: number; onlineGames: number;
}

export interface UserProfile {
  version: number; // schema version for future migrations
  playerName: string;
  preferredProvider: AiProvider;
  apiKeys: Partial<Record<AiProvider, ProviderConfig>>;
  stats: GameStats;
}

export type GameMode = 'local' | 'ai' | 'online';
```

### 2. `src/store/profileService.ts` — localStorage CRUD

Pure functions (no React/Zustand imports), following `socketClient.ts` pattern:

- `STORAGE_KEY = 'splendor_profile'`, `CURRENT_VERSION = 1`
- `getDefaultProfile()` — fresh profile with empty strings/zero stats
- `loadProfile()` — parse from localStorage, migrate if needed, return default on error
- `saveProfile(profile)` — JSON.stringify to localStorage (try/catch for quota errors)
- `updateProfile(partial)` — load, merge, save, return
- `updateProviderConfig(provider, config)` — save a provider's key/model
- `updateStats(mode, won)` — increment correct stat counters
- `resetStats()` — zero all stats
- `resetProfile()` — remove localStorage key entirely
- `migrateProfile(raw)` — version-based migration (v1 = validate + fill defaults)

### 3. `src/components/SettingsModal.tsx` — Settings page

Modal following `RulesModal.tsx` pattern (`.rules-overlay` / `.rules-modal` structure):

**Sections:**
1. **Player Name** — editable text input, pre-filled from profile
2. **API Keys** — one section per provider (anthropic, openai, gemini, openrouter, custom):
   - API key (password field with show/hide toggle)
   - Model (dropdown using `PROVIDER_MODELS` from GameSetup, or text input for openrouter/custom)
   - Base URL (only for custom)
   - "Test" button per provider (reuse fetch logic from GameSetup `testConnection`)
3. **Preferred Provider** — dropdown
4. **Game Stats** — read-only grid (3 columns: Local / vs AI / Online, rows: Wins, Losses, Games, Win %)
5. **Actions** — "Reset Stats" and "Clear All Data" buttons (both with `window.confirm`)

Auto-save fields on blur/change. Local `useState` initialized from `loadProfile()` on mount.

---

## Files to Modify

### 4. `src/components/GameSetup.tsx`

**Pre-fill on mount** — change initial `useState` values:
- `p1Name` → `loadProfile().playerName` (line 56)
- `provider` → `loadProfile().preferredProvider` (line 63)
- `model` → saved model for preferred provider, or `DEFAULT_MODELS[provider]` (line 64)
- `apiKey` → saved key for preferred provider (line 65)
- `baseUrl` → saved baseUrl for preferred provider if custom (line 66)

**On provider change** (`handleProviderChange`, line 80-84):
- After setting provider, load saved config: `loadProfile().apiKeys[newProvider]`
- Fill `apiKey` and `model` from saved config, fall back to `DEFAULT_MODELS[newProvider]` for model

**On game start** (`handleStart`, line 119-130):
- After `initGame()`, call `updateProfile({ playerName, preferredProvider: provider })`
- Call `updateProviderConfig(provider, { apiKey, model, baseUrl })` for AI mode
- Also save playerName for local mode

### 5. `src/components/GameOver.tsx`

**Record stats on game end** — add `useEffect` (runs once on mount via `useRef` guard):
- Determine mode: `onlineState !== null` → 'online', `aiMode` → 'ai', else 'local'
- Determine if player won:
  - **AI mode:** `winner.name === players[0].name` (player 0 is always human)
  - **Local mode:** track from player 0's perspective
  - **Online mode:** `winner.name === onlineState.nickname`
- Call `updateStats(mode, playerWon)`

### 6. `src/App.tsx`

- Add `useState(false)` for `showSettings`
- Add a **Settings button** on the setup screen (line 43-57, near the title) — styled like `btn-rules`
- Add a **Settings button** on the game-over screen (line 60-67)
- Render `<SettingsModal onClose={...} />` when `showSettings` is true

### 7. `src/App.css`

New classes following existing patterns:
- `.btn-settings` — modeled on `.btn-rules` (transparent, border, gold hover)
- `.settings-overlay` — same as `.rules-overlay` (fixed, backdrop blur, z-1000)
- `.settings-modal` — same as `.rules-modal` (#111e30 bg, max-width 680px, scroll)
- `.settings-close`, `.settings-title` — same as rules equivalents
- `.settings-section`, `.settings-field` — section and form field styles
- `.settings-stats-grid` — CSS grid for stats display
- `.btn-danger` — red border/text for destructive actions

### 8. `src/components/OnlineLobby.tsx`

Pre-fill `nickname` from saved profile (line 25):
```
const [nickname, setNickname] = useState(() => loadProfile().playerName);
```

---

## Implementation Order

1. **Data layer:** Create `profileTypes.ts` + `profileService.ts`
2. **Auto-fill GameSetup:** Modify `GameSetup.tsx` to load/save profile
3. **Stats tracking:** Modify `GameOver.tsx` to record game outcomes
4. **Settings modal:** Create `SettingsModal.tsx`, add CSS, wire into `App.tsx`
5. **Online lobby:** Pre-fill nickname in `OnlineLobby.tsx`

---

## Verification

1. **Auto-save:** Start an AI game → quit → refresh → start new AI game setup. API key, model, provider, and player name should be pre-filled.
2. **Provider switching:** Save keys for 2+ providers → switch dropdown → correct key/model auto-fills.
3. **Settings modal:** Open settings → verify all saved keys appear → edit one → close → reopen → edit persisted.
4. **Stats:** Play and win/lose games in local, AI, and online modes → check stats in settings modal update correctly.
5. **Reset:** Use "Reset Stats" and "Clear All Data" buttons → verify they work with confirmation.
6. **Fresh browser:** Open in incognito → verify default empty state works (no errors).
7. **Run `npm run test`** — ensure all 189 existing tests still pass.
