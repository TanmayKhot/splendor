import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

interface ChatRequest {
  provider: 'anthropic' | 'openai' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string;
  messages: unknown[];
}

app.post('/api/ai/chat', async (req, res) => {
  const { provider, model, apiKey, baseUrl, messages } = req.body as ChatRequest;

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
        messages,
      });
    } else {
      // openai or custom
      url = provider === 'custom' && baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
        : 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      body = JSON.stringify({
        model,
        messages,
      });
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
