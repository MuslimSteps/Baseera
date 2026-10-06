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

import { computeWordDiff, normalizeArabic, normalizeArabicStrict, locateQuoteWindow } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';
import {
  getHafsAyah,
  getHafsSurahName,
  searchHafsAyahsLive,
  QuranMushafAyah,
  buildQuranpediaAyahUrl,
  findExactHafsAyahLocal,
  searchHafsAyahsLocal
} from './quranpediaClient.ts';

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
  const normInput = normalizeArabicStrict(input);
  const normText = normalizeArabicStrict(candidate.text);
  const normSearch = candidate.search ? normalizeArabicStrict(candidate.search) : '';
  const exact = normInput === normText || (Boolean(normSearch) && normInput === normSearch);
  if (exact) return { score: 1, exact: true, altered: false };

  const scoreText = candidateScore(input, candidate.text);
  const scoreSearch = candidate.search ? candidateScore(input, candidate.search) : 0;
  const score = Math.max(scoreText, scoreSearch);

  const diffText = computeWordDiff(input, candidate.text);
  const diffSearch = candidate.search ? computeWordDiff(input, candidate.search) : diffText;
  const bestDiff = diffSearch.similarityScore >= diffText.similarityScore ? diffSearch : diffText;

  const changed = bestDiff.diff.some(d => d.type === 'changed');
  return { score: Math.max(score, bestDiff.similarityScore), exact: false, altered: changed };
}

// locateQuoteWindow is provided by normalizer.ts (edit-distance tolerant, shared
// with the hadith verifier so excerpts are detected consistently).

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
  const canonicalSearchStrict = candidate.search ? normalizeArabicStrict(candidate.search) : '';

  const inputLooseNorm = normalizeArabic(item.text);
  const canonicalLooseNorm = normalizeArabic(candidate.text);
  const canonicalSearchLooseNorm = candidate.search ? normalizeArabic(candidate.search) : '';

  const inputLooseWords = inputLooseNorm.split(/\s+/).filter(Boolean);
  const canonicalLooseWords = canonicalLooseNorm.split(/\s+/).filter(Boolean);
  const canonicalSearchLooseWords = canonicalSearchLooseNorm ? canonicalSearchLooseNorm.split(/\s+/).filter(Boolean) : [];
  const maxCanonicalWords = Math.max(canonicalLooseWords.length, canonicalSearchLooseWords.length);

  const diffStats = diff.reduce(
    (acc, d) => {
      if (d.type === 'missing') acc.missing += 1;
      else if (d.type === 'added') acc.added += 1;
      else if (d.type === 'changed') {
        const normWord = normalizeArabic(d.word);
        const normExpected = normalizeArabic(d.expected || '');
        if (normWord !== normExpected) {
          acc.changed += 1;
        }
      }
      return acc;
    },
    { missing: 0, added: 0, changed: 0 }
  );
  const hasDiff = diffStats.missing > 0 || diffStats.added > 0 || diffStats.changed > 0;

  // A verbatim excerpt (جزء) of a verse is a genuine wording match, but it must
  // be reported AS an excerpt — never presented as if the whole ayah was typed.
  // Crucially, it must NOT have any missing, added, or changed words!
  const excerptWindow = inputLooseWords.length >= 2 && inputLooseWords.length < maxCanonicalWords
    ? (locateQuoteWindow(item.text, candidate.text) || (candidate.search ? locateQuoteWindow(item.text, candidate.search) : null))
    : null;
  const isVerbatimExcerpt =
    diffStats.changed === 0 &&
    diffStats.added === 0 &&
    inputLooseWords.length >= 2 &&
    inputLooseWords.length < maxCanonicalWords &&
    (canonicalStrict.includes(inputStrict) ||
      (canonicalSearchStrict !== '' && canonicalSearchStrict.includes(inputStrict)) ||
      canonicalLooseNorm.includes(inputLooseNorm) ||
      (canonicalSearchLooseNorm !== '' && canonicalSearchLooseNorm.includes(inputLooseNorm)) ||
      excerptWindow !== null);
  const quoteWindow = isVerbatimExcerpt ? excerptWindow : null;

  if (!quality.exact && !isVerbatimExcerpt && !hasDiff && quality.score < 0.72) {
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
        url: buildQuranpediaAyahUrl(candidate.surah_number, candidate.ayah_number)
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

  const citation = {
    source_id: 'quran-uthmani',
    source_name: 'المصحف الشريف — النص الحفصي المعتمد',
    authority: 'مجمع الملك فهد / Quranpedia',
    book: `سورة ${candidate.surah_name_ar}`,
    number_or_page: `الآية: ${candidate.ayah_number}`,
    url: buildQuranpediaAyahUrl(candidate.surah_number, candidate.ayah_number)
  };

  const cleanCanonicalText = (candidate.text_uthmani || '').replace(/[\u06DD\uFD3E\uFD3F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '').trim();

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

  // 1. Verbatim excerpt of a verse (NO differences, strictly matching part of the ayah)
  if (isVerbatimExcerpt) {
    return {
      id: candidate.id,
      item,
      status: 'MATCHED',
      finding_type: 'partial_quran_quote',
      status_label_ar: 'مطابق للمصحف الشريف — النص جزء من الآية',
      status_label_en: 'Verified Quranic Excerpt',
      reason: `النص المدخل جزء حرفي مطابق من الآية في المصحف المعتمد، وهو مطابق تمامًا للجزء المظلَّل داخل الآية الكاملة أدناه (سورة ${candidate.surah_name_ar} — الآية ${candidate.ayah_number}).`,
      citation,
      canonical_text: cleanCanonicalText,
      canonical_surah: candidate.surah_name_ar,
      canonical_ayah_number: candidate.ayah_number,
      is_partial_quote: true,
      quote_window: quoteWindow || undefined,
      diff,
      decision_level: 'A'
    };
  }

  // 2. Full ayah verbatim match (NO differences, covers whole ayah)
  const isFullAyahMatch = !hasDiff && (quality.exact || quality.score >= 0.95) && inputLooseWords.length >= maxCanonicalWords - 1;
  if (isFullAyahMatch) {
    return {
      id: candidate.id,
      item,
      status: 'MATCHED',
      status_label_ar: 'مطابق للمصحف الشريف',
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

  // 3. Altered or incomplete Quran verse recitation with differences
  if (hasDiff) {
    if (diffStats.missing > 0 && diffStats.changed === 0 && diffStats.added === 0) {
      return {
        id: candidate.id,
        item,
        status: 'NEEDS_REVIEW',
        finding_type: 'altered_quran_text',
        status_label_ar: 'غير مطابق للمصحف الشريف — يوجد نقص في ألفاظ الآية',
        status_label_en: 'Non-matching — Missing Words in Ayah',
        reason: `يوجد نقص وسقط في بعض ألفاظ الآية مقارنة بالنص المعتمد في المصحف الشريف (سورة ${candidate.surah_name_ar} — الآية ${candidate.ayah_number}). راجع الألفاظ الساقطة باللون الأحمر أدناه.`,
        citation,
        canonical_text: cleanCanonicalText,
        canonical_surah: candidate.surah_name_ar,
        canonical_ayah_number: candidate.ayah_number,
        diff,
        decision_level: 'A'
      };
    }

    if (diffStats.changed > 0 && diffStats.missing === 0 && diffStats.added === 0) {
      return {
        id: candidate.id,
        item,
        status: 'NEEDS_REVIEW',
        finding_type: 'altered_quran_text',
        status_label_ar: 'غير مطابق للمصحف الشريف — يوجد تبديل في ألفاظ الآية',
        status_label_en: 'Non-matching — Substituted Words in Ayah',
        reason: `يوجد تبديل واختلاف في بعض ألفاظ الآية مقارنة بالنص المعتمد في المصحف الشريف (سورة ${candidate.surah_name_ar} — الآية ${candidate.ayah_number}). راجع الألفاظ المبدّلة باللون البرتقالي أدناه.`,
        citation,
        canonical_text: cleanCanonicalText,
        canonical_surah: candidate.surah_name_ar,
        canonical_ayah_number: candidate.ayah_number,
        diff,
        decision_level: 'A'
      };
    }

    if (diffStats.added > 0 && diffStats.changed === 0 && diffStats.missing === 0) {
      return {
        id: candidate.id,
        item,
        status: 'NEEDS_REVIEW',
        finding_type: 'altered_quran_text',
        status_label_ar: 'غير مطابق للمصحف الشريف — رُصدت زيادة وألفاظ دخيلة',
        status_label_en: 'Non-matching — Extraneous Words in Ayah',
        reason: `رُصدت زيادة وألفاظ دخيلة ليست من الآية مقارنة بالنص المعتمد في المصحف الشريف (سورة ${candidate.surah_name_ar} — الآية ${candidate.ayah_number}). راجع الألفاظ الدخيلة أدناه.`,
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
      status_label_ar: 'غير مطابق للمصحف الشريف — رُصد نقص وتبديل في ألفاظ الآية',
      status_label_en: 'Non-matching — Quranic Wording Altered',
      reason: `يوجد اختلاف ونقص أو تبديل لفظي بين المدخل والنص القرآني المعتمد في المصحف الشريف (سورة ${candidate.surah_name_ar} — الآية ${candidate.ayah_number}). راجع الفوارق الملونة أدناه.`,
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
    status_label_ar: 'غير مطابق للمصحف الشريف — رُصد اختلاف في لفظ الآية',
    status_label_en: 'Non-matching — Quranic Wording Altered',
    reason: `يوجد اختلاف لفظي بين المدخل والنص القرآني المعتمد في المصحف الشريف (سورة ${candidate.surah_name_ar} — الآية ${candidate.ayah_number}). راجع الفوارق الملونة أدناه.`,
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

export function verifyQuranAyahDeterministic(item: ExtractedItem): VerificationResult {
  const query = item.text.trim();
  const exact = findExactHafsAyahLocal(query);
  const matches = exact ? [exact] : searchHafsAyahsLocal(query, 12);
  if (!matches.length) {
    return {
      id: `quran-notfound-${Date.now()}`,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'لم يُعثر على الآية في المصحف المعتمد',
      status_label_en: 'Not Found in Approved Quran Source',
      reason: 'لم تُثبت مطابقة النص في مصحف مجمع الملك فهد برواية حفص.',
      citation: {
        source_id: 'quran-uthmani',
        source_name: 'المصحف الشريف — النص الحفصي المعتمد',
        authority: 'مجمع الملك فهد',
        url: 'https://quranpedia.net/'
      },
      decision_level: 'A'
    };
  }

  const best = matches[0];
  const surahNumber = Number(best.surah);
  const ayahNumber = Number(best.number);
  const surahName = getHafsSurahName(surahNumber);
  const candidate: QuranCandidate = {
    id: `quran-${surahNumber}-${ayahNumber}`,
    source: 'quran-uthmani',
    title: `سورة ${surahName} — الآية ${ayahNumber}`,
    text: best.text,
    search: best.search || best.text,
    surah_number: surahNumber,
    ayah_number: ayahNumber,
    surah_name_ar: surahName,
    text_uthmani: best.text
  };

  return buildQuranDecision(item, candidate);
}

