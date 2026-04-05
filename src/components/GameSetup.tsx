import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { AiProvider } from '../ai/aiTypes';
import { getToken } from '../online/socketClient';
import OnlineLobby from './OnlineLobby';
import RulesModal from './RulesModal';

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
  openrouter: 'anthropic/claude-sonnet-4',
  custom: 'gpt-4o',
};

export default function GameSetup() {
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [inviteCode] = useState(() => {
    const match = window.location.pathname.match(/^\/room\/([A-Z0-9]{6})$/i);
    return match ? match[1].toUpperCase() : '';
  });
  const [mode, setMode] = useState<'local' | 'ai' | 'online'>(inviteCode ? 'online' : 'local');
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [showRules, setShowRules] = useState(false);
  const initGame = useGameStore(s => s.initGame);

  const isAi = mode === 'ai';
  const isOnline = mode === 'online';
  const canStart = p1Name.trim() !== '' && (
    isAi
      ? apiKey.trim() !== ''
      : !isOnline && p2Name.trim() !== ''
  );

  function handleProviderChange(newProvider: AiProvider) {
    setProvider(newProvider);
    setModel(DEFAULT_MODELS[newProvider]);
    setTestStatus('idle');
  }

  async function testConnection() {
    setTestStatus('testing');
    setTestError('');
    try {
      const body = {
        provider,
        model,
        ...(apiKey ? { apiKey } : {}),
        baseUrl: provider === 'custom' ? baseUrl : undefined,
        ...(provider === 'anthropic'
          ? { system: 'Reply with OK.', messages: [{ role: 'user', content: 'ping' }] }
          : { messages: [{ role: 'system', content: 'Reply with OK.' }, { role: 'user', content: 'ping' }] }),
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`${res.status}: ${errText}`);
      }
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  function handleStart() {
    if (isAi) {
      initGame(p1Name.trim(), '', true, {
        provider,
        model,
        apiKey,
        ...(provider === 'custom' ? { baseUrl } : {}),
      });
    } else {
      initGame(p1Name.trim(), p2Name.trim());
    }
  }

  return (
    <div className="game-setup">
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {!inviteCode && (
        <>
          <h2>New Game</h2>
          <button type="button" className="btn-rules" onClick={() => setShowRules(true)}>
            How to Play
          </button>

          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-option ${mode === 'local' ? 'active' : ''}`}
              onClick={() => setMode('local')}
            >
              2 Players (Local)
            </button>
            <button
              type="button"
              className={`mode-option ${mode === 'ai' ? 'active' : ''}`}
              onClick={() => setMode('ai')}
            >
              1 Player vs AI
            </button>
            <button
              type="button"
              className={`mode-option ${mode === 'online' ? 'active' : ''}`}
              onClick={() => setMode('online')}
            >
              Play Online
            </button>
          </div>
        </>
      )}

      {isOnline ? (
        <OnlineLobby inviteCode={inviteCode} />
      ) : (
        <>
          <input
            placeholder="Player 1 name"
            value={p1Name}
            onChange={e => setP1Name(e.target.value)}
          />

          {!isAi ? (
            <input
              placeholder="Player 2 name"
              value={p2Name}
              onChange={e => setP2Name(e.target.value)}
            />
          ) : (
            <>
              <div className="ai-player-label">Player 2: AI Player</div>

              <div className="ai-config">
                <label className="ai-field">
                  <span>Provider</span>
                  <select value={provider} onChange={e => handleProviderChange(e.target.value as AiProvider)}>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                <label className="ai-field">
                  <span>Model</span>
                  <input
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="Model name"
                  />
                </label>

                <label className="ai-field">
                  <span>API Key (Required)</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setTestStatus('idle'); }}
                    placeholder="Enter API key"
                  />
                </label>

                {provider === 'custom' && (
                  <label className="ai-field">
                    <span>Base URL</span>
                    <input
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                )}

                <div className="test-connection">
                  <button
                    type="button"
                    className="btn-test"
                    disabled={testStatus === 'testing'}
                    onClick={testConnection}
                  >
                    {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testStatus === 'success' && <span className="test-success">Connected</span>}
                  {testStatus === 'error' && <span className="test-error">{testError || 'Failed'}</span>}
                </div>
              </div>
            </>
          )}

          <button disabled={!canStart} onClick={handleStart}>
            Start Game
          </button>
        </>
      )}
    </div>
  );
}
