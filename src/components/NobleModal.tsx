import { useGameStore } from '../store/gameStore';
import { COLORED_GEMS } from '../game/constants';
import type { NobleTile, ColoredGem } from '../game/types';

function NobleOption({ noble, onSelect }: { noble: NobleTile; onSelect: () => void }) {
  const reqs = COLORED_GEMS.filter(c => (noble.requirement[c] ?? 0) > 0);
  return (
    <div className="noble-choice" onClick={onSelect}>
      <div className="noble-tile">
        <div className="points">{noble.prestigePoints}</div>
        <div className="requirement">
          {reqs.map(color => (
            <span key={color} className={`req-gem gem-${color}`}>
              {noble.requirement[color as ColoredGem]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NobleModal() {
  const aiVsAiMode = useGameStore(s => s.aiVsAiMode);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const selectNoble = useGameStore(s => s.selectNoble);
  const onlineState = useGameStore(s => s.onlineState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const currentPlayerName = useGameStore(s => s.players[currentPlayerIndex].name);

  if (aiVsAiMode) return null;
  if (!pendingNobles) return null;

  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;

  if (!isMyTurn) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <h2>Noble Visit</h2>
          <p>{currentPlayerName} is choosing a noble card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Choose a Noble</h2>
        <p>You qualify for a noble visit!</p>
        <div className="noble-choices">
          {pendingNobles.map(noble => (
            <NobleOption key={noble.id} noble={noble} onSelect={() => selectNoble(noble)} />
          ))}
        </div>
      </div>
    </div>
  );
}
