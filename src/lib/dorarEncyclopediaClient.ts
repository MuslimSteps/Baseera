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
  const root = kind === 'aqeedah' ? 'aqeeda' : 'tafseer';
  return `https://dorar.net/${root}/search?skeys=${encodeURIComponent(query.trim())}`;
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

  const url = searchUrl(kind, cleanQuery);
  try {
    const response = await fetchRemoteSafely(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar'
      }
    });
    if (!response.ok) {
      cache.set(key, null);
      return null;
    }

    const html = await readTextWithLimit(response, 2_000_000);

    // Accept only links that remain inside the requested Dorar encyclopedia.
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => ({
        href: m[1],
        title: cleanHtml(m[2]),
      }))
      .filter(x => x.title.length >= 8 && allowedPath(kind, x.href))
      .slice(0, 12);

    if (links.length === 0) {
      cache.set(key, null);
      return null;
    }

    // Rank exact phrase / token overlap; never use a weak unrelated result.
    const qWords = cleanQuery.split(/\s+/).filter(w => w.length >= 3);
    const ranked = links.map(link => {
      const titleLower = link.title;
      const score = qWords.reduce((sum, word) => sum + (titleLower.includes(word) ? 2 : 0), 0)
        + (link.title.includes(cleanQuery) ? 10 : 0);
      return { ...link, score };
    }).sort((a,b) => b.score - a.score);

    const best = ranked[0];
    if (best.score < Math.max(2, qWords.length)) {
      cache.set(key, null);
      return null;
    }

    const articleUrl = new URL(best.href, 'https://dorar.net').toString();
    const articleResponse = await fetchRemoteSafely(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar'
      }
    });
    if (!articleResponse.ok) {
      const fallback = { found: true, title: best.title, text: '', url: articleUrl, source: kind === 'aqeedah' ? 'الموسوعة العقدية — الدرر السنية' : 'موسوعة التفسير — الدرر السنية', kind };
      cache.set(key, fallback);
      return fallback;
    }

    const articleHtml = await readTextWithLimit(articleResponse, 2_000_000);
    const mainMatch = articleHtml.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
    const text = cleanHtml(mainMatch ? mainMatch[1] : articleHtml).slice(0, 5000);

    const result = {
      found: true,
      title: best.title,
      text,
      url: articleUrl,
      source: kind === 'aqeedah' ? 'الموسوعة العقدية — الدرر السنية' : 'موسوعة التفسير — الدرر السنية',
      kind
    };
    cache.set(key, result);
    return result;
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
