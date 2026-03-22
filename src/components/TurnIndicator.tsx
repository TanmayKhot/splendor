import { useGameStore } from '../store/gameStore';

export default function TurnIndicator() {
  const players = useGameStore(s => s.players);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const phase = useGameStore(s => s.phase);
  const pendingDiscard = useGameStore(s => s.pendingDiscard);
  const pendingNobles = useGameStore(s => s.pendingNobles);

  let message = `${players[currentPlayerIndex].name}'s turn`;
  if (pendingDiscard) message += ' — must discard gems';
  else if (pendingNobles) message += ' — choose a noble';
  if (phase === 'ending') message += ' (final round)';

  return <div className="turn-indicator">{message}</div>;
}
