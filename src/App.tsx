import { useState } from 'react';
import './App.css';
import { useGameStore } from './store/gameStore';
import { getSocket, clearStoredRoom } from './online/socketClient';
import GameSetup from './components/GameSetup';
import TurnIndicator from './components/TurnIndicator';
import NobleRow from './components/NobleRow';
import CardTiers from './components/CardTiers';
import GemPool from './components/GemPool';
import PlayerPanel from './components/PlayerPanel';
import DiscardModal from './components/DiscardModal';
import NobleModal from './components/NobleModal';
import GameOver from './components/GameOver';
import AiPlayerController from './components/AiPlayerController';
import AiReasoningPanel from './components/AiReasoningPanel';
import PasswordGate from './components/PasswordGate';
import ConnectionBanner from './components/ConnectionBanner';
import SettingsModal from './components/SettingsModal';
import AnimationProvider from './components/AnimationProvider';

function AppContent() {
  const phase = useGameStore(s => s.phase);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const aiMode = useGameStore(s => s.aiMode);
  const aiThinking = useGameStore(s => s.aiMode && s.currentPlayerIndex === 1 && s.aiState.status === 'thinking');
  const onlineState = useGameStore(s => s.onlineState);
  const resetGame = useGameStore(s => s.resetGame);
  const opponentLeftMessage = useGameStore(s => s.opponentLeftMessage);
  const [showSettings, setShowSettings] = useState(false);

  function handleQuit() {
    if (onlineState) {
      const socket = getSocket();
      socket.emit('room:leave', { code: onlineState.roomCode });
      clearStoredRoom();
      useGameStore.setState({ onlineState: null });
    }
    resetGame();
  }

  function dismissOpponentLeft() {
    useGameStore.setState({ opponentLeftMessage: null });
  }

  if (phase === 'setup') {
    return (
      <div className="app">
        <h1><a href="/" onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/'); window.location.reload(); }}>Splendor</a></h1>
        {opponentLeftMessage && (
          <div className="modal-overlay">
            <div className="modal opponent-left-modal">
              <p>{opponentLeftMessage}</p>
              <button className="btn-confirm" onClick={dismissOpponentLeft}>OK</button>
            </div>
          </div>
        )}
        <GameSetup />
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div className="app">
        <h1>Splendor</h1>
        <GameOver />
        <button type="button" className="btn-settings" onClick={() => setShowSettings(true)}>
          Settings
        </button>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  return (
    <>
      {onlineState && (
        <ConnectionBanner
          connectionStatus={onlineState.connectionStatus}
          opponentConnected={onlineState.opponentConnected}
        />
      )}
      <div className={`app ${aiThinking ? 'ai-turn-active' : ''}`}>
        <div className="game-header">
          <h1>Splendor</h1>
          <button className="btn-quit" onClick={handleQuit}>Quit Game</button>
        </div>
        <TurnIndicator />
        {aiMode && <AiPlayerController />}
        <div className="board">
          <div className="board-main">
            <NobleRow />
            <CardTiers />
            <GemPool />
          </div>
          <div className="board-side">
            <PlayerPanel playerIndex={0} />
            <PlayerPanel playerIndex={1} />
            {aiMode && <AiReasoningPanel />}
          </div>
        </div>
        {pendingDiscard && <DiscardModal />}
        {pendingNobles && <NobleModal />}
      </div>
    </>
  );
}

function App() {
  return (
    <PasswordGate>
      <AnimationProvider>
        <AppContent />
      </AnimationProvider>
    </PasswordGate>
  );
}

export default App;
