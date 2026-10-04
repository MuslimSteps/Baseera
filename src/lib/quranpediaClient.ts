/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live Quranpedia translation client.
 * Quranpedia exposes a read-only API with no authentication requirement.
 * We query it live rather than bulk-copying the translation corpus.
 */

import { fetchRemoteSafely, readTextWithLimit } from './safeRemoteFetch.ts';

const API_BASE = 'https://api.quranpedia.net/v1';
const WEB_BASE = 'https://quranpedia.net';
const cache = new Map<string, any>();

export interface QuranTranslationLanguage {
  id: number;
  name: string;
  en_name: string;
  local_name: string;
  code: string;
  direction: 'rtl' | 'ltr';
}

export interface QuranTranslation {
  language: string;
  bookId?: number;
  bookName: string;
  translator?: string;
  text: string;
}

async function getJson(path: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  if (cache.has(url)) return cache.get(url);
  const response = await fetchRemoteSafely(url, {
    headers: { 'User-Agent': 'Baseera/1.0', Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Quranpedia API returned ${response.status}`);
  const data = JSON.parse(await readTextWithLimit(response, 2_000_000));
  cache.set(url, data);
  return data;
}

export async function getAvailableTranslationLanguages(
  surah: number,
  ayah: number
): Promise<QuranTranslationLanguage[]> {
  const data = await getJson(`/translations/available-languages/${surah}/${ayah}`);
  return Array.isArray(data) ? data : [];
}

export async function getAyahTranslations(
  surah: number,
  ayah: number,
  language?: string
): Promise<Record<string, QuranTranslation[]> | QuranTranslation[]> {
  const suffix = language ? `/${encodeURIComponent(language)}` : '';
  const data = await getJson(`/translations/${surah}/${ayah}${suffix}`);

  if (language) {
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: any) => ({
      language,
      bookId: row?.book?.id,
      bookName: row?.book?.name || row?.book?.short_name || 'ترجمة معتمدة',
      translator: row?.book?.authors?.[0]?.ar_name,
      text: String(row?.['translation-content'] || '').trim()
    })).filter((x: QuranTranslation) => x.text);
  }

  const grouped: Record<string, QuranTranslation[]> = {};
  for (const [code, rows] of Object.entries(data || {})) {
    grouped[code] = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      language: code,
      bookId: row?.book?.id,
      bookName: row?.book?.name || row?.book?.short_name || 'ترجمة معتمدة',
      translator: row?.book?.authors?.[0]?.ar_name,
      text: String(row?.['translation-content'] || '').trim()
    })).filter((x: QuranTranslation) => x.text);
  }
  return grouped;
}

export async function getLanguageCatalog(): Promise<QuranTranslationLanguage[]> {
  const data = await getJson('/translations/languages');
  return Array.isArray(data) ? data : [];
}

export function buildQuranpediaAyahUrl(surah: number, ayah: number): string {
  return `${WEB_BASE}/verse/${surah}/${ayah}`;
}
