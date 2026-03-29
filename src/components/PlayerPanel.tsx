import type { GemColor, ColoredGem } from '../game/types';
import { COLORED_GEMS } from '../game/constants';
import { useGameStore, type LastMove } from '../store/gameStore';
import { getPlayerBonuses, getPlayerPoints, canAfford } from '../game/selectors';

const ALL_GEMS: GemColor[] = [...COLORED_GEMS, 'gold'];

function formatLastMove(move: LastMove): string {
  switch (move.type) {
    case 'takeGems': {
      const counts: Partial<Record<string, number>> = {};
      for (const c of move.colors) counts[c] = (counts[c] ?? 0) + 1;
      const parts = Object.entries(counts).map(([c, n]) => `${n} ${c}`);
      return `Took ${parts.join(', ')}`;
    }
    case 'take2Gems':
      return `Took 2 ${move.color}`;
    case 'reserveCard':
      return `Reserved ${move.gemBonus} card${move.prestigePoints > 0 ? ` (${move.prestigePoints} pts)` : ''}`;
    case 'purchaseCard': {
      const costParts = (Object.entries(move.cost) as [ColoredGem, number][])
        .filter(([, n]) => n > 0)
        .map(([c, n]) => `${n} ${c}`);
      return `Bought ${move.gemBonus} card (${move.prestigePoints} pts) for ${costParts.join(', ') || 'free'}`;
    }
  }
}

export default function PlayerPanel({ playerIndex }: { playerIndex: 0 | 1 }) {
  const player = useGameStore(s => s.players[playerIndex]);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const purchaseCard = useGameStore(s => s.purchaseCard);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const aiMode = useGameStore(s => s.aiMode);
  const aiModel = useGameStore(s => s.aiConfig?.model);
  const onlineState = useGameStore(s => s.onlineState);
  const lastMove = useGameStore(s => s.lastMoves[playerIndex]);

  const isActive = currentPlayerIndex === playerIndex;
  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;
  const points = getPlayerPoints(player);
  const bonuses = getPlayerBonuses(player);
  const blocked = !!pendingDiscard || !!pendingNobles || !isMyTurn;
  const totalGems = ALL_GEMS.reduce((sum, c) => sum + (player.gems[c] ?? 0), 0);

  return (
    <div className="player-panel-wrapper" data-player={playerIndex}>
      <div className={`player-panel ${isActive ? 'active' : ''}`}>
        <h3>
          {player.name}
          {aiMode && playerIndex === 1 && aiModel && (
            <span className="ai-model-name">({aiModel})</span>
          )}
          {' '}<span className="player-points">({points} pts)</span>
        </h3>

        {/* Gems + Bonuses aligned grid */}
        <div className="player-gems-header">Gems: {totalGems}/10</div>
        <div className="player-gem-grid">
          {COLORED_GEMS.map(color => (
            <div key={color} className="player-gem-col">
              <span
                className={`player-gem gem-${color} ${player.gems[color] > 0 ? '' : 'empty'}`}
                data-player={playerIndex}
                data-gem-dest={color}
              >
                {player.gems[color] > 0 ? player.gems[color] : ''}
              </span>
              <span
                className={`player-bonus gem-${color} ${bonuses[color] > 0 ? 'has-bonus' : ''}`}
              >
                {bonuses[color]}
              </span>
            </div>
          ))}
          {player.gems.gold > 0 && (
            <div className="player-gem-col">
              <span className="player-gem gem-gold">{player.gems.gold}</span>
              <span className="player-bonus-placeholder" />
            </div>
          )}
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
                    {aiMode && <span className="card-label">{card.id}</span>}
                    <span className={`card-bonus gem-${card.gemBonus}`}>
                      {card.gemBonus[0].toUpperCase()}
                    </span>
                    <span className="reserved-card-points">{card.prestigePoints} pts</span>
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

      {/* Last move — separate card to the right */}
      {lastMove && (
        <div className="player-last-move">
          <span className="last-move-label">Last move</span>
          <span className="last-move-text">{formatLastMove(lastMove)}</span>
        </div>
      )}
    </div>
  );
}
