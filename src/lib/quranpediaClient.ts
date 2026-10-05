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


export interface QuranMushafIndex {
  id: number;
  name: string;
  rawi?: { id?: number; name?: string; full_name?: string; };
}

export interface QuranMushafAyah {
  id: number;
  number: number;
  surah: number;
  page_number?: number;
  text: string;
  marker?: string;
  options?: string[];
}

export interface QuranMushafSurah {
  id: number;
  name: string;
  coded_name?: string;
  ayahs: QuranMushafAyah[];
}

export interface QuranMushaf {
  id: number;
  name: string;
  surahs: QuranMushafSurah[];
}

let hafsMushafPromise: Promise<QuranMushaf> | null = null;

const HAFS_MUSHAF_ID = 1;

/**
 * Quranpedia currently documents the Hafs mushaf as ID 1.
 * Keeping this identifier fixed avoids making single-ayah verification
 * depend on an extra metadata request to /mushafs.
 */
async function getHafsMushafId(): Promise<number> {
  return HAFS_MUSHAF_ID;
}

/**
 * Fetch the Hafs mushaf dynamically from Quranpedia metadata.
 * The application does not assume a fixed mushaf ID.
 */
export async function getHafsMushaf(): Promise<QuranMushaf> {
  if (!hafsMushafPromise) {
    hafsMushafPromise = getHafsMushafId()
      .then(id => getJson(`/mushafs/${id}`, 10_000_000))
      .then((data: any) => {
        if (!data || !Array.isArray(data.surahs)) {
          throw new Error('Quranpedia returned an invalid Hafs mushaf payload');
        }
        return data as QuranMushaf;
      })
      .catch(error => {
        hafsMushafPromise = null;
        throw error;
      });
  }
  return hafsMushafPromise;
}

export function extractAyahRefsFromHtml(html: string): Array<{ surah: number; ayah: number }> {
  const refs = new Set<string>();

  const add = (surahValue: string | undefined, ayahValue: string | undefined) => {
    const surah = Number(surahValue);
    const ayah = Number(ayahValue);
    if (Number.isInteger(surah) && surah >= 1 && surah <= 114 && Number.isInteger(ayah) && ayah >= 1) {
      refs.add(`${surah}:${ayah}`);
    }
  };

  for (const match of html.matchAll(/\/verse\/(\d+)\/(\d+)/gi)) add(match[1], match[2]);
  for (const match of html.matchAll(/\/surah\/(\d+)(?:\/[^"'<>?#]*)?[^"'<>]*[?&](?:ayah_id|ayah)=(\d+)/gi)) add(match[1], match[2]);
  for (const match of html.matchAll(/\/ayahs?\/(\d+)\/(\d+)/gi)) add(match[1], match[2]);

  for (const tagMatch of html.matchAll(/<[^>]+>/gi)) {
    const tag = tagMatch[0];
    const surahMatch = tag.match(/data-surah(?:-id)?=["'](\d+)["']/i);
    const ayahMatch = tag.match(/data-(?:ayah|ayah-number|ayah_id|ayah-id)=["'](\d+)["']/i);
    add(surahMatch?.[1], ayahMatch?.[1]);
  }

  return Array.from(refs).map(ref => {
    const [surah, ayah] = ref.split(':').map(Number);
    return { surah, ayah };
  });
}

async function fetchAyahSearchHtml(url: string): Promise<string | null> {
  const response = await fetchRemoteSafely(url, {
    headers: {
      'User-Agent': 'Baseera/1.0',
      'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en;q=0.9'
    }
  });
  if (!response.ok) return null;
  return readTextWithLimit(response, 1_500_000);
}

export async function searchHafsAyahsLive(query: string, limit = 12): Promise<QuranMushafAyah[]> {
  const clean = String(query || '')
    .replace(/[«»"“”؟?.,!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  if (!clean || clean.length < 2) return [];

  const refs = new Set<string>();
  let successfulSourceResponse = false;

  const primaryUrls = [
    `https://api.quranpedia.net/search?query=${encodeURIComponent(clean)}&fragment=1&type=ayah`,
    `https://quranpedia.net/search?query=${encodeURIComponent(clean)}&fragment=1&type=ayah`
  ];

  for (const url of primaryUrls) {
    try {
      const html = await fetchAyahSearchHtml(url);
      if (html !== null) {
        successfulSourceResponse = true;
        for (const ref of extractAyahRefsFromHtml(html)) refs.add(`${ref.surah}:${ref.ayah}`);
      }
      if (refs.size >= limit) break;
    } catch (error) {
      console.warn('[BASEERA][QURAN][SEARCH_ERROR]', error);
    }
  }

  if (refs.size === 0) {
    const words = clean.split(/\s+/)
      .filter(word => word.length >= 4)
      .sort((a, b) => b.length - a.length)
      .slice(0, 4);

    for (const word of words) {
      try {
        const html = await fetchAyahSearchHtml(`https://quranpedia.net/word/${encodeURIComponent(word)}`);
        if (html !== null) {
          successfulSourceResponse = true;
          for (const ref of extractAyahRefsFromHtml(html)) refs.add(`${ref.surah}:${ref.ayah}`);
        }
        if (refs.size >= limit) break;
      } catch (error) {
        console.warn('[BASEERA][QURAN][WORD_SEARCH_ERROR]', error);
      }
    }
  }

  if (!successfulSourceResponse) throw new Error('تعذر الوصول إلى بحث Quranpedia المباشر.');

  const selected = Array.from(refs).slice(0, limit);
  const canonicalRows = await Promise.all(selected.map(async ref => {
    const [surah, ayah] = ref.split(':').map(Number);
    return Number.isInteger(surah) && Number.isInteger(ayah) ? await getHafsAyah(surah, ayah) : null;
  }));

  const resolvedRows = canonicalRows.filter((row): row is QuranMushafAyah => Boolean(row));
  if (selected.length > 0 && resolvedRows.length === 0) {
    throw new Error('تعذر جلب نص الآية من واجهة Quranpedia المعتمدة.');
  }

  return resolvedRows;
}
export async function getHafsSurah(surah: number): Promise<QuranMushafAyah[]> {
  try {
    const data = await getJson(`/mushafs/${HAFS_MUSHAF_ID}/${surah}`);
    return Array.isArray(data) ? data as QuranMushafAyah[] : [];
  } catch {
    return [];
  }
}

export async function getHafsAyah(surah: number, ayah: number): Promise<QuranMushafAyah | null> {
  try {
    const mushafId = await getHafsMushafId();
    const data = await getJson(`/mushafs/${mushafId}/${surah}/${ayah}`);
    if (!data || typeof data.text !== 'string') return null;
    return data as QuranMushafAyah;
  } catch {
    return null;
  }
}
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

async function getJson(path: string, maxBytes = 2_000_000): Promise<any> {
  const url = `${API_BASE}${path}`;
  if (cache.has(url)) return cache.get(url);
  const response = await fetchRemoteSafely(url, {
    headers: { 'User-Agent': 'Baseera/1.0', Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Quranpedia API returned ${response.status}`);
  const data = JSON.parse(await readTextWithLimit(response, maxBytes));
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
