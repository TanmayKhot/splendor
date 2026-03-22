import { create } from 'zustand';
import type {
  ColoredGem,
  CardTier,
  GemCost,
  DevelopmentCard,
  NobleTile,
  PlayerState,
  GameState,
  GamePhase,
} from '../game/types';
import {
  generateInitialState,
  canTakeGems,
  canTake2Gems,
  canReserveCard,
  canPurchaseCard,
  applyTakeGems,
  applyTake2Gems,
  applyReserveCard,
  applyPurchaseCard,
  applyDiscardGems,
  applyNobleVisit,
  shouldTriggerEndGame,
  advanceTurn,
} from '../game/engine';
import { getEligibleNobles, getTotalGems } from '../game/selectors';
import { MAX_GEMS_IN_HAND } from '../game/constants';

export interface GameStore extends GameState {
  pendingNobles: NobleTile[] | null;
  pendingDiscard: boolean;

  initGame: (p1Name: string, p2Name: string) => void;
  resetGame: () => void;
  takeGems: (colors: ColoredGem[]) => void;
  take2Gems: (color: ColoredGem) => void;
  reserveCard: (source: DevelopmentCard | { fromDeck: CardTier }) => void;
  purchaseCard: (card: DevelopmentCard) => void;
  discardGems: (gems: GemCost) => void;
  selectNoble: (noble: NobleTile) => void;
}

const initialStoreState = {
  board: {
    gemSupply: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
    decks: [[], [], []] as [DevelopmentCard[], DevelopmentCard[], DevelopmentCard[]],
    visibleCards: [[], [], []] as [DevelopmentCard[], DevelopmentCard[], DevelopmentCard[]],
    nobles: [] as NobleTile[],
  },
  players: [
    { name: '', gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, reserved: [], purchased: [], nobles: [] },
    { name: '', gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, reserved: [], purchased: [], nobles: [] },
  ] as [PlayerState, PlayerState],
  currentPlayerIndex: 0 as 0 | 1,
  phase: 'setup' as GamePhase,
  winner: null as PlayerState | null,
  turnCount: 0,
  pendingNobles: null as NobleTile[] | null,
  pendingDiscard: false,
};

function postActionChecks(state: GameState): GameState & { pendingNobles: NobleTile[] | null; pendingDiscard: boolean } {
  const player = state.players[state.currentPlayerIndex];

  // 1. Check gem discard
  if (getTotalGems(player) > MAX_GEMS_IN_HAND) {
    return { ...state, pendingNobles: null, pendingDiscard: true };
  }

  // 2. Check noble eligibility
  const eligible = getEligibleNobles(state.board.nobles, player);
  if (eligible.length > 0) {
    return { ...state, pendingNobles: eligible, pendingDiscard: false };
  }

  // 3. Check win trigger
  if (state.phase === 'playing' && shouldTriggerEndGame(state)) {
    state = { ...state, phase: 'ending' };
  }

  // 4. Advance turn
  const advanced = advanceTurn(state);
  return { ...advanced, pendingNobles: null, pendingDiscard: false };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialStoreState,

  initGame: (p1Name: string, p2Name: string) => {
    const gameState = generateInitialState(p1Name, p2Name);
    set({ ...gameState, pendingNobles: null, pendingDiscard: false });
  },

  resetGame: () => {
    set(initialStoreState);
  },

  takeGems: (colors: ColoredGem[]) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'ending') return;
    if (state.pendingDiscard || state.pendingNobles) return;
    if (!canTakeGems(state, colors)) return;

    const newState = applyTakeGems(state, colors);
    set(postActionChecks(newState));
  },

  take2Gems: (color: ColoredGem) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'ending') return;
    if (state.pendingDiscard || state.pendingNobles) return;
    if (!canTake2Gems(state, color)) return;

    const newState = applyTake2Gems(state, color);
    set(postActionChecks(newState));
  },

  reserveCard: (source: DevelopmentCard | { fromDeck: CardTier }) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'ending') return;
    if (state.pendingDiscard || state.pendingNobles) return;
    if (!canReserveCard(state, source)) return;

    const newState = applyReserveCard(state, source);
    set(postActionChecks(newState));
  },

  purchaseCard: (card: DevelopmentCard) => {
    const state = get();
    if (state.phase !== 'playing' && state.phase !== 'ending') return;
    if (state.pendingDiscard || state.pendingNobles) return;
    if (!canPurchaseCard(state, card)) return;

    const newState = applyPurchaseCard(state, card);
    set(postActionChecks(newState));
  },

  discardGems: (gems: GemCost) => {
    const state = get();
    if (!state.pendingDiscard) return;

    const newState = applyDiscardGems(state, gems);
    const player = newState.players[newState.currentPlayerIndex];

    if (getTotalGems(player) > MAX_GEMS_IN_HAND) {
      // Still over limit, keep pending
      set({ ...newState, pendingDiscard: true, pendingNobles: null });
      return;
    }

    // Discard resolved, continue post-action checks (noble/win/advance)
    const eligible = getEligibleNobles(newState.board.nobles, player);
    if (eligible.length > 0) {
      set({ ...newState, pendingNobles: eligible, pendingDiscard: false });
      return;
    }

    if (newState.phase === 'playing' && shouldTriggerEndGame(newState)) {
      const updated = { ...newState, phase: 'ending' as GamePhase };
      const advanced = advanceTurn(updated);
      set({ ...advanced, pendingNobles: null, pendingDiscard: false });
      return;
    }

    const advanced = advanceTurn(newState);
    set({ ...advanced, pendingNobles: null, pendingDiscard: false });
  },

  selectNoble: (noble: NobleTile) => {
    const state = get();
    if (!state.pendingNobles) return;
    if (!state.pendingNobles.some(n => n.id === noble.id)) return;

    const newState = applyNobleVisit(state, noble);

    // Check if more nobles are eligible
    const player = newState.players[newState.currentPlayerIndex];
    const remaining = getEligibleNobles(newState.board.nobles, player);
    if (remaining.length > 0) {
      set({ ...newState, pendingNobles: remaining, pendingDiscard: false });
      return;
    }

    // Check win trigger
    if (newState.phase === 'playing' && shouldTriggerEndGame(newState)) {
      const updated = { ...newState, phase: 'ending' as GamePhase };
      const advanced = advanceTurn(updated);
      set({ ...advanced, pendingNobles: null, pendingDiscard: false });
      return;
    }

    const advanced = advanceTurn(newState);
    set({ ...advanced, pendingNobles: null, pendingDiscard: false });
  },
}));
