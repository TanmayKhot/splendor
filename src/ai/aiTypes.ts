import type { ColoredGem, CardTier, GemColor } from '../game/types';

// ── Provider Config ────────────────────────────────────────

export type AiProvider = 'anthropic' | 'openai' | 'custom';

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string; // only for 'custom' provider
}

// ── AI State ───────────────────────────────────────────────

export type AiStatus = 'idle' | 'thinking' | 'done' | 'error';

export interface AiState {
  status: AiStatus;
  reasoning: string[];        // 3-4 bullets after each move
  actionSummary: string;      // plain-language summary of the action taken
  errorMessage: string;       // populated when status === 'error'
  consecutiveFailures: number;
}

// ── AI Actions ─────────────────────────────────────────────

export type AiAction =
  | { type: 'takeGems'; colors: ColoredGem[] }
  | { type: 'take2Gems'; color: ColoredGem }
  | { type: 'purchaseCard'; cardId: string }
  | { type: 'reserveCard'; cardId: string }
  | { type: 'reserveCard'; fromDeck: CardTier }
  | { type: 'discardGems'; gems: Partial<Record<GemColor, number>> }
  | { type: 'selectNoble'; nobleId: string };

// ── AI Response ────────────────────────────────────────────

export interface AiResponse {
  reasoning: string[];
  action: AiAction;
}
