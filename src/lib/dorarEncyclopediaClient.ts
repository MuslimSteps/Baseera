/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live clients for the approved Dorar tafsir and aqeedah encyclopedias.
 *
 * Search is intentionally source-scoped. When the site blocks automated access
 * or parsing is inconclusive, the client returns no evidence instead of
 * inventing a result.
 */

import { fetchRemoteSafely, readTextWithLimit } from './safeRemoteFetch.ts';
import { normalizeArabic } from './normalizer.ts';

export type DorarEncyclopediaKind = 'tafsir' | 'aqeedah';

export interface DorarEncyclopediaResult {
  found: boolean;
  title: string;
  text: string;
  url: string;
  source: string;
  kind: DorarEncyclopediaKind;
}

const cache = new Map<string, DorarEncyclopediaResult | null>();

function cleanHtml(raw: string): string {
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchUrl(kind: DorarEncyclopediaKind, query: string): string {
  const endpoint = kind === 'aqeedah' ? 'aqeeda' : 'tafseer';
  return `https://dorar.net/${endpoint}/search?q=${encodeURIComponent(query.trim())}`;
}
function allowedPath(kind: DorarEncyclopediaKind, href: string): boolean {
  try {
    const url = new URL(href, 'https://dorar.net');
    const prefix = kind === 'aqeedah' ? '/aqeeda/' : '/tafseer/';
    return url.hostname === 'dorar.net' && url.pathname.startsWith(prefix) && !url.pathname.endsWith('/search');
  } catch {
    return false;
  }
}

async function search(kind: DorarEncyclopediaKind, query: string): Promise<DorarEncyclopediaResult | null> {
  const cleanQuery = query.trim().slice(0, 160);
  if (!cleanQuery) return null;
  const key = `${kind}:${cleanQuery}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const { execFile } = await import('child_process');
    const path = await import('path');
    const scriptPath = path.resolve(process.cwd(), 'src/lib/dorar_encyclopedia.py');

    return await new Promise<DorarEncyclopediaResult | null>((resolve) => {
      execFile(
        process.platform === 'win32' ? 'python' : 'python3',
        [scriptPath, kind, cleanQuery],
        { timeout: 12000, encoding: 'utf-8' },
        (error, stdout) => {
          if (error || !stdout) return resolve(null);
          try {
            const data = JSON.parse(stdout);
            if (data && data.found) {
              const res: DorarEncyclopediaResult = {
                found: true,
                title: data.title,
                text: data.text,
                url: data.url,
                source: data.source,
                kind
              };
              cache.set(key, res);
              return resolve(res);
            }
            cache.set(key, null);
            resolve(null);
          } catch {
            cache.set(key, null);
            resolve(null);
          }
        }
      );
    });
  } catch {
    cache.set(key, null);
    return null;
  }
}

export function buildDorarAqeedahUrl(query: string): string {
  return searchUrl('aqeedah', query);
}

export function buildDorarTafsirUrl(query: string): string {
  return searchUrl('tafsir', query);
}

export function searchDorarAqeedahLive(query: string) {
  return search('aqeedah', query);
}

export function searchDorarTafsirLive(query: string) {
  return search('tafsir', query);
}
