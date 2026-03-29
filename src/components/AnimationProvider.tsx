import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type LastMove } from '../store/gameStore';
import type { GemColor } from '../game/types';

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
}

interface AnimationContextValue {
  registerGemSource: (color: GemColor, el: HTMLElement | null) => void;
  registerCardSource: (cardId: string, el: HTMLElement | null) => void;
}

const AnimationContext = createContext<AnimationContextValue>({
  registerGemSource: () => {},
  registerCardSource: () => {},
});

export const useAnimation = () => useContext(AnimationContext);

let nextId = 0;

const HIGHLIGHT_DURATION = 1500; // ms golden glow before flying
const FLY_DURATION = 0.7; // seconds for the fly animation
const GEM_STAGGER = 150; // ms between each gem starting its highlight

export default function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const gemSourceRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardSourceRefs = useRef<Map<string, HTMLElement>>(new Map());
  // Snapshot card positions every frame so we have them after state updates
  const cardPositionCache = useRef<Map<string, DOMRect>>(new Map());
  const prevLastMovesRef = useRef<[LastMove | null, LastMove | null]>([null, null]);

  const registerGemSource = useCallback((color: GemColor, el: HTMLElement | null) => {
    if (el) gemSourceRefs.current.set(color, el);
    else gemSourceRefs.current.delete(color);
  }, []);

  const registerCardSource = useCallback((cardId: string, el: HTMLElement | null) => {
    if (el) {
      cardSourceRefs.current.set(cardId, el);
      // Cache position immediately
      cardPositionCache.current.set(cardId, el.getBoundingClientRect());
    } else {
      cardSourceRefs.current.delete(cardId);
      // Keep cached position — we need it after the element is removed
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

  const addFlyingItems = useCallback((items: Omit<FlyingItem, 'id'>[]) => {
    const newItems = items.map(item => ({ ...item, id: nextId++ }));
    setFlyingItems(prev => [...prev, ...newItems]);
    return newItems.map(i => i.id);
  }, []);

  const removeFlyingItem = useCallback((id: number) => {
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

      if (cur0 && cur0 !== prev0) {
        triggerAnimationsForMove(cur0, 0);
      }
      if (cur1 && cur1 !== prev1) {
        triggerAnimationsForMove(cur1, 1);
      }

      prevLastMovesRef.current = state.lastMoves;
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function triggerAnimationsForMove(move: LastMove, playerIndex: 0 | 1) {
    const items: Omit<FlyingItem, 'id'>[] = [];

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
        }
      }
    } else if (move.type === 'purchaseCard' || move.type === 'reserveCard') {
      // Use cached card position (card may already be removed from DOM)
      const cardId = 'cardId' in move ? (move as any).cardId : undefined;
      let from: DOMRect | undefined;

      // Try to find the card element in the cache
      if (cardId) {
        from = cardPositionCache.current.get(cardId);
      }
      // Fallback: scan all cached positions for any card with matching gemBonus
      if (!from) {
        // Use the most recent card position from the board area
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
        });
      }
    }

    if (items.length > 0) {
      // Stagger items: each starts its highlight phase with a delay
      items.forEach((item, i) => {
        setTimeout(() => {
          const ids = addFlyingItems([item]);
          // After highlight duration, transition to fly phase
          setTimeout(() => {
            ids.forEach(id => transitionToFly(id));
          }, HIGHLIGHT_DURATION);
        }, i * GEM_STAGGER);
      });
    }
  }

  return (
    <AnimationContext.Provider value={{ registerGemSource, registerCardSource }}>
      {children}
      {/* Flying items overlay */}
      <div className="fly-overlay">
        <AnimatePresence>
          {flyingItems.map(item => (
            item.phase === 'highlight' ? (
              <motion.div
                key={item.id}
                className={`flying-item flying-${item.type} gem-${item.color} flying-highlight`}
                initial={{
                  left: item.fromX,
                  top: item.fromY,
                  scale: 1,
                  opacity: 1,
                  x: '-50%',
                  y: '-50%',
                }}
                animate={{
                  scale: [1, 1.15, 1, 1.15, 1],
                }}
                transition={{
                  duration: HIGHLIGHT_DURATION / 1000,
                  ease: 'easeInOut',
                }}
              >
                {item.label && <span>{item.label}</span>}
              </motion.div>
            ) : (
              <motion.div
                key={item.id}
                className={`flying-item flying-${item.type} gem-${item.color}`}
                initial={{
                  left: item.fromX,
                  top: item.fromY,
                  scale: 1.15,
                  opacity: 1,
                  x: '-50%',
                  y: '-50%',
                }}
                animate={{
                  left: item.toX,
                  top: item.toY,
                  scale: 0.7,
                  opacity: 0.8,
                  x: '-50%',
                  y: '-50%',
                }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{
                  duration: FLY_DURATION,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                onAnimationComplete={() => removeFlyingItem(item.id)}
              >
                {item.label && <span>{item.label}</span>}
              </motion.div>
            )
          ))}
        </AnimatePresence>
      </div>
    </AnimationContext.Provider>
  );
}
