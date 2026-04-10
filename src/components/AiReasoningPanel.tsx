import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function AiReasoningPanel() {
  const aiState = useGameStore(s => s.aiState);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const setAiState = useGameStore(s => s.setAiState);

  const [collapsed, setCollapsed] = useState(false);

  const isHumanTurn = currentPlayerIndex === 0;
  const { status, reasoning, actionSummary, errorMessage, consecutiveFailures } = aiState;

  function handleRetry() {
    setAiState({ status: 'idle', errorMessage: '' });
  }

  function handleManualOverride() {
    setAiState({ status: 'idle', errorMessage: 'Manual override — take a turn for the AI.', consecutiveFailures: 0 });
  }

  return (
    <div
      className={`ai-reasoning-panel ${isHumanTurn ? 'dimmed' : ''} ${collapsed ? 'collapsed' : ''}`}
      aria-live="polite"
    >
      <div className="ai-reasoning-header">
        <h4>AI Player</h4>
        <button
          className="ai-reasoning-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show AI thought process' : 'Hide AI thought process'}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="ai-reasoning-body">
          {status === 'idle' && (
            <p className="ai-status-idle">Waiting for AI turn...</p>
          )}

          {status === 'thinking' && (
            <p className="ai-status-thinking">AI is thinking...</p>
          )}

          {status === 'done' && (
            <div className="ai-status-done">
              {actionSummary && <p className="ai-action-summary">{actionSummary}</p>}
              {reasoning.length > 0 && (
                <ul className="ai-reasoning-list">
                  {reasoning.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="ai-status-error">
              <p className="ai-error-msg">{errorMessage || 'Something went wrong.'}</p>
              <div className="ai-error-actions">
                <button className="btn-retry" onClick={handleRetry}>Retry</button>
                {consecutiveFailures >= 3 && (
                  <button className="btn-manual" onClick={handleManualOverride}>
                    Take turn manually
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
