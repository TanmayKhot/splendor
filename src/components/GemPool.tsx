import { useState } from 'react';
import type { ColoredGem, GemColor } from '../game/types';
import { COLORED_GEMS } from '../game/constants';
import { useGameStore } from '../store/gameStore';

const ALL_GEMS: GemColor[] = [...COLORED_GEMS, 'gold'];

export default function GemPool() {
  const gemSupply = useGameStore(s => s.board.gemSupply);
  const takeGems = useGameStore(s => s.takeGems);
  const take2Gems = useGameStore(s => s.take2Gems);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const onlineState = useGameStore(s => s.onlineState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);

  const [selected, setSelected] = useState<ColoredGem[]>([]);

  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;
  const blocked = !!pendingDiscard || !!pendingNobles || !isMyTurn;

  const isTake2 = selected.length === 2 && selected[0] === selected[1];

  function handleClick(color: GemColor) {
    if (blocked) return;
    if (color === 'gold') return; // gold cannot be taken directly

    const c = color as ColoredGem;

    // If already selected once and supply >= 4, enter take-2 mode (add second copy)
    if (selected.length === 1 && selected[0] === c && gemSupply[c] >= 4) {
      setSelected([c, c]);
      return;
    }

    // If in take-2 mode, clicking the same gem again deselects back to 1
    if (isTake2 && selected[0] === c) {
      setSelected([c]);
      return;
    }

    // Toggle selection (only distinct colors for normal take)
    if (selected.includes(c)) {
      setSelected(selected.filter(s => s !== c));
    } else if (selected.length < 3 && !isTake2) {
      setSelected([...selected, c]);
    }
  }

  function handleConfirm() {
    if (isTake2) {
      take2Gems(selected[0]);
      setSelected([]);
    } else if (selected.length > 0) {
      takeGems(selected);
      setSelected([]);
    }
  }

  function handleCancel() {
    setSelected([]);
  }

  return (
    <div className="gem-pool">
      <h3>Gem Supply</h3>
      <div className="gem-tokens">
        {ALL_GEMS.map(color => (
          <button
            key={color}
            className={`gem-token gem-${color} ${selected.includes(color as ColoredGem) ? 'selected' : ''}`}
            disabled={blocked || color === 'gold' || gemSupply[color] === 0}
            onClick={() => handleClick(color)}
          >
            {gemSupply[color]}
            <span className="token-label">{color}</span>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="gem-selection-actions">
          <button className="btn-confirm" onClick={handleConfirm}>
            Take {isTake2 ? `2 ${selected[0]}` : `${selected.length} gem${selected.length !== 1 ? 's' : ''}`}
          </button>
          <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}
