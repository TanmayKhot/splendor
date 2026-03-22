import { useGameStore } from '../store/gameStore';
import { getPlayerPoints } from '../game/selectors';

export default function GameOver() {
  const winner = useGameStore(s => s.winner);
  const resetGame = useGameStore(s => s.resetGame);

  if (!winner) return null;

  return (
    <div className="game-over">
      <h2>{winner.name} Wins!</h2>
      <p className="winner-points">{getPlayerPoints(winner)} prestige points</p>
      <button onClick={resetGame}>Play Again</button>
    </div>
  );
}
