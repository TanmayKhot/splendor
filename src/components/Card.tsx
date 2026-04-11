import { useCallback } from 'react';
import type { DevelopmentCard } from '../game/types';
import { COLORED_GEMS } from '../game/constants';
import { canAfford } from '../game/selectors';
import { useGameStore } from '../store/gameStore';
import { useAnimation } from './AnimationProvider';

interface CardProps {
  card: DevelopmentCard;
  showActions?: boolean;
  showLabel?: boolean;
}

export default function Card({ card, showActions = true, showLabel = false }: CardProps) {
  const player = useGameStore(s => s.players[s.currentPlayerIndex]);
  const { registerCardSource } = useAnimation();
  const cardRef = useCallback((el: HTMLElement | null) => {
    registerCardSource(card.id, el, card);
  }, [card, registerCardSource]);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const purchaseCard = useGameStore(s => s.purchaseCard);
  const reserveCard = useGameStore(s => s.reserveCard);
  const onlineState = useGameStore(s => s.onlineState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);

  const goldSupply = useGameStore(s => s.board.gemSupply.gold);
  const reservedCount = useGameStore(s => s.players[s.currentPlayerIndex].reserved.length);

  const affordable = canAfford(card, player);
  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;
  const blocked = !!pendingDiscard || !!pendingNobles || !isMyTurn;
  const canReserve = goldSupply > 0 && reservedCount < 3;

  const costs = COLORED_GEMS.filter(c => (card.cost[c] ?? 0) > 0);

  return (
    <div ref={cardRef} className={`card card-color-${card.gemBonus}`}>
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
            disabled={blocked || !canReserve}
            onClick={() => reserveCard(card)}
          >
            Reserve
          </button>
        </div>
      )}
    </div>
  );
}
