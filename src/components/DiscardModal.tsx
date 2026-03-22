import { useState } from 'react';
import type { GemColor, GemCost } from '../game/types';
import { COLORED_GEMS, MAX_GEMS_IN_HAND } from '../game/constants';
import { useGameStore } from '../store/gameStore';
import { getTotalGems } from '../game/selectors';

const ALL_GEMS: GemColor[] = [...COLORED_GEMS, 'gold'];

export default function DiscardModal() {
  const player = useGameStore(s => s.players[s.currentPlayerIndex]);
  const discardGems = useGameStore(s => s.discardGems);
  const [toDiscard, setToDiscard] = useState<Record<GemColor, number>>({
    white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0,
  });

  const totalDiscarding = Object.values(toDiscard).reduce((a, b) => a + b, 0);
  const totalAfter = getTotalGems(player) - totalDiscarding;
  const canConfirm = totalAfter <= MAX_GEMS_IN_HAND && totalDiscarding > 0;

  function addDiscard(color: GemColor) {
    if (toDiscard[color] < player.gems[color]) {
      setToDiscard({ ...toDiscard, [color]: toDiscard[color] + 1 });
    }
  }

  function removeDiscard(color: GemColor) {
    if (toDiscard[color] > 0) {
      setToDiscard({ ...toDiscard, [color]: toDiscard[color] - 1 });
    }
  }

  function handleConfirm() {
    const gems: GemCost = {};
    for (const color of ALL_GEMS) {
      if (toDiscard[color] > 0) {
        gems[color] = toDiscard[color];
      }
    }
    discardGems(gems);
    setToDiscard({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Discard Gems</h2>
        <p>You have {getTotalGems(player)} gems. Discard down to {MAX_GEMS_IN_HAND}.</p>
        <div className="discard-gems">
          {ALL_GEMS.map(color => {
            if (player.gems[color] === 0) return null;
            return (
              <div key={color} style={{ textAlign: 'center' }}>
                <button
                  className={`discard-gem gem-${color}`}
                  onClick={() => addDiscard(color)}
                >
                  {player.gems[color] - toDiscard[color]}
                </button>
                {toDiscard[color] > 0 && (
                  <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                    <span style={{ color: '#dc2626' }}>-{toDiscard[color]}</span>
                    {' '}
                    <button
                      style={{ fontSize: '0.65rem', padding: '1px 4px', background: '#2a3a55', color: '#aabbcc', borderRadius: '3px' }}
                      onClick={() => removeDiscard(color)}
                    >
                      undo
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn-confirm" disabled={!canConfirm} onClick={handleConfirm}>
          Confirm ({totalDiscarding} gem{totalDiscarding !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}
