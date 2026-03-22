import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

interface ChatRequest {
  provider: 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string;
  system?: string;
  messages: unknown[];
}

app.post('/api/ai/chat', async (req, res) => {
  const { provider, model, apiKey, baseUrl, system, messages } = req.body as ChatRequest;

  if (!provider || !model || !apiKey || !messages) {
    res.status(400).json({ error: 'Missing required fields: provider, model, apiKey, messages' });
    return;
  }

  try {
    let url: string;
    let headers: Record<string, string>;
    let body: string;

    if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      body = JSON.stringify({
        model,
        max_tokens: 1024,
        ...(system ? { system } : {}),
        messages,
      });
    } else if (provider === 'gemini') {
      // Gemini uses generateContent endpoint with a different body shape
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      // Convert OpenAI-style messages to Gemini contents format
      const contents: { role: string; parts: { text: string }[] }[] = [];
      let systemInstruction: { parts: { text: string }[] } | undefined;
      for (const msg of messages as { role: string; content: string }[]) {
        if (msg.role === 'system') {
          systemInstruction = { parts: [{ text: msg.content }] };
        } else {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }
      body = JSON.stringify({
        ...(systemInstruction ? { systemInstruction } : {}),
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      });
    } else if (provider === 'openrouter') {
      // OpenRouter uses OpenAI-compatible API
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      body = JSON.stringify({ model, messages });
    } else {
      // openai or custom
      url = provider === 'custom' && baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
        : 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      body = JSON.stringify({ model, messages });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: `Proxy error: ${message}` });
  }
});

app.listen(PORT, () => {
  console.log(`AI proxy server running on http://localhost:${PORT}`);
});
