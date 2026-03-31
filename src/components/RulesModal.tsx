interface RulesModalProps {
  onClose: () => void;
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={e => e.stopPropagation()}>
        <button className="rules-close" onClick={onClose} aria-label="Close rules">✕</button>

        <h2 className="rules-title">How to Play Splendor</h2>

        <div className="rules-content">
          <section className="rules-section">
            <h3>Objective</h3>
            <p>
              Be the first player to reach <strong>15 prestige points</strong>. Points come from
              development cards and noble tiles you collect during the game.
            </p>
          </section>

          <section className="rules-section">
            <h3>Components</h3>
            <div className="rules-images">
              <div className="rules-image-block">
                <img src="/gems.png" alt="Gem tokens" className="rules-img" />
                <span className="rules-img-caption">Gem Tokens</span>
              </div>
              <div className="rules-image-block">
                <img src="/cards.png" alt="Development cards" className="rules-img" />
                <span className="rules-img-caption">Development Cards</span>
              </div>
            </div>
            <ul>
              <li><strong>Gem tokens</strong> — 5 colors (white, blue, green, red, black) + gold wildcards</li>
              <li><strong>Development cards</strong> — 90 cards across 3 tiers; each gives a permanent gem bonus and may award prestige points</li>
              <li><strong>Noble tiles</strong> — 3 nobles in play; automatically visit you when you meet their card bonus requirements</li>
            </ul>
          </section>

          <section className="rules-section">
            <h3>On Your Turn — Choose One Action</h3>
            <ol>
              <li>
                <strong>Take 3 different gems</strong> — Pick 1 token each of 3 different colors
                (only if at least 3 colors are available).
              </li>
              <li>
                <strong>Take 2 gems of the same color</strong> — Only allowed if that color has
                at least 4 tokens in the supply.
              </li>
              <li>
                <strong>Reserve a card</strong> — Take any visible card or the top of a face-down
                deck; receive 1 gold token. You may hold at most 3 reserved cards.
              </li>
              <li>
                <strong>Buy a card</strong> — Purchase a visible card or one you've reserved.
                Pay its gem cost using your tokens and/or card bonuses. Gold tokens are wildcards.
              </li>
            </ol>
          </section>

          <section className="rules-section">
            <h3>Card Bonuses</h3>
            <p>
              Each purchased card gives you a permanent discount of 1 gem of its color.
              Bonuses stack — 3 red cards means you effectively have 3 free red gems when
              paying for any future card.
            </p>
          </section>

          <section className="rules-section">
            <h3>Noble Tiles</h3>
            <p>
              At the end of your turn, if your purchased card bonuses meet a noble's requirements,
              that noble visits you automatically and awards <strong>3 prestige points</strong>.
              If multiple nobles qualify, you choose one.
            </p>
          </section>

          <section className="rules-section">
            <h3>Gem Limit</h3>
            <p>
              You may never hold more than <strong>10 gem tokens</strong> at a time.
              If you exceed 10 after taking gems, you must immediately discard down to 10.
            </p>
          </section>

          <section className="rules-section">
            <h3>End of Game</h3>
            <p>
              When any player reaches 15+ points, the current round finishes so both players
              have played the same number of turns. The player with the most points wins.
              Tiebreaker: fewest purchased cards wins; if still tied, Player 2 wins.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
