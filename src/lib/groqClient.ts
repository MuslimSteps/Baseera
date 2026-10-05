/**
 * Groq AI client for Baseera.
 *
 * Security:
 * - GROQ_API_KEY is read only from the server environment.
 * - Request bodies may not provide or override the server API key.
 * - No secret is stored in source control.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1';
export const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';
export const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';
export const GROQ_AUDIO_MODEL = 'whisper-large-v3-turbo';

function getGroqKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

async function groqRequest(path: string, init: RequestInit): Promise<Response> {
  const key = getGroqKey();
  if (!key) throw new Error('GROQ_API_KEY is not configured on the server.');

  const response = await fetch(`${GROQ_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response;
}

export async function groqChat(
  messages: any[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  try {
    const response = await groqRequest('/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || GROQ_TEXT_MODEL,
        messages,
        temperature: options.temperature ?? 0.1,
        max_completion_tokens: options.maxTokens ?? 2048,
        reasoning_effort: options.reasoningEffort ?? 'medium',
        ...(options.json ? { response_format: { type: 'json_object' } } : {})
      })
    });
    const data = await response.json() as any;
    return String(data?.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function groqVisionText(
  base64: string,
  mimeType: string,
  prompt: string,
  timeoutMs = 15000
): Promise<string> {
  const cleanBase64 = base64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
  return groqChat(
    [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${cleanBase64}` }
        }
      ]
    }],
    {
      model: GROQ_VISION_MODEL,
      temperature: 0,
      maxTokens: 4096,
      timeoutMs
    }
  );
}

export async function groqTranscribe(
  base64: string,
  mimeType: string,
  filename = 'audio.webm',
  language = 'ar'
): Promise<string> {
  const binary = Buffer.from(base64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ''), 'base64');
  const form = new FormData();
  form.append('file', new Blob([binary], { type: mimeType }), filename);
  form.append('model', GROQ_AUDIO_MODEL);
  form.append('language', language);

  const response = await groqRequest('/audio/transcriptions', {
    method: 'POST',
    body: form
  });
  const data = await response.json() as any;
  return String(data?.text || '').trim();
}
