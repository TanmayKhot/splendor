import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { AiProvider, AiVsAiConfig } from '../ai/aiTypes';
import { getToken } from '../online/socketClient';
import { loadProfile, updateProfile, updateProviderConfig } from '../store/profileService';
import OnlineLobby from './OnlineLobby';
import RulesModal from './RulesModal';
import SettingsModal from './SettingsModal';

const PROVIDER_MODELS: Partial<Record<AiProvider, { id: string; label: string }[]>> = {
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { id: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
    { id: 'claude-sonnet-4-0', label: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-0', label: 'Claude Opus 4' },
  ],
  openai: [
    { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
    { id: 'gpt-5.4', label: 'GPT-5.4' },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
    { id: 'gpt-5-thinking', label: 'GPT-5 Thinking' },
    { id: 'gpt-5-thinking-mini', label: 'GPT-5 Thinking Mini' },
    { id: 'gpt-5-thinking-nano', label: 'GPT-5 Thinking Nano' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
    { id: 'o4-mini', label: 'o4-mini' },
    { id: 'o3-pro', label: 'o3-pro' },
    { id: 'o3', label: 'o3' },
    { id: 'o3-mini', label: 'o3-mini' },
    { id: 'o1-pro', label: 'o1-pro' },
    { id: 'o1', label: 'o1' },
    { id: 'o1-preview', label: 'o1-preview' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite (Preview)' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
};

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'custom', label: 'Custom' },
];

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.4-pro',
  gemini: 'gemini-2.5-flash',
  openrouter: 'anthropic/claude-sonnet-4',
  custom: 'gpt-4o',
};

interface AiConfigPickerProps {
  label: string;
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  onProviderChange: (p: AiProvider) => void;
  onModelChange: (m: string) => void;
  onApiKeyChange: (k: string) => void;
  onBaseUrlChange: (u: string) => void;
}

function AiConfigPicker({ label, provider, model, apiKey, baseUrl, onProviderChange, onModelChange, onApiKeyChange, onBaseUrlChange }: AiConfigPickerProps) {
  return (
    <div className="ai-config">
      <div className="ai-player-label">{label}</div>
      <label className="ai-field">
        <span>Provider</span>
        <select value={provider} onChange={e => {
          const p = e.target.value as AiProvider;
          onProviderChange(p);
          const saved = loadProfile().apiKeys[p];
          onModelChange(saved?.model || DEFAULT_MODELS[p]);
          onApiKeyChange(saved?.apiKey || '');
          onBaseUrlChange(saved?.baseUrl || '');
        }}>
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>

      <label className="ai-field">
        <span>Model</span>
        {PROVIDER_MODELS[provider] ? (
          <select value={model} onChange={e => onModelChange(e.target.value)}>
            {PROVIDER_MODELS[provider]!.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        ) : (
          <input
            value={model}
            onChange={e => onModelChange(e.target.value)}
            placeholder="Model name"
          />
        )}
      </label>

      <label className="ai-field">
        <span>API Key</span>
        <input
          type="password"
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder="Enter API key"
        />
      </label>

      {provider === 'custom' && (
        <label className="ai-field">
          <span>Base URL</span>
          <input
            value={baseUrl}
            onChange={e => onBaseUrlChange(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </label>
      )}
    </div>
  );
}

export default function GameSetup() {
  const [savedProfile] = useState(() => loadProfile());
  const savedProviderConfig = savedProfile.apiKeys[savedProfile.preferredProvider];
  const [p1Name, setP1Name] = useState(savedProfile.playerName);
  const [p2Name, setP2Name] = useState('');
  const [inviteCode] = useState(() => {
    const match = window.location.pathname.match(/^\/room\/([A-Z0-9]{6})$/i);
    return match ? match[1].toUpperCase() : '';
  });
  const [mode, setMode] = useState<'local' | 'ai' | 'online' | 'ai-vs-ai'>(inviteCode ? 'online' : 'local');
  const [provider, setProvider] = useState<AiProvider>(savedProfile.preferredProvider);
  const [model, setModel] = useState(savedProviderConfig?.model || DEFAULT_MODELS[savedProfile.preferredProvider]);
  const [apiKey, setApiKey] = useState(savedProviderConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(savedProviderConfig?.baseUrl || '');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // AI vs AI state
  const [p0Provider, setP0Provider] = useState<AiProvider>(savedProfile.preferredProvider);
  const [p0Model, setP0Model] = useState(savedProviderConfig?.model || DEFAULT_MODELS[savedProfile.preferredProvider]);
  const [p0ApiKey, setP0ApiKey] = useState(savedProviderConfig?.apiKey || '');
  const [p0BaseUrl, setP0BaseUrl] = useState(savedProviderConfig?.baseUrl || '');
  const [p1Provider, setP1Provider] = useState<AiProvider>(savedProfile.preferredProvider);
  const [p1Model, setP1Model] = useState(savedProviderConfig?.model || DEFAULT_MODELS[savedProfile.preferredProvider]);
  const [p1ApiKey, setP1ApiKey] = useState(savedProviderConfig?.apiKey || '');
  const [p1BaseUrl, setP1BaseUrl] = useState(savedProviderConfig?.baseUrl || '');
  const initGame = useGameStore(s => s.initGame);

  const isAi = mode === 'ai';
  const isOnline = mode === 'online';
  const isAiVsAi = mode === 'ai-vs-ai';
  const canStart = isAiVsAi
    ? p0ApiKey.trim() !== '' && p1ApiKey.trim() !== ''
    : p1Name.trim() !== '' && (
        isAi
          ? apiKey.trim() !== ''
          : !isOnline && p2Name.trim() !== ''
      );

  function handleProviderChange(newProvider: AiProvider) {
    setProvider(newProvider);
    const saved = loadProfile().apiKeys[newProvider];
    setModel(saved?.model || DEFAULT_MODELS[newProvider]);
    setApiKey(saved?.apiKey || '');
    setBaseUrl(saved?.baseUrl || '');
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
    if (isAiVsAi) {
      const config: AiVsAiConfig = {
        player0: {
          provider: p0Provider,
          model: p0Model,
          apiKey: p0ApiKey,
          ...(p0Provider === 'custom' ? { baseUrl: p0BaseUrl } : {}),
        },
        player1: {
          provider: p1Provider,
          model: p1Model,
          apiKey: p1ApiKey,
          ...(p1Provider === 'custom' ? { baseUrl: p1BaseUrl } : {}),
        },
      };
      initGame('', '', false, undefined, true, config);
      return;
    }

    updateProfile({ playerName: p1Name.trim(), preferredProvider: provider });
    if (isAi) {
      updateProviderConfig(provider, {
        apiKey,
        model,
        ...(provider === 'custom' ? { baseUrl } : {}),
      });
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
      {showSettings && <SettingsModal onClose={() => {
        setShowSettings(false);
        const fresh = loadProfile();
        const freshConfig = fresh.apiKeys[fresh.preferredProvider];
        setP1Name(fresh.playerName);
        setProvider(fresh.preferredProvider);
        setModel(freshConfig?.model || DEFAULT_MODELS[fresh.preferredProvider]);
        setApiKey(freshConfig?.apiKey || '');
        setBaseUrl(freshConfig?.baseUrl || '');
      }} />}

      {!inviteCode && (
        <>
          <h2>New Game</h2>
          <div className="setup-top-buttons">
            <button type="button" className="btn-rules" onClick={() => setShowRules(true)}>
              How to Play
            </button>
            <button type="button" className="btn-rules" onClick={() => setShowSettings(true)}>
              Settings
            </button>
          </div>

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
            <button
              type="button"
              className={`mode-option ${mode === 'ai-vs-ai' ? 'active' : ''}`}
              onClick={() => setMode('ai-vs-ai')}
            >
              AI vs AI
            </button>
          </div>
        </>
      )}

      {isOnline ? (
        <OnlineLobby inviteCode={inviteCode} />
      ) : isAiVsAi ? (
        <>
          <div className="ai-vs-ai-config">
            <AiConfigPicker
              label="Player 1 (AI)"
              provider={p0Provider}
              model={p0Model}
              apiKey={p0ApiKey}
              baseUrl={p0BaseUrl}
              onProviderChange={setP0Provider}
              onModelChange={setP0Model}
              onApiKeyChange={setP0ApiKey}
              onBaseUrlChange={setP0BaseUrl}
            />
            <AiConfigPicker
              label="Player 2 (AI)"
              provider={p1Provider}
              model={p1Model}
              apiKey={p1ApiKey}
              baseUrl={p1BaseUrl}
              onProviderChange={setP1Provider}
              onModelChange={setP1Model}
              onApiKeyChange={setP1ApiKey}
              onBaseUrlChange={setP1BaseUrl}
            />
          </div>
          <button disabled={!canStart} onClick={handleStart}>
            Start AI vs AI
          </button>
        </>
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
                  {PROVIDER_MODELS[provider] ? (
                    <select value={model} onChange={e => setModel(e.target.value)}>
                      {PROVIDER_MODELS[provider]!.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      placeholder="Model name"
                    />
                  )}
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
