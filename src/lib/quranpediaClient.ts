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
let hafsMushafIdPromise: Promise<number> | null = null;

async function getHafsMushafId(): Promise<number> {
  if (!hafsMushafIdPromise) {
    hafsMushafIdPromise = getJson('/mushafs')
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) {
          throw new Error('Quranpedia returned an invalid mushaf index');
        }

        const hafs = rows.find((row: any) => {
          const rawiName = String(row?.rawi?.full_name || row?.rawi?.name || '').toLowerCase();
          const name = String(row?.name || '').toLowerCase();
          return rawiName.includes('حفص') || name.includes('حفص');
        });

        const id = Number(hafs?.id);
        if (!Number.isInteger(id) || id < 1) {
          throw new Error('Hafs mushaf was not found in Quranpedia metadata');
        }
        return id;
      })
      .catch(error => {
        hafsMushafIdPromise = null;
        throw error;
      });
  }

  return hafsMushafIdPromise;
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

export async function searchHafsAyahsLive(query: string, limit = 12): Promise<QuranMushafAyah[]> {
  const clean = String(query || '').replace(/[«»"“”؟?.,!]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!clean || clean.length < 2) return [];

  // Quranpedia's current HTML search endpoint is intended for live search.
  // We only use it to discover ayah references; canonical text is always
  // fetched from the official /v1/mushafs/{id}/{surah}/{ayah} endpoint.
  const url = `https://api.quranpedia.net/search?query=${encodeURIComponent(clean)}&fragment=1&type=ayah`;

  try {
    const response = await fetchRemoteSafely(url, {
      headers: {
        'User-Agent': 'Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9'
      }
    });

    if (!response.ok) return [];
    const html = await readTextWithLimit(response, 1_500_000);
    if (!html) return [];

    const refs = new Set<string>();

    // Support common Quranpedia result-link forms and data attributes.
    for (const match of html.matchAll(/\/verse\/(\d+)\/(\d+)/gi)) {
      refs.add(`${match[1]}:${match[2]}`);
    }
    for (const match of html.matchAll(/\/surah\/(?:\d+\/)?(\d+)[^"'<>]*[?&]ayah_id=(\d+)/gi)) {
      refs.add(`${match[1]}:${match[2]}`);
    }
    for (const match of html.matchAll(/data-surah(?:-id)?=["'](\d+)["'][^>]*data-(?:ayah|ayah-number|ayah_id)=["'](\d+)["']/gi)) {
      refs.add(`${match[1]}:${match[2]}`);
    }

    const selected = Array.from(refs).slice(0, limit);
    const rows = await Promise.all(
      selected.map(async ref => {
        const [surah, ayah] = ref.split(':').map(Number);
        return Number.isInteger(surah) && Number.isInteger(ayah)
          ? await getHafsAyah(surah, ayah)
          : null;
      })
    );

    return rows.filter((row): row is QuranMushafAyah => Boolean(row));
  } catch (error) {
    console.warn('[BASEERA][QURAN][SEARCH_FALLBACK]', error);
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
