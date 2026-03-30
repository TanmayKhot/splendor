import { useGameStore } from '../store/gameStore';
import type { CardTier } from '../game/types';
import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';
import { useAnimation } from './AnimationProvider';

const TIERS: CardTier[] = [3, 2, 1]; // display highest tier first
const MAX_VISIBLE = 4; // max visible cards per tier

export default function CardTiers() {
  const visibleCards = useGameStore(s => s.board.visibleCards);
  const decks = useGameStore(s => s.board.decks);
  const reserveCard = useGameStore(s => s.reserveCard);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);
  const aiMode = useGameStore(s => s.aiMode);
  const onlineState = useGameStore(s => s.onlineState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);

  const { highlightedCardIds } = useAnimation();

  const isMyTurn = !onlineState || onlineState.myPlayerIndex === currentPlayerIndex;
  const blocked = !!pendingDiscard || !!pendingNobles || !isMyTurn;

  return (
    <div className="card-tiers">
      {TIERS.map(tier => {
        const tierIdx = tier - 1;
        const cards = visibleCards[tierIdx];
        const deckSize = decks[tierIdx].length;

        // Build fixed-position slots: cards at their index, empty slots for gaps
        const slots = Array.from({ length: MAX_VISIBLE }, (_, i) => {
          return cards[i] ?? null;
        });

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
            {slots.map((card, i) =>
              card ? (
                <div key={`${tier}-${i}`} className={`card-slot${highlightedCardIds.has(card.id) ? ' card-slot-highlighted' : ''}`}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.25 }}
                      style={{ display: 'flex', flex: 1 }}
                    >
                      <Card card={card} showLabel={aiMode} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <div key={`${tier}-${i}`} className="card-slot card-slot-empty" />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
