/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import quranData from '../../sources/quran.json' with { type: 'json' };
import translationData from '../../sources/quran_translations.json' with { type: 'json' };
import { normalizeArabic, computeWordDiff } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

export function verifyQuranAyah(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);
  const inputWords = normInput.split(/\s+/).filter(Boolean);

  let bestMatch: (typeof quranData.verses)[0] | null = null;
  let highestScore = 0;
  let wordDiffResult: ReturnType<typeof computeWordDiff> | null = null;

  // 1. Check if user explicitly provided claimed surah or ayah number
  if (item.claimed_surah || item.claimed_ayah) {
    const candidate = quranData.verses.find(v => {
      const matchSurah = item.claimed_surah
        ? normalizeArabic(v.surah_name_ar).includes(normalizeArabic(item.claimed_surah)) ||
          v.surah_name_en.toLowerCase().includes(item.claimed_surah.toLowerCase())
        : true;
      const matchAyah = item.claimed_ayah ? v.ayah_number === item.claimed_ayah : true;
      return matchSurah && matchAyah;
    });

    if (candidate) {
      const diff = computeWordDiff(item.text, candidate.text_clean);
      bestMatch = candidate;
      highestScore = diff.similarityScore;
      wordDiffResult = diff;
    }
  }

  // 2. Search whole Quran dataset if not found or if score is low
  if (!bestMatch || highestScore < 0.6) {
    for (const v of quranData.verses) {
      const normCanonical = normalizeArabic(v.text_clean);

      // Check if substring / superset
      if (normCanonical.includes(normInput) || normInput.includes(normCanonical)) {
        const diff = computeWordDiff(item.text, v.text_clean);
        const isSubMatch = normCanonical.includes(normInput) && inputWords.length >= 2;
        // Input is a multi-verse containing this verse
        const isSuperMatch = normInput.includes(normCanonical) && normCanonical.split(/\s+/).length >= 2;
        const effectiveScore = (isSubMatch || isSuperMatch) ? 0.98 : Math.max(diff.similarityScore, 0.85);

        if (effectiveScore > highestScore) {
          highestScore = effectiveScore;
          bestMatch = v;
          wordDiffResult = diff;
        }
      } else {
        const diff = computeWordDiff(item.text, v.text_clean);
        if (diff.similarityScore > highestScore && diff.similarityScore > 0.45) {
          highestScore = diff.similarityScore;
          bestMatch = v;
          wordDiffResult = diff;
        }
      }
    }
  }

  // 3. Multilingual / Translation check if input is in English or French
  if (!bestMatch && (item.language === 'en' || item.language === 'fr' || /[a-zA-Z]/.test(item.text))) {
    const lower = item.text.toLowerCase();
    for (const tr of translationData.translations) {
      if (tr.en && (tr.en.text.toLowerCase().includes(lower) || lower.includes(tr.en.text.toLowerCase().slice(0, 30)))) {
        const matchedVerse = quranData.verses.find(v => v.surah_number === tr.surah && v.ayah_number === tr.ayah);
        if (matchedVerse) {
          return {
            id: `quran-${matchedVerse.surah_number}-${matchedVerse.ayah_number}`,
            item,
            status: 'MATCHED',
            status_label_ar: 'مطابق للترجمة المعتمدة',
            status_label_en: 'Matched with Approved Translation',
            reason: `تمت مطابقة الترجمة مع ترجمة مجمع الملك فهد لطباعة المصحف الشريف (صحيح إنترناشونال) لسورة ${matchedVerse.surah_name_ar} الآية ${matchedVerse.ayah_number}.`,
            citation: {
              source_id: 'quran-translations',
              source_name: 'ترجمات معاني القرآن الكريم المعتمدة',
              authority: 'مجمع الملك فهد لطباعة المصحف الشريف / quranpedia',
              book: `سورة ${matchedVerse.surah_name_ar} (${matchedVerse.surah_name_en})`,
              number_or_page: `الآية: ${matchedVerse.ayah_number}`,
              url: `https://quranpedia.com/verse/${matchedVerse.surah_number}/${matchedVerse.ayah_number}`
            },
            canonical_text: matchedVerse.text_uthmani,
            canonical_surah: matchedVerse.surah_name_ar,
            canonical_ayah_number: matchedVerse.ayah_number,
            verified_translation: tr.en.text,
            decision_level: 'A'
          };
        }
      }
    }
  }

  // 4. Decision logic for Arabic matching
  if (bestMatch && wordDiffResult) {
    const matchedTranslation = translationData.translations.find(
      t => t.surah === bestMatch!.surah_number && t.ayah === bestMatch!.ayah_number
    );

    // Exact or normalized complete match
    if (highestScore >= 0.95 && !wordDiffResult.hasDiscrepancy) {
      // Check if claimed number was wrong
      if (item.claimed_ayah && item.claimed_ayah !== bestMatch.ayah_number) {
        return {
          id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
          item,
          status: 'NEEDS_REVIEW',
          status_label_ar: 'يحتاج مراجعة (خطأ في رقم الآية)',
          status_label_en: 'Needs Review (Incorrect Verse Number)',
          reason: `النص مطابق لسورة ${bestMatch.surah_name_ar}، ولكن الرقم المذكور (${item.claimed_ayah}) غير صحيح، والرقم الصحيح هو: الآية ${bestMatch.ayah_number}.`,
          citation: {
            source_id: 'quran-uthmani',
            source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
            authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
            book: `سورة ${bestMatch.surah_name_ar}`,
            number_or_page: `الآية: ${bestMatch.ayah_number}`
          },
          canonical_text: bestMatch.text_uthmani,
          canonical_surah: bestMatch.surah_name_ar,
          canonical_ayah_number: bestMatch.ayah_number,
          verified_translation: matchedTranslation?.en?.text,
          decision_level: 'A'
        };
      }

      return {
        id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
        item,
        status: 'MATCHED',
        status_label_ar: 'مطابق',
        status_label_en: 'Matched',
        reason: `تطابق تام مع النص القرآني المعتمد في سورة ${bestMatch.surah_name_ar} الآية ${bestMatch.ayah_number}.`,
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
          authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
          book: `سورة ${bestMatch.surah_name_ar} (${bestMatch.surah_name_en})`,
          number_or_page: `الآية ${bestMatch.ayah_number}`
        },
        canonical_text: bestMatch.text_uthmani,
        canonical_surah: bestMatch.surah_name_ar,
        canonical_ayah_number: bestMatch.ayah_number,
        verified_translation: matchedTranslation?.en?.text,
        diff: wordDiffResult.diff,
        decision_level: 'A'
      };
    }

    // High similarity but with word discrepancies (altered or omitted words)
    if (highestScore >= 0.55 || wordDiffResult.hasDiscrepancy) {
      return {
        id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (اختلاف في النص)',
        status_label_en: 'Needs Review (Word Discrepancy)',
        reason: `يوجد اختلاف بين النص المنقول والنص القرآني المعتمد لسورة ${bestMatch.surah_name_ar} الآية ${bestMatch.ayah_number}. لا يُعتبر النص المحرف أو المبدل مطابقاً.`,
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
          authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
          book: `سورة ${bestMatch.surah_name_ar}`,
          number_or_page: `الآية ${bestMatch.ayah_number}`
        },
        canonical_text: bestMatch.text_uthmani,
        canonical_surah: bestMatch.surah_name_ar,
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
