import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type LastMove } from '../store/gameStore';
import type { GemColor, DevelopmentCard } from '../game/types';
import { COLORED_GEMS } from '../game/constants';

/** Phases: 'highlight' → golden glow at source, then 'fly' → move to destination */
type FlyPhase = 'highlight' | 'fly';

interface FlyingItem {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  type: 'gem' | 'card';
  label?: string;
  phase: FlyPhase;
  /** Full card dimensions from the source element (cards only) */
  cardWidth?: number;
  cardHeight?: number;
  /** Cached card data for rendering full card content in overlay */
  cardData?: DevelopmentCard;
}

interface AnimationContextValue {
  registerGemSource: (color: GemColor, el: HTMLElement | null) => void;
  registerCardSource: (cardId: string, el: HTMLElement | null, cardData?: DevelopmentCard) => void;
  /** Gems currently animating toward a player — key: `${playerIndex}-${color}`, value: count */
  inFlightGems: Map<string, number>;
  /** Card IDs that should be hidden (invisible placeholder) until fly animation completes */
  suppressedCardIds: Set<string>;
}

const AnimationContext = createContext<AnimationContextValue>({
  registerGemSource: () => {},
  registerCardSource: () => {},
  inFlightGems: new Map(),
  suppressedCardIds: new Set(),
});

export const useAnimation = () => useContext(AnimationContext);

let nextId = 0;

const HIGHLIGHT_DURATION = 2500; // ms golden glow before flying
const FLY_DURATION = 1.2; // seconds for the fly animation
const GEM_STAGGER = 300; // ms between each gem starting its highlight

/** Renders card content (points, bonus, cost) inside the flying overlay */
function FlyingCardContent({ card }: { card: DevelopmentCard }) {
  const costs = COLORED_GEMS.filter(c => (card.cost[c] ?? 0) > 0);
  return (
    <>
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
    </>
  );
}

export default function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [inFlightGems, setInFlightGems] = useState<Map<string, number>>(new Map());
  const [suppressedCardIds, setSuppressedCardIds] = useState<Set<string>>(new Set());

  const gemSourceRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardSourceRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardPositionCache = useRef<Map<string, DOMRect>>(new Map());
  const cardDataCache = useRef<Map<string, DevelopmentCard>>(new Map());
  const prevLastMovesRef = useRef<[LastMove | null, LastMove | null]>([null, null]);
  const prevVisibleCardIdsRef = useRef<Set<string>>(new Set());
  /** Callbacks invoked when a flying item's fly phase completes */
  const flyCompleteCallbacks = useRef<Map<number, () => void>>(new Map());

  const registerGemSource = useCallback((color: GemColor, el: HTMLElement | null) => {
    if (el) gemSourceRefs.current.set(color, el);
    else gemSourceRefs.current.delete(color);
  }, []);

  const registerCardSource = useCallback((cardId: string, el: HTMLElement | null, cardData?: DevelopmentCard) => {
    if (el) {
      cardSourceRefs.current.set(cardId, el);
      cardPositionCache.current.set(cardId, el.getBoundingClientRect());
      if (cardData) cardDataCache.current.set(cardId, cardData);
    } else {
      cardSourceRefs.current.delete(cardId);
      // Keep cached position & data — we need them after the element is removed
    }
  }, []);

  // Periodically refresh card position cache for registered cards
  useEffect(() => {
    const interval = setInterval(() => {
      cardSourceRefs.current.forEach((el, cardId) => {
        if (el.isConnected) {
          cardPositionCache.current.set(cardId, el.getBoundingClientRect());
        }
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Initialize previous visible card IDs
  useEffect(() => {
    const state = useGameStore.getState();
    prevVisibleCardIdsRef.current = new Set(state.board.visibleCards.flat().map(c => c.id));
  }, []);

  const addFlyingItems = useCallback((items: Omit<FlyingItem, 'id'>[]) => {
    const newItems = items.map(item => ({ ...item, id: nextId++ }));
    setFlyingItems(prev => [...prev, ...newItems]);
    return newItems.map(i => i.id);
  }, []);

  const removeFlyingItem = useCallback((id: number) => {
    // Fire the fly-complete callback (e.g. decrement in-flight gems, unsuppress cards)
    flyCompleteCallbacks.current.get(id)?.();
    flyCompleteCallbacks.current.delete(id);
    setFlyingItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const transitionToFly = useCallback((id: number) => {
    setFlyingItems(prev => prev.map(item =>
      item.id === id ? { ...item, phase: 'fly' } : item
    ));
  }, []);

  // Watch lastMoves for state changes and trigger animations
  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      const [prev0, prev1] = prevLastMovesRef.current;
      const [cur0, cur1] = state.lastMoves;
      const currentCardIds = new Set(state.board.visibleCards.flat().map(c => c.id));

      const moved0 = cur0 && cur0 !== prev0;
      const moved1 = cur1 && cur1 !== prev1;

      // Only animate if exactly one player moved (prevents old moves from replaying).
      // In online mode, the server broadcasts the full lastMoves array which can contain
      // both players' moves, but only one is new per turn. This ensures we don't replay
      // the opponent's previous move when receiving our own move confirmation.
      if (moved0 && !moved1) {
        triggerAnimationsForMove(cur0, 0, currentCardIds);
      } else if (moved1 && !moved0) {
        triggerAnimationsForMove(cur1, 1, currentCardIds);
      }

      prevLastMovesRef.current = state.lastMoves;
      prevVisibleCardIdsRef.current = currentCardIds;
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function triggerAnimationsForMove(move: LastMove, playerIndex: 0 | 1, currentCardIds: Set<string>) {
    const items: Omit<FlyingItem, 'id'>[] = [];
    // Track gem keys that will be in-flight (one entry per flying item)
    const gemKeys: string[] = [];
    // Card IDs that are new (replacement cards) — captured once before prevVisibleCardIdsRef updates
    let newCardIdsToUnsuppress: string[] = [];

    if (move.type === 'takeGems') {
      for (const color of move.colors) {
        const sourceEl = gemSourceRefs.current.get(color);
        const destEl = document.querySelector(`[data-player="${playerIndex}"][data-gem-dest="${color}"]`);
        if (sourceEl && destEl) {
          const from = sourceEl.getBoundingClientRect();
          const to = destEl.getBoundingClientRect();
          items.push({
            fromX: from.left + from.width / 2,
            fromY: from.top + from.height / 2,
            toX: to.left + to.width / 2,
            toY: to.top + to.height / 2,
            color,
            type: 'gem',
            phase: 'highlight',
          });
          gemKeys.push(`${playerIndex}-${color}`);
        }
      }
    } else if (move.type === 'take2Gems') {
      const sourceEl = gemSourceRefs.current.get(move.color);
      const destEl = document.querySelector(`[data-player="${playerIndex}"][data-gem-dest="${move.color}"]`);
      if (sourceEl && destEl) {
        const from = sourceEl.getBoundingClientRect();
        const to = destEl.getBoundingClientRect();
        for (let i = 0; i < 2; i++) {
          items.push({
            fromX: from.left + from.width / 2 + (i === 0 ? -8 : 8),
            fromY: from.top + from.height / 2,
            toX: to.left + to.width / 2,
            toY: to.top + to.height / 2,
            color: move.color,
            type: 'gem',
            phase: 'highlight',
          });
          gemKeys.push(`${playerIndex}-${move.color}`);
        }
      }
    } else if (move.type === 'purchaseCard' || move.type === 'reserveCard') {
      const cardId = move.cardId;
      let from: DOMRect | undefined;

      if (cardId) {
        from = cardPositionCache.current.get(cardId);
      }
      if (!from) {
        const boardMain = document.querySelector('.board-main');
        if (boardMain) {
          const rect = boardMain.getBoundingClientRect();
          from = new DOMRect(rect.left + rect.width / 2 - 30, rect.top + rect.height / 2 - 35, 60, 70);
        }
      }

      const destEl = document.querySelector(`[data-player="${playerIndex}"]`);
      if (from && destEl) {
        const to = destEl.getBoundingClientRect();
        items.push({
          fromX: from.left + from.width / 2,
          fromY: from.top + from.height / 2,
          toX: to.left + to.width / 2,
          toY: to.top + to.height / 2,
          color: move.gemBonus,
          type: 'card',
          label: move.type === 'purchaseCard'
            ? `${move.prestigePoints}pts`
            : 'R',
          phase: 'highlight',
          cardWidth: from.width,
          cardHeight: from.height,
          cardData: cardId ? cardDataCache.current.get(cardId) : undefined,
        });
      }

      // Detect new cards that replaced the purchased/reserved one — suppress until animation ends
      newCardIdsToUnsuppress = [...currentCardIds].filter(id => !prevVisibleCardIdsRef.current.has(id));
      if (newCardIdsToUnsuppress.length > 0) {
        setSuppressedCardIds(prev => {
          const next = new Set(prev);
          newCardIdsToUnsuppress.forEach(id => next.add(id));
          return next;
        });
      }
    }

    // Mark gems as in-flight immediately (before staggered timeouts)
    if (gemKeys.length > 0) {
      setInFlightGems(prev => {
        const next = new Map(prev);
        for (const key of gemKeys) {
          next.set(key, (next.get(key) ?? 0) + 1);
        }
        return next;
      });
    }

    if (items.length > 0) {
      items.forEach((item, i) => {
        setTimeout(() => {
          const ids = addFlyingItems([item]);

          // Register fly-complete callbacks
          ids.forEach(id => {
            if (item.type === 'gem') {
              const key = gemKeys[i];
              flyCompleteCallbacks.current.set(id, () => {
                setInFlightGems(prev => {
                  const next = new Map(prev);
                  const count = (next.get(key) ?? 1) - 1;
                  if (count <= 0) next.delete(key);
                  else next.set(key, count);
                  return next;
                });
              });
            } else if (item.type === 'card') {
              // Use pre-captured newCardIdsToUnsuppress — prevVisibleCardIdsRef is already stale by now
              flyCompleteCallbacks.current.set(id, () => {
                if (newCardIdsToUnsuppress.length > 0) {
                  setSuppressedCardIds(prev => {
                    const next = new Set(prev);
                    newCardIdsToUnsuppress.forEach(cid => next.delete(cid));
                    return next;
                  });
                }
              });
            }
          });

          // After highlight duration, transition to fly phase
          setTimeout(() => {
            ids.forEach(id => transitionToFly(id));
          }, HIGHLIGHT_DURATION);
        }, i * GEM_STAGGER);
      });
    }
  }

  return (
    <AnimationContext.Provider value={{ registerGemSource, registerCardSource, inFlightGems, suppressedCardIds }}>
      {children}
      {/* Flying items overlay */}
      <div className="fly-overlay">
        <AnimatePresence>
          {flyingItems.map(item => {
            const isCard = item.type === 'card';
            const cardStyle = isCard && item.cardWidth
              ? { width: item.cardWidth, height: item.cardHeight, borderRadius: 10 }
              : undefined;

            return item.phase === 'highlight' ? (
              <motion.div
                key={item.id}
                className={
                  isCard && item.cardData
                    ? `flying-item flying-card card card-color-${item.color} flying-highlight`
                    : `flying-item flying-${item.type} gem-${item.color} flying-highlight`
                }
                style={cardStyle}
                initial={{
                  left: item.fromX,
                  top: item.fromY,
                  scale: 1,
                  opacity: 1,
                  x: '-50%',
                  y: '-50%',
                }}
                animate={{
                  scale: isCard
                    ? [1, 1.02, 1, 1.02, 1, 1.02, 1]
                    : [1, 1.2, 1, 1.2, 1, 1.2, 1],
                }}
                transition={{
                  duration: HIGHLIGHT_DURATION / 1000,
                  ease: 'easeInOut',
                }}
              >
                {isCard && item.cardData ? (
                  <FlyingCardContent card={item.cardData} />
                ) : (
                  item.label && <span className="flying-card-label">{item.label}</span>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={item.id}
                className={
                  isCard && item.cardData
                    ? `flying-item flying-card card card-color-${item.color}`
                    : `flying-item flying-${item.type} gem-${item.color}`
                }
                style={cardStyle}
                initial={{
                  left: item.fromX,
                  top: item.fromY,
                  scale: isCard ? 1.02 : 1.15,
                  opacity: 1,
                  x: '-50%',
                  y: '-50%',
                }}
                animate={{
                  left: item.toX,
                  top: item.toY,
                  scale: isCard ? 0.3 : 0.7,
                  opacity: 0.8,
                  x: '-50%',
                  y: '-50%',
                }}
                exit={{ opacity: 0, scale: 0.2 }}
                transition={{
                  duration: FLY_DURATION,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                onAnimationComplete={() => removeFlyingItem(item.id)}
              >
                {isCard && item.cardData ? (
                  <FlyingCardContent card={item.cardData} />
                ) : (
                  item.label && <span className="flying-card-label">{item.label}</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AnimationContext.Provider>
  );
}
