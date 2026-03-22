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

  const [selected, setSelected] = useState<ColoredGem[]>([]);

  const blocked = !!pendingDiscard || !!pendingNobles;

  function handleClick(color: GemColor) {
    if (blocked) return;
    if (color === 'gold') return; // gold cannot be taken directly

    const c = color as ColoredGem;

    // If already selected once and supply >= 4, switch to take-2 mode
    if (selected.length === 1 && selected[0] === c && gemSupply[c] >= 4) {
      take2Gems(c);
      setSelected([]);
      return;
    }

    // Toggle selection
    if (selected.includes(c)) {
      setSelected(selected.filter(s => s !== c));
    } else if (selected.length < 3) {
      setSelected([...selected, c]);
    }
  }

  function handleConfirm() {
    if (selected.length > 0) {
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
            Take {selected.length} gem{selected.length !== 1 ? 's' : ''}
          </button>
          <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}
