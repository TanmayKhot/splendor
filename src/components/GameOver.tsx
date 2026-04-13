import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { getPlayerPoints } from '../game/selectors';
import { updateStats } from '../store/profileService';
import type { GameMode } from '../store/profileTypes';

export default function GameOver() {
  const winner = useGameStore(s => s.winner);
  const resetGame = useGameStore(s => s.resetGame);
  const statsRecorded = useRef(false);

  useEffect(() => {
    if (!winner || statsRecorded.current) return;
    statsRecorded.current = true;

    const state = useGameStore.getState();
    const isOnline = state.onlineState !== null;
    const isAi = state.aiMode;

    let mode: GameMode;
    let playerWon: boolean;

    if (isOnline) {
      mode = 'online';
      playerWon = winner.name === state.onlineState!.nickname;
    } else if (isAi) {
      mode = 'ai';
      playerWon = winner.name === state.players[0].name;
    } else {
      mode = 'local';
      playerWon = winner.name === state.players[0].name;
    }

    updateStats(mode, playerWon);
  }, [winner]);

  if (!winner) return null;

  return (
    <div className="game-over">
      <h2>{winner.name} Wins!</h2>
      <p className="winner-points">{getPlayerPoints(winner)} prestige points</p>
      <button onClick={resetGame}>Play Again</button>
    </div>
  );
}
