import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { getLegalActions } from '../game/engine';
import { getPlayerBonuses, getPlayerPoints, getTotalGems } from '../game/selectors';
import { MAX_GEMS_IN_HAND, COLORED_GEMS } from '../game/constants';
import { getAiMove, getAiDiscardDecision, getAiNobleSelection } from '../ai/aiService';
import { logTurn } from '../game/turnLogger';
import type { AiAction } from '../ai/aiTypes';
import type { GameState, DevelopmentCard, CardTier, ColoredGem } from '../game/types';

const TURN_DELAY_MS = 1000;

function findCardById(state: GameState, cardId: string): DevelopmentCard | undefined {
  for (const tierCards of state.board.visibleCards) {
    const card = tierCards.find(c => c.id === cardId);
    if (card) return card;
  }
  return state.players[state.currentPlayerIndex].reserved.find(c => c.id === cardId);
}

function summarizeAction(action: AiAction): string {
  switch (action.type) {
    case 'takeGems':
      return `Took ${action.colors.join(', ')} gems`;
    case 'take2Gems':
      return `Took 2 ${action.color} gems`;
    case 'purchaseCard':
      return `Purchased card ${action.cardId}`;
    case 'reserveCard':
      if ('fromDeck' in action) return `Reserved from tier ${action.fromDeck} deck`;
      return `Reserved card ${action.cardId}`;
    case 'discardGems':
      return `Discarded gems`;
    case 'selectNoble':
      return `Selected noble ${action.nobleId}`;
  }
}

function buildBonusesRecord(state: GameState, playerIndex: 0 | 1): Record<ColoredGem, number> {
  const bonuses = getPlayerBonuses(state.players[playerIndex]);
  const result: Record<ColoredGem, number> = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
  for (const color of COLORED_GEMS) {
    result[color] = bonuses[color] ?? 0;
  }
  return result;
}

export default function AiVsAiController() {
  const runningRef = useRef(false);

  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const aiVsAiMode = useGameStore(s => s.aiVsAiMode);
  const aiVsAiConfig = useGameStore(s => s.aiVsAiConfig);
  const phase = useGameStore(s => s.phase);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const aiVsAiPaused = useGameStore(s => s.aiVsAiPaused);
  const p0Status = useGameStore(s => s.aiStates[0].status);
  const p1Status = useGameStore(s => s.aiStates[1].status);

  useEffect(() => {
    if (!aiVsAiMode || !aiVsAiConfig) return;
    if (phase !== 'playing' && phase !== 'ending') return;
    if (aiVsAiPaused) return;
    const currentStatus = currentPlayerIndex === 0 ? p0Status : p1Status;
    if (currentStatus === 'thinking') return;
    if (runningRef.current) return;

    const playerIndex = currentPlayerIndex as 0 | 1;
    const config = playerIndex === 0 ? aiVsAiConfig.player0 : aiVsAiConfig.player1;

    async function runAiTurn() {
      runningRef.current = true;
      const setAiState = useGameStore.getState().setAiStateForPlayer;

      try {
        const store = useGameStore.getState();

        if (store.pendingDiscard) {
          const player = store.players[playerIndex];
          const excess = getTotalGems(player) - MAX_GEMS_IN_HAND;
          setAiState(playerIndex, { status: 'thinking' });
          await delay(TURN_DELAY_MS);
          const result = await getAiDiscardDecision(player.gems, excess, config, playerIndex);

          if (result.action.type === 'discardGems' && result.action.gems) {
            useGameStore.getState().discardGems(result.action.gems);
          }
          setAiState(playerIndex, {
            status: 'done',
            reasoning: result.reasoning,
            actionSummary: summarizeAction(result.action),
          });
          return;
        }

        if (store.pendingNobles) {
          setAiState(playerIndex, { status: 'thinking' });
          await delay(TURN_DELAY_MS);
          const result = await getAiNobleSelection(store.pendingNobles, config, playerIndex);

          if (result.action.type === 'selectNoble') {
            const nobleId = (result.action as { type: 'selectNoble'; nobleId: string }).nobleId;
            const noble = store.pendingNobles.find(n => n.id === nobleId);
            if (noble) {
              useGameStore.getState().selectNoble(noble);
            }
          }
          setAiState(playerIndex, {
            status: 'done',
            reasoning: result.reasoning,
            actionSummary: summarizeAction(result.action),
          });
          return;
        }

        // Normal turn
        setAiState(playerIndex, { status: 'thinking' });
        const currentState = useGameStore.getState() as GameState;
        const legalActions = getLegalActions(currentState);

        if (legalActions.length === 0) return;

        await delay(TURN_DELAY_MS);
        const result = await getAiMove(currentState, legalActions, config, playerIndex);
        const action = result.action;

        // Apply the action
        const latestStore = useGameStore.getState();
        switch (action.type) {
          case 'takeGems':
            latestStore.takeGems(action.colors);
            break;
          case 'take2Gems':
            latestStore.take2Gems(action.color);
            break;
          case 'purchaseCard': {
            const card = findCardById(latestStore as GameState, action.cardId);
            if (card) latestStore.purchaseCard(card);
            break;
          }
          case 'reserveCard': {
            if ('fromDeck' in action) {
              latestStore.reserveCard({ fromDeck: action.fromDeck as CardTier });
            } else {
              const card = findCardById(latestStore as GameState, action.cardId);
              if (card) latestStore.reserveCard(card);
            }
            break;
          }
        }

        // Log the turn
        const afterState = useGameStore.getState() as GameState;
        logTurn({
          turnCount: currentState.turnCount,
          playerIndex,
          provider: config.provider,
          model: config.model,
          action,
          reasoning: result.reasoning,
          playerPoints: [getPlayerPoints(afterState.players[0]), getPlayerPoints(afterState.players[1])],
          actingPlayerBonuses: buildBonusesRecord(afterState, playerIndex),
          actingPlayerTotalGems: getTotalGems(afterState.players[playerIndex]),
          responseTimeMs: result.responseTimeMs,
        });

        setAiState(playerIndex, {
          status: 'done',
          reasoning: result.reasoning,
          actionSummary: summarizeAction(action),
          consecutiveFailures: 0,
        });
      } catch (err) {
        const prev = useGameStore.getState().aiStates[playerIndex].consecutiveFailures;
        const failures = prev + 1;

        if (failures >= 3) {
          // Auto-fallback: use first legal action
          try {
            const fallbackState = useGameStore.getState() as GameState;
            const legalActions = getLegalActions(fallbackState);
            if (legalActions.length > 0) {
              const fallbackAction = legalActions[0];
              const latestStore = useGameStore.getState();
              switch (fallbackAction.type) {
                case 'takeGems':
                  latestStore.takeGems(fallbackAction.colors);
                  break;
                case 'take2Gems':
                  latestStore.take2Gems(fallbackAction.color);
                  break;
                case 'purchaseCard':
                  latestStore.purchaseCard(fallbackAction.card);
                  break;
                case 'reserveCard':
                  latestStore.reserveCard(fallbackAction.source);
                  break;
              }
              setAiState(playerIndex, {
                status: 'done',
                reasoning: ['AI failed 3 times — used automatic fallback action.'],
                actionSummary: 'Fallback action applied',
                consecutiveFailures: 0,
                errorMessage: '',
              });
            }
          } catch {
            setAiState(playerIndex, {
              status: 'error',
              errorMessage: 'AI and fallback both failed',
              consecutiveFailures: failures,
            });
          }
        } else {
          setAiState(playerIndex, {
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'AI request failed',
            consecutiveFailures: failures,
          });
        }
      } finally {
        runningRef.current = false;
      }
    }

    runAiTurn();
  }, [currentPlayerIndex, aiVsAiMode, aiVsAiConfig, phase, pendingDiscard, pendingNobles, aiVsAiPaused, p0Status, p1Status]);

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
