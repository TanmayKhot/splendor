import { useGameStore } from '../store/gameStore';
import type { NobleTile } from '../game/types';
import type { ColoredGem } from '../game/types';
import { COLORED_GEMS } from '../game/constants';
import { AnimatePresence, motion } from 'framer-motion';

function NobleCard({ noble }: { noble: NobleTile }) {
  const reqs = COLORED_GEMS.filter(c => (noble.requirement[c] ?? 0) > 0);
  return (
    <div className="noble-tile">
      <div className="points">{noble.prestigePoints}</div>
      <div className="requirement">
        {reqs.map(color => (
          <span key={color} className={`req-gem gem-${color}`}>
            {noble.requirement[color as ColoredGem]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function NobleRow() {
  const nobles = useGameStore(s => s.board.nobles);
  return (
    <div className="noble-row">
      <h3>Nobles</h3>
      <AnimatePresence>
        {nobles.map(n => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.3 }}
          >
            <NobleCard noble={n} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
