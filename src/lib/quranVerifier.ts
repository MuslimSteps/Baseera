/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Source-first Quran verifier.
 *
 * The verifier uses the provenance-labeled Hafs source snapshot as a deterministic
 * fallback and prefers live Quranpedia data when available. AI is used only for
 * search assistance/ranking; it never supplies Quran text or evidence.
 */

import { computeWordDiff, normalizeArabic, normalizeArabicStrict } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';
import { getHafsAyah, getHafsSurahName, searchHafsAyahsLive, QuranMushafAyah } from './quranpediaClient.ts';

export type QuranCandidate = {
  id: string;
  source: 'quran-uthmani';
  title: string;
  text: string;
  search?: string;
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
  const rows = await searchHafsAyahsLive(item.text, limit);
  return rows
    .sort((a, b) => candidateScore(item.text, b.text) - candidateScore(item.text, a.text))
    .map(ayah => {
      const surahNumber = Number(ayah.surah);
      const surahName = cleanSurahDisplayName(getHafsSurahName(surahNumber));
      return {
        id: `quran-${surahNumber}-${ayah.number}`,
        source: 'quran-uthmani' as const,
        title: `سورة ${surahName} — الآية ${ayah.number}`,
        text: ayah.text,
        search: ayah.search || ayah.text,
        surah_number: surahNumber,
        ayah_number: Number(ayah.number),
        surah_name_ar: surahName,
        text_uthmani: ayah.text
      };
    });
}

export async function getQuranCandidatesFromReferences(
  references: Array<{ surah: number; ayah: number }>
): Promise<QuranCandidate[]> {
  const deduped = [...new Map(
    references
      .filter(ref =>
        Number.isInteger(ref.surah) && ref.surah >= 1 && ref.surah <= 114 &&
        Number.isInteger(ref.ayah) && ref.ayah >= 1
      )
      .map(ref => [`${ref.surah}:${ref.ayah}`, ref])
  ).values()];

  const rows = await Promise.all(deduped.map(ref => getHafsAyah(ref.surah, ref.ayah)));

  return rows.filter((ayah): ayah is QuranMushafAyah => Boolean(ayah)).map(ayah => {
    const surahNumber = Number(ayah.surah);
    const surahName = cleanSurahDisplayName(getHafsSurahName(surahNumber));
    return {
      id: `quran-${surahNumber}-${ayah.number}`,
      source: 'quran-uthmani' as const,
      title: `سورة ${surahName} — الآية ${ayah.number}`,
      text: ayah.text,
      search: ayah.search || ayah.text,
      surah_number: surahNumber,
      ayah_number: Number(ayah.number),
      surah_name_ar: surahName,
      text_uthmani: ayah.text
    };
  });
}

function matchQuality(input: string, candidate: QuranCandidate): {
  score: number;
  exact: boolean;
  altered: boolean;
} {
  const exact =
    normalizeArabicStrict(input) === normalizeArabicStrict(candidate.text) ||
    (Boolean(candidate.search) && normalizeArabicStrict(input) === normalizeArabicStrict(candidate.search!));
  if (exact) return { score: 1, exact: true, altered: false };

  const scoreText = candidateScore(input, candidate.text);
  const scoreSearch = candidate.search ? candidateScore(input, candidate.search) : 0;
  const score = Math.max(scoreText, scoreSearch);

  const diffText = computeWordDiff(input, candidate.text);
  const diffSearch = candidate.search ? computeWordDiff(input, candidate.search) : diffText;
  const bestDiff = diffSearch.similarityScore >= diffText.similarityScore ? diffSearch : diffText;

  const changed = bestDiff.diff.some(d => d.type === 'changed');
  return { score: Math.max(score, bestDiff.similarityScore), exact: bestDiff.similarityScore === 1, altered: changed };
}

export function buildQuranDecision(
  item: ExtractedItem,
  candidate: QuranCandidate
): VerificationResult {
  const quality = matchQuality(item.text, candidate);
  const diffResultText = computeWordDiff(item.text, candidate.text);
  const diffResultSearch = candidate.search ? computeWordDiff(item.text, candidate.search) : diffResultText;
  const diffResult = diffResultSearch.similarityScore >= diffResultText.similarityScore ? diffResultSearch : diffResultText;
  const diff = diffResult.diff;
  const inputStrict = normalizeArabicStrict(item.text);
  const canonicalStrict = normalizeArabicStrict(candidate.text);
  const inputLooseWords = normalizeArabic(item.text).split(/\s+/).filter(Boolean);
  const canonicalLooseWords = normalizeArabic(candidate.text).split(/\s+/).filter(Boolean);

  if (!quality.exact && quality.score < 0.72) {
    return {
      id: candidate.id,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'لم تثبت مطابقة قرآنية كافية',
      status_label_en: 'No Sufficient Quranic Match',
      reason: 'لم يثبت تطابق كافٍ مع نص قرآني في المصدر المعتمد.',
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

  let surahMismatch = false;
  if (item.claimed_surah) {
    const claimedSurah = normalizeArabic(item.claimed_surah).replace(/^سوره?\s+/, '').trim();
    const actualSurah = normalizeArabic(candidate.surah_name_ar).replace(/^سوره?\s+/, '').trim();
    surahMismatch =
      !actualSurah.includes(claimedSurah.replace(/^ال/, '')) &&
      !claimedSurah.includes(actualSurah.replace(/^ال/, ''));
  }

  const ayahMismatch = Boolean(item.claimed_ayah && item.claimed_ayah !== candidate.ayah_number);
  const isPartialQuote =
    inputLooseWords.length >= 2 &&
    inputLooseWords.length < canonicalLooseWords.length &&
    (canonicalStrict.includes(inputStrict) || quality.score >= 0.72);

  const citation = {
    source_id: 'quran-uthmani',
    source_name: 'المصحف الشريف — النص الحفصي المعتمد',
    authority: 'مجمع الملك فهد / Quranpedia',
    book: `سورة ${candidate.surah_name_ar}`,
    number_or_page: `الآية: ${candidate.ayah_number}`,
    url: `https://quranpedia.net/verse/${candidate.surah_number}/${candidate.ayah_number}`
  };

  const cleanCanonicalText = (candidate.text_uthmani || '').replace(/[\uFC00-\uFC6E]/g, '').trim();

  if (quality.exact && !surahMismatch && !ayahMismatch) {
    return {
      id: candidate.id,
      item,
      status: 'MATCHED',
      finding_type: 'partial_quran_quote',
      status_label_ar: 'مطابق للمصدر',
      status_label_en: 'Verified Quranic Match',
      reason: 'النص يطابق الآية في المصحف المعتمد.',
      citation,
      canonical_text: cleanCanonicalText,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      diff,
      decision_level: 'A'
    };
  }

  if (isPartialQuote) {
    const looseQuoteMatchesSource =
      normalizeArabic(candidate.text).includes(normalizeArabic(item.text)) &&
      inputLooseWords.length >= 2;

    if ((diff.every(d => d.type === 'equal') || looseQuoteMatchesSource) && !surahMismatch && !ayahMismatch) {
      return {
        id: candidate.id,
        item,
        status: 'MATCHED',
        finding_type: 'partial_quran_quote',
        status_label_ar: 'مطابق للمصدر — اقتباس جزئي',
        status_label_en: 'Verified Partial Quranic Match',
        reason: 'النص المدخل جزء مطابق من الآية في المصحف المعتمد.',
        citation,
        canonical_text: cleanCanonicalText,
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
      finding_type: 'partial_quran_quote',
      status_label_ar: 'يحتاج مراجعة — اختلاف في الاقتباس',
      status_label_en: 'Partial Quranic Quote — Review Required',
      reason: 'النص جزء من آية في المصدر المعتمد، لكن توجد ألفاظ تختلف عن النص الأصلي.',
      citation,
      canonical_text: cleanCanonicalText,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      diff,
      decision_level: 'A'
    };
  }

  if (surahMismatch) {
    return {
      id: candidate.id,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'خطأ في عزو السورة',
      status_label_en: 'Incorrect Surah Attribution',
      reason: 'النص يطابق آية في المصدر، لكن اسم السورة المذكور لا يوافق موضعها.',
      citation,
      canonical_text: cleanCanonicalText,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      diff,
      decision_level: 'A'
    };
  }

  if (ayahMismatch) {
    return {
      id: candidate.id,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'خطأ في رقم الآية',
      status_label_en: 'Incorrect Verse Number',
      reason: 'النص يطابق آية في المصدر، لكن رقم الآية المذكور لا يوافق موضعها.',
      citation,
      canonical_text: cleanCanonicalText,
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
    finding_type: 'altered_quran_text',
    status_label_ar: 'غير مطابق — رُصد اختلاف في لفظ الآية',
    status_label_en: 'Non-matching — Quranic Wording Altered',
    reason: 'يوجد اختلاف لفظي بين المدخل والنص القرآني المعتمد في المصحف الشريف. راجع الفوارق الملونة أدناه.',
    citation,
    canonical_text: cleanCanonicalText,
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
    status: 'NEEDS_REVIEW',
    status_label_ar: 'تعذر إكمال التحقق',
    status_label_en: 'Verification Could Not Be Completed',
    reason: 'تعذر إكمال الفحص الآن.',
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
