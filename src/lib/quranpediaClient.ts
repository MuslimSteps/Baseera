/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quran source client.
 *
 * The verifier uses a provenance-labeled Hafs snapshot from the King Fahd
 * Quran Complex as a deterministic local fallback, while preferring the
 * live Quranpedia API whenever it is available. AI never supplies Quran text.
 */
import localHafsData from '../../sources/quran_hafs_kfgqpc.json' with { type: 'json' };
import { normalizeArabic, normalizeArabicStrict } from './normalizer.ts';
import { fetchRemoteSafely, readTextWithLimit } from './safeRemoteFetch.ts';

const API_BASE = 'https://api.quranpedia.net/v1';
const WEB_BASE = 'https://quranpedia.net';
const HAFS_MUSHAF_ID = 1;
const cache = new Map<string, any>();

export interface QuranMushafIndex {
  id: number;
  name: string;
  rawi?: { id?: number; name?: string; full_name?: string };
}
export interface QuranMushafAyah {
  id: number;
  number: number;
  surah: number;
  page_number?: number;
  text: string;
  search?: string;
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

type LocalAyah = { number: number; text: string; search: string };
type LocalSurah = { number: number; name: string; ayahs: LocalAyah[] };
type LocalHafs = {
  version: string;
  source_name: string;
  source_url: string;
  surahs: LocalSurah[];
};

const localSource = localHafsData as unknown as LocalHafs;
let localMushafCache: QuranMushaf | null = null;

function localToAyah(surah: LocalSurah, ayah: LocalAyah): QuranMushafAyah {
  return {
    id: Number(`${surah.number}${String(ayah.number).padStart(3, '0')}`),
    number: ayah.number,
    surah: surah.number,
    text: (ayah.text || '').replace(/[\uFC00-\uFC6E]/g, '').trim(),
    search: (ayah.search || ayah.text || '').replace(/[\uFC00-\uFC6E]/g, '').trim()
  };
}

function getLocalMushaf(): QuranMushaf {
  return {
    id: HAFS_MUSHAF_ID,
    name: localSource.source_name,
    surahs: localSource.surahs.map(surah => ({
      id: surah.number,
      name: surah.name,
      ayahs: surah.ayahs.map(ayah => localToAyah(surah, ayah))
    }))
  };
}

function getLocalHafsMushaf(): QuranMushaf {
  if (!localMushafCache) localMushafCache = getLocalMushaf();
  return localMushafCache;
}

function findLocalAyah(surah: number, ayah: number): QuranMushafAyah | null {
  const localSurah = localSource.surahs.find(s => s.number === surah);
  const row = localSurah?.ayahs.find(a => a.number === ayah);
  return localSurah && row ? localToAyah(localSurah, row) : null;
}

export function getHafsSurahName(surah: number): string {
  return localSource.surahs.find(s => s.number === surah)?.name || `سورة ${surah}`;
}

export function findExactHafsAyahLocal(query: string): QuranMushafAyah | null {
  const input = String(query || '').trim();
  if (!input) return null;

  const strictTarget = normalizeArabicStrict(input);
  const looseTarget = normalizeArabic(input);
  if (!strictTarget && !looseTarget) return null;

  for (const surah of localSource.surahs) {
    for (const ayah of surah.ayahs) {
      const sourceText = ayah.search || ayah.text;
      if (
        (strictTarget && normalizeArabicStrict(sourceText) === strictTarget) ||
        (looseTarget && normalizeArabic(sourceText) === looseTarget)
      ) {
        return localToAyah(surah, ayah);
      }
    }
  }

  return null;
}

export function searchHafsAyahsLocal(query: string, limit = 12): QuranMushafAyah[] {
  const targetStrict = normalizeArabicStrict(String(query || '')).trim();
  const targetLoose = normalizeArabic(String(query || '')).trim();
  if (!targetStrict || targetStrict.length < 2) return [];

  const targetWords = new Set(targetLoose.split(/\s+/).filter(Boolean));
  const scored: Array<{ row: QuranMushafAyah; score: number }> = [];

  for (const surah of localSource.surahs) {
    for (const ayah of surah.ayahs) {
      const sourceText = ayah.search || ayah.text;
      const strict = normalizeArabicStrict(sourceText);
      const loose = normalizeArabic(sourceText);
      let score = 0;

      if (strict === targetStrict) score = 1;
      else if (targetWords.size >= 2 && targetStrict.length >= 6 && strict.includes(targetStrict)) score = 0.98;
      else if (targetWords.size >= 2) {
        const sourceWords = new Set(loose.split(/\s+/).filter(Boolean));
        let shared = 0;
        for (const word of targetWords) if (sourceWords.has(word)) shared++;
        const overlap = targetWords.size ? shared / targetWords.size : 0;
        if (overlap >= 0.55) score = overlap * 0.9;
      }

      if (score >= 0.45) scored.push({ row: localToAyah(surah, ayah), score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.row);
}

async function getJson(path: string, maxBytes = 10_000_000): Promise<any> {
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

export async function getHafsMushaf(): Promise<QuranMushaf> {
  try {
    const data = await getJson(`/mushafs/${HAFS_MUSHAF_ID}`);
    if (data && Array.isArray(data.surahs)) return data as QuranMushaf;
  } catch (error) {
    console.warn('[BASEERA][QURAN][LIVE_MUSHAF_FALLBACK]', error);
  }
  return getLocalHafsMushaf();
}

export function extractAyahRefsFromHtml(html: string): Array<{ surah: number; ayah: number }> {
  const refs = new Set<string>();
  const add = (surahValue?: string, ayahValue?: string) => {
    const surah = Number(surahValue);
    const ayah = Number(ayahValue);
    if (Number.isInteger(surah) && surah >= 1 && surah <= 114 && Number.isInteger(ayah) && ayah >= 1) {
      refs.add(`${surah}:${ayah}`);
    }
  };

  for (const match of html.matchAll(/\/verse\/(\d+)\/(\d+)/gi)) add(match[1], match[2]);
  for (const match of html.matchAll(/\/surah\/(\d+)[^"'<>?#]*[?&](?:ayah_id|ayah|ayah_number|a)=(\d+)/gi)) add(match[1], match[2]);
  for (const match of html.matchAll(/\/ayahs?\/(\d+)\/(\d+)/gi)) add(match[1], match[2]);
  for (const tagMatch of html.matchAll(/<[^>]+>/gi)) {
    const tag = tagMatch[0];
    const surahMatch = tag.match(/data-(?:surah|surah-id|surah_id|s)=["'](\d+)["']/i);
    const ayahMatch = tag.match(/data-(?:ayah|ayah-number|ayah_id|ayah-id|ayah_no|a)=["'](\d+)["']/i);
    add(surahMatch?.[1], ayahMatch?.[1]);

    const surahAttr = tag.match(/(?:surah_id|surahId|surah)=["': ]+(\d+)/i);
    const ayahAttr = tag.match(/(?:ayah_id|ayahId|ayah_number|ayahNo|ayah)=["': ]+(\d+)/i);
    add(surahAttr?.[1], ayahAttr?.[1]);
  }
  for (const match of html.matchAll(/(?:surah_id|surahId|surah)["']?\s*[:=]\s*["']?(\d+)[^\d]{0,120}(?:ayah_id|ayahId|ayah_number|ayahNo|ayah)["']?\s*[:=]\s*["']?(\d+)/gi)) {
    add(match[1], match[2]);
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
  // Deterministic exact match must always win before any network search.
  const exactLocal = findExactHafsAyahLocal(query);
  if (exactLocal) return [exactLocal];

  const localMatches = searchHafsAyahsLocal(query, limit);
  if (localMatches.length > 0) return localMatches;

  const clean = String(query || '').replace(/[«»"“”؟?.,!]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
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
    for (const word of clean.split(/\s+/).filter(word => word.length >= 4).slice(0, 4)) {
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

  const rows = await Promise.all(Array.from(refs).slice(0, limit).map(async ref => {
    const [surah, ayah] = ref.split(':').map(Number);
    return Number.isInteger(surah) && Number.isInteger(ayah) ? getHafsAyah(surah, ayah) : null;
  }));
  return rows.filter((row): row is QuranMushafAyah => Boolean(row));
}

export async function getHafsSurah(surah: number): Promise<QuranMushafAyah[]> {
  try {
    const data = await getJson(`/mushafs/${HAFS_MUSHAF_ID}/${surah}`);
    if (Array.isArray(data)) return data as QuranMushafAyah[];
  } catch (error) {
    console.warn('[BASEERA][QURAN][LIVE_SURAH_FALLBACK]', error);
  }
  return getLocalHafsMushaf().surahs.find(s => s.id === surah)?.ayahs || [];
}

export async function getHafsAyah(surah: number, ayah: number): Promise<QuranMushafAyah | null> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) return null;
  try {
    const data = await getJson(`/mushafs/${HAFS_MUSHAF_ID}/${surah}/${ayah}`, 100_000);
    if (data && typeof data.text === 'string') return data as QuranMushafAyah;
  } catch (error) {
    console.warn('[BASEERA][QURAN][LIVE_AYAH_FALLBACK]', JSON.stringify({ surah, ayah, error: String(error) }));
  }
  return findLocalAyah(surah, ayah);
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

export async function getAvailableTranslationLanguages(surah: number, ayah: number): Promise<QuranTranslationLanguage[]> {
  const data = await getJson(`/translations/available-languages/${surah}/${ayah}`);
  return Array.isArray(data) ? data : [];
}

export async function getAyahTranslations(
  surah: number, ayah: number, language?: string
): Promise<Record<string, QuranTranslation[]> | QuranTranslation[]> {
  const suffix = language ? `/${encodeURIComponent(language)}` : '';
  const data = await getJson(`/translations/${surah}/${ayah}${suffix}`);
  if (language) {
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row: any) => ({
      language, bookId: row?.book?.id,
      bookName: row?.book?.name || row?.book?.short_name || 'ترجمة معتمدة',
      translator: row?.book?.authors?.[0]?.ar_name,
      text: String(row?.['translation-content'] || '').trim()
    })).filter((x: QuranTranslation) => x.text);
  }
  const grouped: Record<string, QuranTranslation[]> = {};
  for (const [code, rows] of Object.entries(data || {})) {
    grouped[code] = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      language: code, bookId: row?.book?.id,
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
