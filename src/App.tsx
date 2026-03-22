import './App.css';
import { useGameStore } from './store/gameStore';
import GameSetup from './components/GameSetup';
import TurnIndicator from './components/TurnIndicator';
import NobleRow from './components/NobleRow';
import CardTiers from './components/CardTiers';
import GemPool from './components/GemPool';
import PlayerPanel from './components/PlayerPanel';
import DiscardModal from './components/DiscardModal';
import NobleModal from './components/NobleModal';
import GameOver from './components/GameOver';

function App() {
  const phase = useGameStore(s => s.phase);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);

  if (phase === 'setup') {
    return (
      <div className="app">
        <h1>Splendor</h1>
        <GameSetup />
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div className="app">
        <h1>Splendor</h1>
        <GameOver />
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Splendor</h1>
      <TurnIndicator />
      <div className="board">
        <div className="board-main">
          <NobleRow />
          <CardTiers />
          <GemPool />
        </div>
        <div className="board-side">
          <PlayerPanel playerIndex={0} />
          <PlayerPanel playerIndex={1} />
        </div>
      </div>
      {pendingDiscard && <DiscardModal />}
      {pendingNobles && <NobleModal />}
    </div>
  );
}

export default App;
