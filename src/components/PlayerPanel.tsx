import type { GemColor } from '../game/types';
import { COLORED_GEMS } from '../game/constants';
import { useGameStore } from '../store/gameStore';
import { getPlayerBonuses, getPlayerPoints, canAfford } from '../game/selectors';

const ALL_GEMS: GemColor[] = [...COLORED_GEMS, 'gold'];

export default function PlayerPanel({ playerIndex }: { playerIndex: 0 | 1 }) {
  const player = useGameStore(s => s.players[playerIndex]);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const purchaseCard = useGameStore(s => s.purchaseCard);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);

  const isActive = currentPlayerIndex === playerIndex;
  const points = getPlayerPoints(player);
  const bonuses = getPlayerBonuses(player);
  const blocked = !!pendingDiscard || !!pendingNobles;

  return (
    <div className={`player-panel ${isActive ? 'active' : ''}`}>
      <h3>
        {player.name} <span className="player-points">({points} pts)</span>
      </h3>

      {/* Gems */}
      <div className="player-gems">
        {ALL_GEMS.map(color => (
          player.gems[color] > 0 ? (
            <span key={color} className={`player-gem gem-${color}`}>
              {player.gems[color]}
            </span>
          ) : null
        ))}
      </div>

      {/* Bonuses */}
      <div className="player-bonuses">
        {COLORED_GEMS.map(color => (
          <span
            key={color}
            className={`player-bonus gem-${color} ${bonuses[color] > 0 ? 'has-bonus' : ''}`}
          >
            {bonuses[color]}
          </span>
        ))}
      </div>

      {/* Nobles */}
      {player.nobles.length > 0 && (
        <div className="player-nobles">
          {player.nobles.map(n => (
            <span key={n.id} className="player-noble">{n.prestigePoints}pts</span>
          ))}
        </div>
      )}

      {/* Reserved cards */}
      {player.reserved.length > 0 && (
        <div className="reserved-cards">
          <h4>Reserved ({player.reserved.length})</h4>
          <div className="reserved-list">
            {player.reserved.map(card => {
              const affordable = canAfford(card, player);
              return (
                <div key={card.id} className="reserved-card">
                  <span className={`card-bonus gem-${card.gemBonus}`}>
                    {card.gemBonus[0].toUpperCase()}
                  </span>
                  <span className="reserved-card-points">{card.prestigePoints}pts</span>
                  <span style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {COLORED_GEMS
                      .filter(c => (card.cost[c] ?? 0) > 0)
                      .map(c => (
                        <span key={c} className={`cost-gem gem-${c}`}>
                          {card.cost[c]}
                        </span>
                      ))}
                  </span>
                  {isActive && (
                    <div className="card-actions">
                      <button
                        className="btn-buy"
                        disabled={!affordable || blocked}
                        onClick={() => purchaseCard(card)}
                      >
                        Buy
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
