/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Islamic Content MCP client (approved ecosystem endpoint).
 *
 * Connects Baseera to the approved Model Context Protocol server:
 *     islamic-content-mcp  →  https://mcp.islamiccontent.org/mcp
 *
 * It speaks the MCP "Streamable HTTP" transport (JSON-RPC 2.0 over POST with
 * either a JSON or text/event-stream response). The server is READ-ONLY and
 * returns published texts from approved institutions; it neither issues fatwas
 * nor authors content — so it is used strictly as a source-retrieval layer.
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpStatus {
  reachable: boolean;
  url: string;
  server_name?: string;
  server_version?: string;
  tools: McpTool[];
  error?: string;
}

const MCP_URL =
  process.env.ISLAMIC_CONTENT_MCP_URL || 'https://mcp.islamiccontent.org/mcp';

let sessionId: string | null = null;
let requestCounter = 0;

function nextId(): number {
  requestCounter += 1;
  return requestCounter;
}

/** Parses a possibly-SSE MCP response body into the JSON-RPC payload. */
function parseMcpBody(contentType: string, body: string): any {
  const text = body.trim();
  if (!text) return null;

  if (contentType.includes('text/event-stream') || text.startsWith('event:')) {
    // SSE: collect `data:` lines and take the last JSON object.
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(dataLines[i]);
      } catch {
        /* keep scanning */
      }
    }
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function mcpRpc(method: string, params: Record<string, unknown> = {}, timeoutMs = 12000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'User-Agent': 'Baseera-Verification/1.0 (+https://islamic-aich.org)'
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  try {
    const response = await fetch(MCP_URL, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params })
    });

    const newSession = response.headers.get('mcp-session-id');
    if (newSession) sessionId = newSession;

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`MCP ${method} failed (HTTP ${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = parseMcpBody(contentType, body);
    if (payload?.error) {
      throw new Error(payload.error.message || `MCP ${method} returned an error`);
    }
    return payload?.result ?? payload;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureInitialized(): Promise<void> {
  if (sessionId) return;
  await mcpRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'baseera', version: '1.0.0' }
  });
  // Best-effort notification (ignored if the server does not require it).
  try {
    await mcpRpc('notifications/initialized', {}, 4000);
  } catch {
    /* notification failures are non-fatal */
  }
}

export async function listIslamicContentTools(): Promise<McpTool[]> {
  await ensureInitialized();
  const result = await mcpRpc('tools/list', {});
  return Array.isArray(result?.tools) ? result.tools : [];
}

export async function callIslamicContentTool(
  name: string,
  args: Record<string, unknown> = {},
  timeoutMs = 15000
): Promise<any> {
  if (!name) throw new Error('MCP tool name is required.');
  await ensureInitialized();
  return mcpRpc('tools/call', { name, arguments: args }, timeoutMs);
}

export interface IslamicContentResult {
  id: string;
  title: string;
  url: string;
}

export interface IslamicContentDocument {
  id: string;
  title: string;
  text: string;
  url: string;
  segments?: Array<{ kind: string; text: string; label?: string }>;
  metadata?: Record<string, unknown>;
}

export type IslamicContentSource = 'quran' | 'hadith' | 'library';

function extractStructured(raw: any): any {
  if (raw?.structuredContent) return raw.structuredContent;
  // Fallback: the first text content item often carries a JSON payload.
  const first = raw?.content?.find?.((c: any) => c?.type === 'text');
  if (first?.text) {
    try {
      return JSON.parse(first.text);
    } catch {
      /* not JSON */
    }
  }
  return null;
}

/**
 * Full-text search across approved corpora (Quran / Hadith / IslamHouse
 * library). Returns ranked results with canonical citation URLs.
 */
export async function searchIslamicContent(opts: {
  query: string;
  sources?: IslamicContentSource[];
  language?: string;
  limit?: number;
}): Promise<IslamicContentResult[]> {
  const args: Record<string, unknown> = { query: opts.query };
  if (opts.sources?.length) args.sources = opts.sources;
  if (opts.language) args.language = opts.language;
  if (opts.limit) args.limit = Math.min(Math.max(opts.limit, 1), 25);

  const raw = await callIslamicContentTool('search', args);
  const structured = extractStructured(raw);
  const results = structured?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r: any) => r && typeof r.url === 'string')
    .map((r: any) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      url: String(r.url)
    }));
}

/** Reads a single document in full (text + attribution + commentary). */
export async function fetchIslamicContent(id: string): Promise<IslamicContentDocument | null> {
  if (!id) return null;
  const raw = await callIslamicContentTool('fetch', { id }, 20000);
  const structured = extractStructured(raw);
  if (!structured) return null;
  return {
    id: String(structured.id ?? id),
    title: String(structured.title ?? ''),
    text: String(structured.text ?? ''),
    url: String(structured.url ?? ''),
    segments: Array.isArray(structured.segments) ? structured.segments : undefined,
    metadata: structured.metadata || undefined
  };
}

/**
 * Hadith-specific retrieval via the approved HadeethEnc corpus:
 * returns the best canonical narration (with grade + attribution + permalink).
 */
export async function searchHadeethEnc(
  query: string,
  language = 'ar',
  limit = 5
): Promise<IslamicContentDocument[]> {
  const results = await searchIslamicContent({ query, sources: ['hadith'], language, limit });
  const hadithResults = results.filter((r) => r.id.startsWith('hadith:'));
  const docs: IslamicContentDocument[] = [];
  for (const r of hadithResults.slice(0, 3)) {
    const doc = await fetchIslamicContent(r.id);
    if (doc) docs.push(doc);
  }
  return docs;
}

export async function getIslamicContentMcpStatus(): Promise<McpStatus> {
  const base: McpStatus = { reachable: false, url: MCP_URL, tools: [] };
  try {
    await ensureInitialized();
    const init = await mcpRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'baseera', version: '1.0.0' }
    }, 8000);
    const tools = await listIslamicContentTools();
    return {
      ...base,
      reachable: true,
      server_name: init?.serverInfo?.name,
      server_version: init?.serverInfo?.version,
      tools
    };
  } catch (err: any) {
    return { ...base, error: err?.message || String(err) };
  }
}
