/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Source-first Quran verifier.
 *
 * Quran text is never bundled in the application. The current Hafs mushaf is
 * fetched from the approved live Quranpedia API and cached in memory.
 * AI is used only for candidate ranking/search assistance; source text from
 * Quranpedia remains the final evidence.
 */

import { computeWordDiff, normalizeArabic, normalizeArabicStrict } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';
import { getHafsMushaf, getHafsAyah, QuranMushafAyah } from './quranpediaClient.ts';

export type QuranCandidate = {
  id: string;
  source: 'quran-uthmani';
  title: string;
  text: string;
  surah_number: number;
  ayah_number: number;
  surah_name_ar: string;
  text_uthmani: string;
};

function cleanSurahDisplayName(raw: string): string {
  return String(raw || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0640]/g, '')
    .replace(/^سُورَةُ\s*/u, '')
    .replace(/^سورة\s*/u, '')
    .trim();
}

function findSurah(mushaf: Awaited<ReturnType<typeof getHafsMushaf>>, rawName?: string) {
  if (!rawName) return null;
  const normalized = normalizeArabic(rawName)
    .replace(/^سوره?\s+/, '')
    .replace(/^ال/, '')
    .trim();
  if (!normalized) return null;

  return mushaf.surahs.find(s => {
    const name = normalizeArabic(s.name)
      .replace(/^سوره?\s+/, '')
      .replace(/^ال/, '')
      .trim();
    return name === normalized || name.includes(normalized) || normalized.includes(name);
  }) || null;
}

function editSimilarity(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;

  let previous = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const row = new Array<number>(n + 1);
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    previous = row;
  }

  return 1 - previous[n] / Math.max(m, n);
}

function orderedTokenSimilarity(input: string, canonical: string): number {
  const inputTokens = normalizeArabic(input).split(/\s+/).filter(Boolean);
  const canonicalTokens = normalizeArabic(canonical).split(/\s+/).filter(Boolean);

  if (inputTokens.length < 2 || canonicalTokens.length < 2) return 0;

  if (canonicalTokens.length >= inputTokens.length) {
    let best = 0;
    for (let start = 0; start <= canonicalTokens.length - inputTokens.length; start++) {
      best = Math.max(
        best,
        editSimilarity(inputTokens, canonicalTokens.slice(start, start + inputTokens.length))
      );
    }
    return Number(best.toFixed(3));
  }

  const inputNorm = inputTokens.join(' ');
  const canonicalNorm = canonicalTokens.join(' ');
  return inputNorm.includes(canonicalNorm) ? 1 : 0;
}

function candidateScore(input: string, canonical: string): number {
  const exact = normalizeArabicStrict(input) === normalizeArabicStrict(canonical);
  if (exact) return 1;

  const ordered = orderedTokenSimilarity(input, canonical);
  const inputWords = new Set(normalizeArabic(input).split(/\s+/).filter(Boolean));
  const canonicalWords = new Set(normalizeArabic(canonical).split(/\s+/).filter(Boolean));
  let shared = 0;
  for (const word of inputWords) {
    if (canonicalWords.has(word)) shared++;
  }
  const overlap = inputWords.size ? shared / inputWords.size : 0;

  return Math.max(ordered, overlap * 0.8);
}

export async function getQuranCandidatesForAI(item: ExtractedItem, limit = 12): Promise<QuranCandidate[]> {
  const mushaf = await getHafsMushaf();
  const normalizedInput = normalizeArabic(item.text);
  const claimedSurah = findSurah(mushaf, item.claimed_surah);

  const pool = claimedSurah
    ? claimedSurah.ayahs
    : mushaf.surahs.flatMap(s => s.ayahs);

  const scored = pool.map(ayah => ({
    ayah,
    score: candidateScore(item.text, ayah.text)
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter(x => x.score >= 0.08 || normalizeArabic(x.ayah.text).includes(normalizedInput))
    .slice(0, limit)
    .map(x => {
      const surah = mushaf.surahs.find(s => Number(s.id) === Number(x.ayah.surah));
      const surahName = cleanSurahDisplayName(surah?.name || '');
      return {
        id: `quran-${x.ayah.surah}-${x.ayah.number}`,
        source: 'quran-uthmani',
        title: `سورة ${surahName} — الآية ${x.ayah.number}`,
        text: x.ayah.text,
        surah_number: Number(x.ayah.surah),
        ayah_number: Number(x.ayah.number),
        surah_name_ar: surahName,
        text_uthmani: x.ayah.text
      };
    });
}

export async function getQuranCandidatesFromReferences(
  references: Array<{ surah: number; ayah: number }>
): Promise<QuranCandidate[]> {
  const [mushaf, rows] = await Promise.all([
    getHafsMushaf(),
    Promise.all(
      references.map(async ref => {
        try {
          return await getHafsAyah(ref.surah, ref.ayah);
        } catch {
          return null;
        }
      })
    )
  ]);

  return rows
    .filter((ayah): ayah is QuranMushafAyah => Boolean(ayah))
    .map(ayah => {
      const surah = mushaf.surahs.find(s => Number(s.id) === Number(ayah.surah));
      const name = cleanSurahDisplayName(surah?.name || `سورة ${ayah.surah}`);
      return {
        id: `quran-${ayah.surah}-${ayah.number}`,
        source: 'quran-uthmani' as const,
        title: `سورة ${name} — الآية ${ayah.number}`,
        text: ayah.text,
        surah_number: Number(ayah.surah),
        ayah_number: Number(ayah.number),
        surah_name_ar: name,
        text_uthmani: ayah.text
      };
    });
}


function matchQuality(input: string, canonical: string): {
  score: number;
  exact: boolean;
  altered: boolean;
} {
  const exact = normalizeArabicStrict(input) === normalizeArabicStrict(canonical);
  if (exact) return { score: 1, exact: true, altered: false };

  const score = candidateScore(input, canonical);
  const diff = computeWordDiff(input, canonical).diff;
  const changed = diff.some(d => d.type === 'changed');
  return { score, exact: false, altered: changed };
}

export function buildQuranDecision(
  item: ExtractedItem,
  candidate: QuranCandidate
): VerificationResult {
  const quality = matchQuality(item.text, candidate.text);
  const diff = computeWordDiff(item.text, candidate.text).diff;

  if (!quality.exact && quality.score < 0.72) {
    return {
      id: candidate.id,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'لم تثبت مطابقة قرآنية كافية',
      status_label_en: 'No Sufficient Quranic Match',
      reason: 'استُرجعت آيات من المصدر المعتمد، لكن لم تثبت مطابقة نصية كافية للمدخل؛ لذلك لا تُنسب الآية إليه.',
      citation: {
        source_id: 'quran-uthmani',
        source_name: 'المصحف الشريف — النص الحفصي المعتمد',
        authority: 'مجمع الملك فهد / Quranpedia',
        book: `سورة ${candidate.surah_name_ar}`,
        number_or_page: `الآية: ${candidate.ayah_number}`,
        url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
      },
      canonical_text: candidate.text_uthmani,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      diff,
      decision_level: 'A',
      abstention_note: 'المطابقة غير كافية للإسناد القرآني.'
    };
  }

  if (!quality.exact) {
    const changed = diff.filter(d => d.type === 'changed');
    const findingType = changed.length > 0 ? 'altered_quran_text' : 'partial_quran_quote';

    let surahMismatch = false;
    if (item.claimed_surah) {
      const claimedSurah = normalizeArabic(item.claimed_surah).replace(/^سوره?\s+/, '').trim();
      const actualSurah = normalizeArabic(candidate.surah_name_ar).replace(/^سوره?\s+/, '').trim();
      if (!actualSurah.includes(claimedSurah.replace(/^ال/, '')) && !claimedSurah.includes(actualSurah.replace(/^ال/, ''))) {
        surahMismatch = true;
      }
    }
    const ayahMismatch = Boolean(item.claimed_ayah && item.claimed_ayah !== candidate.ayah_number);

    if (changed.length === 0 && !surahMismatch && !ayahMismatch) {
      return {
        id: candidate.id,
        item,
        status: 'MATCHED',
        finding_type: 'partial_quran_quote',
        status_label_ar: 'مطابقة تامة للنص القرآني المعتمد (اقتباس صحيح)',
        status_label_en: 'Verified Quranic Match (Partial Quotation)',
        reason: 'النص المدخل يطابق موضع الآية الكريمة من المصحف الشريف بالرسم العثماني دون أي تحريف أو تبديل في الألفاظ.',
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف — النص الحفصي المعتمد',
          authority: 'مجمع الملك فهد / Quranpedia',
          book: `سورة ${candidate.surah_name_ar}`,
          number_or_page: `الآية: ${candidate.ayah_number}`,
          url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
        },
        canonical_text: candidate.text_uthmani,
        canonical_surah: candidate.surah_name_ar,
        canonical_ayah_number: candidate.ayah_number,
        diff,
        decision_level: 'A'
      };
    }

    return {
      id: candidate.id,
      item,
      status: 'NEEDS_REVIEW',
      finding_type: findingType,
      status_label_ar: changed.length > 0
        ? 'تحريف في اللفظ القرآني — يختلف المدخل عن النص المعتمد'
        : 'اقتباس جزئي من الآية — ليس النص كاملاً',
      status_label_en: changed.length > 0
        ? 'Altered Quranic Wording'
        : 'Partial Quranic Quotation',
      reason: changed.length > 0
        ? 'المصدر المعتمد يبين اختلافًا لفظيًا بين المدخل والآية؛ لا يُعرض المدخل كنص قرآني مطابق.'
        : 'المصدر المعتمد يبين أن المدخل جزء من الآية وليس النص الكامل.',
      citation: {
        source_id: 'quran-uthmani',
        source_name: 'المصحف الشريف — النص الحفصي المعتمد',
        authority: 'مجمع الملك فهد / Quranpedia',
        book: `سورة ${candidate.surah_name_ar}`,
        number_or_page: `الآية: ${candidate.ayah_number}`,
        url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
      },
      canonical_text: candidate.text_uthmani,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      diff,
      decision_level: 'A'
    };
  }

  if (item.claimed_surah) {
    const claimedSurah = normalizeArabic(item.claimed_surah)
      .replace(/^سوره?\s+/, '')
      .trim();
    const actualSurah = normalizeArabic(candidate.surah_name_ar)
      .replace(/^سوره?\s+/, '')
      .trim();

    if (!actualSurah.includes(claimedSurah.replace(/^ال/, '')) &&
        !claimedSurah.includes(actualSurah.replace(/^ال/, ''))) {
      return {
        id: candidate.id,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'خطأ في عزو السورة',
        status_label_en: 'Incorrect Surah Attribution',
        reason: 'النص يطابق آية من المصدر المعتمد، لكن اسم السورة المذكور في المدخل لا يوافق موضع الآية.',
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف — النص الحفصي المعتمد',
          authority: 'مجمع الملك فهد / Quranpedia',
          book: `سورة ${candidate.surah_name_ar}`,
          number_or_page: `الآية: ${candidate.ayah_number}`,
          url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
        },
        canonical_text: candidate.text_uthmani,
        canonical_surah: candidate.surah_name_ar,
        canonical_ayah_number: candidate.ayah_number,
        diff,
        decision_level: 'A'
      };
    }
  }

  if (item.claimed_ayah && item.claimed_ayah !== candidate.ayah_number) {
    return {
      id: candidate.id,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'خطأ في رقم الآية',
      status_label_en: 'Incorrect Verse Number',
      reason: 'النص يطابق آية في المصدر المعتمد، لكن رقم الآية المذكور في المدخل لا يوافق الموضع المصدرّي.',
      citation: {
        source_id: 'quran-uthmani',
        source_name: 'المصحف الشريف — النص الحفصي المعتمد',
        authority: 'مجمع الملك فهد / Quranpedia',
        book: `سورة ${candidate.surah_name_ar}`,
        number_or_page: `الآية: ${candidate.ayah_number}`,
        url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
      },
      canonical_text: candidate.text_uthmani,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      diff,
      decision_level: 'A'
    };
  }

  return {
    id: candidate.id,
    item,
    status: 'MATCHED',
    status_label_ar: 'مطابقة تامة للنص القرآني المعتمد',
    status_label_en: 'Verified Quranic Match',
    reason: 'النص المدخل يطابق النص القرآني المسترجع من المصدر المعتمد بعد التطبيع.',
    citation: {
      source_id: 'quran-uthmani',
      source_name: 'المصحف الشريف — النص الحفصي المعتمد',
      authority: 'مجمع الملك فهد / Quranpedia',
      book: `سورة ${candidate.surah_name_ar}`,
      number_or_page: `الآية: ${candidate.ayah_number}`,
      url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
    },
    canonical_text: candidate.text_uthmani,
    canonical_surah: candidate.surah_name_ar,
    canonical_ayah_number: candidate.ayah_number,
    diff,
    decision_level: 'A'
  };
}

/**
 * Synchronous decision entrypoint retained for the existing decision engine.
 * It only schedules source retrieval; it never uses bundled Quran knowledge.
 */
export function verifyQuranAyah(item: ExtractedItem): VerificationResult {
  return {
    id: `quran-live-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'سيجري التحقق من المصحف المعتمد مباشرة',
    status_label_en: 'Will Verify Against Live Approved Quran Source',
    reason: 'لم تعد للمشروع قاعدة محلية لنص القرآن؛ سيجري جلب النص المعتمد مباشرة من المصدر الحي ثم التحقق منه.',
    citation: {
      source_id: 'quran-uthmani',
      source_name: 'المصحف الشريف — النص الحفصي المعتمد',
      authority: 'مجمع الملك فهد / Quranpedia',
      url: 'https://quranpedia.net/'
    },
    decision_level: 'A',
    _needs_live_search: true
  } as VerificationResult & { _needs_live_search: boolean };
}
