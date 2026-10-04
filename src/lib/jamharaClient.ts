/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live Jamhara terminology source client.
 * Search is performed directly against islamic-content.com/search?query=...
 * and results are accepted only from the Jamhara domain.
 */

import { fetchRemoteSafely, readTextWithLimit } from './safeRemoteFetch.ts';
import { normalizeArabic } from './normalizer.ts';

export interface JamharaLiveResult {
  found: boolean;
  title: string;
  text: string;
  url: string;
  source: string;
}

const cache = new Map<string, JamharaLiveResult | null>();

function cleanHtml(raw: string): string {
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>(?=.)/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchUrl(query: string): string {
  return `https://islamic-content.com/search?query=${encodeURIComponent(query.trim())}`;
}

function matchingDictionaryLink(html: string, query: string): { href: string; title: string } | null {
  const normalizedQuery = normalizeArabic(query).trim();
  if (!normalizedQuery) return null;

  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => ({ href: m[1], title: cleanHtml(m[2]) }))
    .filter(x => {
      try {
        const u = new URL(x.href, 'https://islamic-content.com');
        return u.hostname === 'islamic-content.com' &&
          /^\/dictionary\/word\//.test(u.pathname) &&
          x.title.length >= 2;
      } catch {
        return false;
      }
    });

  const scored = links.map(link => {
    const title = normalizeArabic(link.title);
    const exact = title === normalizedQuery;
    const contains = title.includes(normalizedQuery) || normalizedQuery.includes(title);
    const score = exact ? 100 : contains ? 50 : 0;
    return { link, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

  return scored[0]?.link || null;
}

export async function searchJamharaLive(query: string): Promise<JamharaLiveResult | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const url = searchUrl(q);
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
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => ({
        href: m[1],
        title: cleanHtml(m[2])
      }))
      .filter(x => {
        try {
          const u = new URL(x.href, 'https://islamic-content.com');
          return u.hostname === 'islamic-content.com' &&
            (u.pathname.startsWith('/dictionary') || u.pathname.startsWith('/search')) &&
            x.title.length >= 2;
        } catch {
          return false;
        }
      });

    const nq = normalizeArabic(q);
    const exact = links.find(x => normalizeArabic(x.title) === nq);
    const contains = links.find(x => normalizeArabic(x.title).includes(nq) || nq.includes(normalizeArabic(x.title)));
    let best = exact || contains;

    // Some deployments return a shell/anti-bot page for the query route. Fall
    // back to the public dictionary index, still entirely inside Jamhara, and
    // accept only an actual /dictionary/word/<id> result.
    if (!best) {
      const fallbackUrls = [
        'https://islamic-content.com/dictionary/term/1792',
        'https://islamic-content.com/terms-index'
      ];

      for (const fallbackUrl of fallbackUrls) {
        const fallbackResponse = await fetchRemoteSafely(fallbackUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 Baseera/1.0',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'ar'
          }
        });
        if (!fallbackResponse.ok) continue;

        const fallbackHtml = await readTextWithLimit(fallbackResponse, 3_000_000);
        best = matchingDictionaryLink(fallbackHtml, q);
        if (best) break;
      }
    }

    if (!best) {
      cache.set(key, null);
      return null;
    }

    const articleUrl = new URL(best.href, 'https://islamic-content.com').toString();
    if (!new URL(articleUrl).pathname.startsWith('/dictionary')) {
      cache.set(key, null);
      return null;
    }

    const articleResponse = await fetchRemoteSafely(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar'
      }
    });
    if (!articleResponse.ok) {
      const fallback = {
        found: true,
        title: best.title,
        text: '',
        url: articleUrl,
        source: 'موسوعة الجمهرة — islamic-content.com'
      };
      cache.set(key, fallback);
      return fallback;
    }

    const articleHtml = await readTextWithLimit(articleResponse, 1_500_000);
    const main = articleHtml.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
    const text = cleanHtml(main ? main[1] : articleHtml).slice(0, 5000);

    const result = {
      found: true,
      title: best.title,
      text,
      url: articleUrl,
      source: 'موسوعة الجمهرة — islamic-content.com'
    };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export function buildJamharaSearchUrl(query: string): string {
  return searchUrl(query);
}
