import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function GameSetup() {
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const initGame = useGameStore(s => s.initGame);

  const canStart = p1Name.trim() !== '' && p2Name.trim() !== '';

  return (
    <div className="game-setup">
      <h2>New Game</h2>
      <input
        placeholder="Player 1 name"
        value={p1Name}
        onChange={e => setP1Name(e.target.value)}
      />
      <input
        placeholder="Player 2 name"
        value={p2Name}
        onChange={e => setP2Name(e.target.value)}
      />
      <button disabled={!canStart} onClick={() => initGame(p1Name.trim(), p2Name.trim())}>
        Start Game
      </button>
    </div>
  );
}
