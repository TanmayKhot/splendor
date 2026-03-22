import { useGameStore } from '../store/gameStore';
import type { NobleTile } from '../game/types';
import type { ColoredGem } from '../game/types';
import { COLORED_GEMS } from '../game/constants';

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
      {nobles.map(n => <NobleCard key={n.id} noble={n} />)}
    </div>
  );
}
