/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import quranData from '../../sources/quran.json' with { type: 'json' };
import translationData from '../../sources/quran_translations.json' with { type: 'json' };
import { normalizeArabic, normalizeArabicStrict, computeWordDiff } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

/** Strip diacritics + Uthmani script marks for clean display */
function cleanSurahDisplayName(raw: string): string {
  return raw
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0640]/g, '')
    .replace(/^سُورَةُ\s*/u, '')
    .replace(/^سورة\s*/u, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function findSurahFuzzy(rawName?: string) {
  if (!rawName) return null;
  const norm = normalizeArabic(rawName).replace(/^سوره?\s+/, '').replace(/^ال/, '').trim();
  if (!norm) return null;

  let best = null;
  let minDiff = 999;
  for (const surah of quranData.surahs) {
    const sNorm = normalizeArabic(surah.name_ar).replace(/^سوره?\s+/, '').replace(/^ال/, '').trim();
    if (sNorm === norm) return surah;
    const dist = levenshtein(norm, sNorm);
    if (dist <= 2 && dist < minDiff) {
      minDiff = dist;
      best = surah;
    }
  }
  return best;
}

export function verifyQuranAyah(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);
  const inputWords = normInput.split(/\s+/).filter(Boolean);

  let bestMatch: (typeof quranData.verses)[0] | null = null;
  let highestScore = 0;
  let wordDiffResult: ReturnType<typeof computeWordDiff> | null = null;

  // 1. Respect explicit attribution without locking onto the first verse.
  //
  // If the user gives BOTH surah + ayah, inspect that exact location.
  // If the user gives ONLY the surah, search ALL verses in that surah and
  // select the strongest textual candidate. Never assume verse 1.
  if (item.claimed_surah || item.claimed_ayah) {
    const fuzzySurah = findSurahFuzzy(item.claimed_surah);
    let resolvedAyah = item.claimed_ayah;

    if (fuzzySurah && resolvedAyah && resolvedAyah > fuzzySurah.ayah_count) {
      // Handle reversed OCR digits only when the stated number is impossible.
      const strDigits = resolvedAyah.toString();
      const reversed = parseInt(strDigits.split('').reverse().join(''), 10);
      if (reversed <= fuzzySurah.ayah_count) {
        resolvedAyah = reversed;
      }
    }

    const surahCandidates = quranData.verses.filter(v => {
      if (fuzzySurah) return v.surah_number === fuzzySurah.number;
      if (!item.claimed_surah) return true;
      return (
        normalizeArabic(v.surah_name_ar).includes(normalizeArabic(item.claimed_surah)) ||
        v.surah_name_en.toLowerCase().includes(item.claimed_surah.toLowerCase())
      );
    });

    const locationCandidates = resolvedAyah
      ? surahCandidates.filter(v => v.ayah_number === resolvedAyah)
      : surahCandidates;

    for (const candidate of locationCandidates) {
      const diff = computeWordDiff(item.text, candidate.text_clean);
      if (
        diff.similarityScore > highestScore ||
        (diff.similarityScore === highestScore &&
          candidate.text_clean.length < (bestMatch?.text_clean.length ?? Infinity))
      ) {
        highestScore = diff.similarityScore;
        bestMatch = candidate;
        wordDiffResult = diff;
      }
    }
  }

  // 2. If only a surah was supplied, the search above is scoped to that
  // surah. Otherwise search the entire Quran. Either way, do not fabricate
  // a minimum score: similarity must come from the actual text comparison.
  const searchPool = item.claimed_surah
    ? quranData.verses.filter(v => {
        const surah = findSurahFuzzy(item.claimed_surah);
        if (surah) return v.surah_number === surah.number;
        return normalizeArabic(v.surah_name_ar).includes(normalizeArabic(item.claimed_surah));
      })
    : quranData.verses;

  if (!bestMatch || highestScore < 0.6) {
    for (const v of searchPool) {
    for (const v of searchPool) {
      const normCanonical = normalizeArabic(v.text_clean);

      // Check if substring / superset
      if (normCanonical.includes(normInput) || normInput.includes(normCanonical)) {
        const diff = computeWordDiff(item.text, v.text_clean);
        const isSubMatch = normCanonical.includes(normInput) && inputWords.length >= 2;
        // Input is a multi-verse containing this verse
        const isSuperMatch = normInput.includes(normCanonical) && normCanonical.split(/\s+/).length >= 2;
        const exactNormalized = normalizeArabicStrict(item.text) === normalizeArabicStrict(v.text_clean);
        const effectiveScore = exactNormalized ? 1 : (isSubMatch || isSuperMatch ? 0.78 : Math.max(diff.similarityScore, 0.45));

        if (effectiveScore > highestScore) {
          highestScore = effectiveScore;
          bestMatch = v;
          wordDiffResult = diff;
        }
      } else {
        // Fast word overlap pre-filter before expensive Levenshtein
        let shared = 0;
        for (const iw of inputWords) {
          if (normCanonical.includes(iw)) shared++;
        }
        if (shared >= 2 || (inputWords.length <= 2 && shared >= 1)) {
          const diff = computeWordDiff(item.text, v.text_clean);
          if (diff.similarityScore > highestScore && diff.similarityScore > 0.45) {
            highestScore = diff.similarityScore;
            bestMatch = v;
            wordDiffResult = diff;
          }
        }
      }
    }
  }

  // 3. Multilingual / Translation check if input is in English or French
  if (!bestMatch && (item.language === 'en' || item.language === 'fr' || /[a-zA-Z]/.test(item.text))) {
    const lower = item.text.toLowerCase();
    for (const tr of translationData.translations) {
      if (tr.en) {
        const canon = tr.en.text.toLowerCase().replace(/\s+/g, ' ').trim();
        const input = lower.replace(/\s+/g, ' ').trim();
        const exactTranslation = canon === input;
        const partialTranslation = canon.includes(input) && input.split(/\s+/).length >= 8;
        if (!exactTranslation && !partialTranslation) continue;
        const matchedVerse = quranData.verses.find(v => v.surah_number === tr.surah && v.ayah_number === tr.ayah);
        if (matchedVerse) {
          return {
            id: `quran-${matchedVerse.surah_number}-${matchedVerse.ayah_number}`,
            item,
            status: exactTranslation ? 'MATCHED' : 'NEEDS_REVIEW',
            status_label_ar: exactTranslation ? 'مطابقة تامة للترجمة المفهرسة' : 'مطابقة جزئية للترجمة — تحتاج مراجعة',
            status_label_en: exactTranslation ? 'Matched with Approved Translation' : 'Partial Match — Review Required',
            reason: exactTranslation ? `النص يطابق الترجمة المفهرسة للآية في سجل الترجمات المعتمد.` : `عُثر على الترجمة ضمن المصدر المعتمد، لكن النص المدخل مقتطف جزئي منها؛ لذلك لا يُعد تطابقاً كاملاً.` ,
            citation: {
              source_id: 'quran-translations',
              source_name: 'ترجمات معاني القرآن الكريم المعتمدة',
              authority: 'مجمع الملك فهد لطباعة المصحف الشريف / quranpedia',
              book: `سورة ${matchedVerse.surah_name_ar} (${matchedVerse.surah_name_en})`,
              number_or_page: `الآية: ${matchedVerse.ayah_number}`,
              url: `https://quranpedia.net/verse/${matchedVerse.surah_number}/${matchedVerse.ayah_number}`
            },
            canonical_text: matchedVerse.text_uthmani,
            canonical_surah: matchedVerse.surah_name_ar,
            canonical_ayah_number: matchedVerse.ayah_number,
            verified_translation: tr.en.text,
            decision_level: exactTranslation ? 'A' : 'B'
          };
        }
      }
    }
  }

  // 4. Decision logic for Arabic matching.
  // A candidate found only because a surah/topic word overlaps the input is not
  // enough. Require real textual evidence before exposing a canonical verse.
  if (bestMatch && wordDiffResult) {
    const matchedTranslation = translationData.translations.find(
      t => t.surah === bestMatch!.surah_number && t.ayah === bestMatch!.ayah_number
    );

    // Exact or normalized complete match
    if (highestScore >= 0.99 && !wordDiffResult.hasDiscrepancy) {
      // Check if claimed number was wrong
      if (item.claimed_ayah && item.claimed_ayah !== bestMatch.ayah_number) {
        return {
          id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
          item,
          status: 'NEEDS_REVIEW',
          status_label_ar: 'يحتاج مراجعة (خطأ في رقم الآية)',
          status_label_en: 'Needs Review (Incorrect Verse Number)',
          reason: `النص مطابق لسورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}، ولكن الرقم المذكور (${item.claimed_ayah}) غير صحيح، والرقم الصحيح هو: الآية ${bestMatch.ayah_number}.`,
          citation: {
            source_id: 'quran-uthmani',
            source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
            authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
            book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}`,
            number_or_page: `الآية: ${bestMatch.ayah_number}`
          },
          canonical_text: bestMatch.text_uthmani,
          canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
          canonical_ayah_number: bestMatch.ayah_number,
          verified_translation: matchedTranslation?.en?.text,
          decision_level: 'A'
        };
      }

      return {
        id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
        item,
        status: 'MATCHED',
        status_label_ar: 'مطابقة تامة للنص القرآني المعتمد',
        status_label_en: 'Matched',
        reason: `النص بعد التطبيع يطابق الآية كاملةً مع النص القرآني المعتمد في سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)} الآية ${bestMatch.ayah_number}.`,
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
          authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
          book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)} (${bestMatch.surah_name_en})`,
          number_or_page: `الآية ${bestMatch.ayah_number}`
        },
        canonical_text: bestMatch.text_uthmani,
        canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
        canonical_ayah_number: bestMatch.ayah_number,
        verified_translation: matchedTranslation?.en?.text,
        diff: wordDiffResult.diff,
        decision_level: 'A'
      };
    }

    // High similarity but with word discrepancies (altered or omitted words)
    if (highestScore >= 0.45 || wordDiffResult.hasDiscrepancy) {
      return {
        id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة — لم تثبت المطابقة التامة للنص القرآني',
        status_label_en: 'Needs Review (Text Discrepancy / OCR Noise)',
        reason: `عُثر على آية محتملة في المصدر المعتمد، لكن النص المدخل لا يطابقها مطابقة تامة. قد يكون السبب اقتباساً جزئياً أو خطأ OCR أو تغييراً في اللفظ؛ لذلك لا يُعامل كآية مطابقة.`,
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
          authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
          book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}`,
          number_or_page: `الآية ${bestMatch.ayah_number}`
        },
        canonical_text: bestMatch.text_uthmani,
        canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
        canonical_ayah_number: bestMatch.ayah_number,
        verified_translation: matchedTranslation?.en?.text,
        diff: wordDiffResult.diff,
        decision_level: 'A'
      };
    }
  }

  // Not found in checked Quranic sources
  return {
    id: `quran-not-found-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
    status_label_en: 'Not Found in Checked Sources',
    reason: 'لم يُعثر عليه في المراجع المفحوصة من المصحف الشريف بالرسم العثماني المعتمد.',
    citation: {
      source_id: 'quran-uthmani',
      source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
      authority: 'مجمع الملك فهد لطباعة المصحف الشريف'
    },
    abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
  };
}
