import type { DevelopmentCard } from '../game/types';
import { COLORED_GEMS } from '../game/constants';
import { canAfford } from '../game/selectors';
import { useGameStore } from '../store/gameStore';

interface CardProps {
  card: DevelopmentCard;
  showActions?: boolean;
  showLabel?: boolean;
}

export default function Card({ card, showActions = true, showLabel = false }: CardProps) {
  const player = useGameStore(s => s.players[s.currentPlayerIndex]);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const purchaseCard = useGameStore(s => s.purchaseCard);
  const reserveCard = useGameStore(s => s.reserveCard);
  const onlineState = useGameStore(s => s.onlineState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);

  const affordable = canAfford(card, player);
  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;
  const blocked = !!pendingDiscard || !!pendingNobles || !isMyTurn;

  const costs = COLORED_GEMS.filter(c => (card.cost[c] ?? 0) > 0);

  return (
    <div className={`card card-color-${card.gemBonus}`}>
      {showLabel && <span className="card-label">{card.id}</span>}
      <div className="card-header">
        <span className="card-points">{card.prestigePoints || ''}</span>
        <span className={`card-bonus gem-${card.gemBonus}`}>{card.gemBonus[0].toUpperCase()}</span>
      </div>
      <div className="card-cost">
        {costs.map(color => (
          <span key={color} className={`cost-gem gem-${color}`}>
            {card.cost[color]}
          </span>
        ))}
      </div>
      {showActions && (
        <div className="card-actions">
          <button
            className="btn-buy"
            disabled={!affordable || blocked}
            onClick={() => purchaseCard(card)}
          >
            Buy
          </button>
          <button
            className="btn-reserve"
            disabled={blocked}
            onClick={() => reserveCard(card)}
          >
            Reserve
          </button>
        </div>
      )}
    </div>
  );
}
