import { useGameStore } from '../store/gameStore';
import type { CardTier } from '../game/types';
import Card from './Card';

const TIERS: CardTier[] = [3, 2, 1]; // display highest tier first

export default function CardTiers() {
  const visibleCards = useGameStore(s => s.board.visibleCards);
  const decks = useGameStore(s => s.board.decks);
  const reserveCard = useGameStore(s => s.reserveCard);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const aiMode = useGameStore(s => s.aiMode);
  const onlineState = useGameStore(s => s.onlineState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);

  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;
  const blocked = !!pendingDiscard || !!pendingNobles || !isMyTurn;

  return (
    <div className="card-tiers">
      {TIERS.map(tier => {
        const tierIdx = tier - 1;
        const cards = visibleCards[tierIdx];
        const deckSize = decks[tierIdx].length;

        return (
          <div key={tier} className="card-tier">
            <button
              className="deck-button"
              disabled={deckSize === 0 || blocked}
              onClick={() => reserveCard({ fromDeck: tier })}
            >
              <span>Tier {tier}</span>
              <span className="deck-count">{deckSize}</span>
            </button>
            {cards.map(card => (
              <Card key={card.id} card={card} showLabel={aiMode} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
