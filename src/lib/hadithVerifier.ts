/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import hadithData from '../../sources/hadith.json' with { type: 'json' };
import { normalizeArabic, computeWordDiff } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

export function verifyHadith(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);

  let bestMatch: (typeof hadithData.hadiths)[0] | null = null;
  let highestScore = 0;
  let wordDiffResult: ReturnType<typeof computeWordDiff> | null = null;

  for (const h of hadithData.hadiths) {
    const normCanonical = normalizeArabic(h.text_clean);

    // Exact substring or full match
    if (normCanonical.includes(normInput) || normInput.includes(normCanonical)) {
      const diff = computeWordDiff(item.text, h.text_clean);
      const inputWords = normInput.split(/\s+/).filter(Boolean);
      // Input is excerpt of hadith
      const isSubMatch = normCanonical.includes(normInput) && inputWords.length >= 2;
      // Input contains the full hadith text (e.g. with long sanad/intro prefix)
      const isSuperMatch = normInput.includes(normCanonical) && normCanonical.split(/\s+/).length >= 3;
      const effectiveScore = (isSubMatch || isSuperMatch) ? 0.98 : Math.max(diff.similarityScore, 0.85);

      if (effectiveScore > highestScore) {
        highestScore = effectiveScore;
        bestMatch = h;
        wordDiffResult = diff;
      }
    } else {
      // Keyword matching
      const hasKeywords = h.keywords?.some(k => {
        const normK = normalizeArabic(k);
        return normInput.includes(normK) || normK.includes(normInput);
      });
      const diff = computeWordDiff(item.text, h.text_clean);
      const effectiveScore = hasKeywords ? Math.max(diff.similarityScore, 0.8) : diff.similarityScore;

      if (effectiveScore > highestScore && effectiveScore > 0.45) {
        highestScore = effectiveScore;
        bestMatch = h;
        wordDiffResult = diff;
      }
    }
  }

  // If found in checked hadith database
  if (bestMatch && highestScore >= 0.5) {
    const citation = {
      source_id: 'dorar-hadith',
      source_name: 'الموسوعة الحديثية — الدرر السنية',
      authority: 'مؤسسة الدرر السنية للإشراف العلمي',
      book: bestMatch.source_book,
      number_or_page: bestMatch.number_or_page,
      grade: bestMatch.grade,
      url: bestMatch.dorar_url
    };

    // Check if the user claimed a source that disagrees with verified source
    let hasWrongAttribution = false;
    if (item.claimed_source) {
      const normClaim = normalizeArabic(item.claimed_source);
      const normBook = normalizeArabic(bestMatch.source_book);
      // e.g., user claimed "صحيح البخاري" but the hadith is actually in "سنن الترمذي" or "مسند أحمد"
      if (!normBook.includes(normClaim) && (normClaim.includes('بخاري') || normClaim.includes('مسلم') || normClaim.includes('ترمذي') || normClaim.includes('احمد'))) {
        hasWrongAttribution = true;
      }
    }

    if (hasWrongAttribution) {
      return {
        id: `hadith-${bestMatch.id}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (نسبة إلى مصدر خاطئ)',
        status_label_en: 'Needs Review (Mismatched Source Attribution)',
        reason: `متن الحديث موجود، ولكنه منسوب إلى مصدر خاطئ (${item.claimed_source}). المصدر المعتمد في الموسوعة الحديثية هو: ${bestMatch.source_book}، بحكم: ${bestMatch.grade}.`,
        citation,
        canonical_text: bestMatch.text_full,
        diff: wordDiffResult?.diff,
        decision_level: 'B'
      };
    }

    // Check grade: if weak or fabricated
    if (bestMatch.grade_category === 'weak' || bestMatch.grade_category === 'fabricated') {
      return {
        id: `hadith-${bestMatch.id}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: `يحتاج مراجعة (${bestMatch.grade})`,
        status_label_en: `Needs Review (${bestMatch.grade_category})`,
        reason: `الحديث وارد في كتب التخريج ولكنه ${bestMatch.grade} بحسب تحقيق المحدثين المعتمد في منصة الدرر السنية. لا يجوز الجزم بنسبته للنبي ﷺ دون بيان درجته.`,
        citation,
        canonical_text: bestMatch.text_full,
        diff: wordDiffResult?.diff,
        decision_level: 'B'
      };
    }

    // Check for significant text discrepancies
    if (wordDiffResult && wordDiffResult.hasDiscrepancy && highestScore < 0.85) {
      return {
        id: `hadith-${bestMatch.id}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (اختلاف في متن الحديث)',
        status_label_en: 'Needs Review (Textual Variation)',
        reason: `الحديث أصله ثابت في ${bestMatch.source_book}، ولكن يوجد اختلاف وتفاوت في الألفاظ المنقولة مقارنة بالنص المعتمد.`,
        citation,
        canonical_text: bestMatch.text_full,
        diff: wordDiffResult.diff,
        decision_level: 'B'
      };
    }

    // Otherwise: Matched Sahih / Hasan
    return {
      id: `hadith-${bestMatch.id}`,
      item,
      status: 'MATCHED',
      status_label_ar: 'مطابق (ثابت في المرجع المعتمد)',
      status_label_en: 'Matched (Verified in Approved Corpus)',
      reason: `مطابق للرواية الثابتة في ${bestMatch.source_book}. الراوي: ${bestMatch.narrator}، المحدث: ${bestMatch.muhaddith}، خلاصة حكم المحدث: ${bestMatch.grade}.`,
      citation,
      canonical_text: bestMatch.text_full,
      diff: wordDiffResult?.diff,
      decision_level: 'A'
    };
  }

  // Not found in checked corpus
  return {
    id: `hadith-notfound-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
    status_label_en: 'Not Found in Checked Sources',
    reason: 'لم يُعثر على هذا اللفظ كحديث مسند في نطاق الموسوعة الحديثية والمراجع المعتمدة المفحوصة. تلتزم بصيرة بعدم الحكم بالبطلان أو الاختلاق إلا إذا صرّح به المرجع المفحوص.',
    citation: {
      source_id: 'dorar-hadith',
      source_name: 'الموسوعة الحديثية — الدرر السنية',
      authority: 'مؤسسة الدرر السنية للإشراف العلمي'
    },
    abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.',
    _needs_live_search: true // Flag for server to attempt live Dorar API search
  } as VerificationResult & { _needs_live_search?: boolean };
}

/**
 * Search Dorar.net live API for hadiths not found in local corpus.
 * This extends coverage from 513 local hadiths to the full Dorar corpus (~40,000+ hadiths).
 * Used as a server-side async fallback only.
 */
export async function searchDorarLive(query: string): Promise<{
  found: boolean;
  grade?: string;
  source?: string;
  book?: string;
  text?: string;
  url?: string;
}> {
  try {
    const encoded = encodeURIComponent(query.slice(0, 100));
    const url = `https://dorar.net/dorar_api.json?skey=${encoded}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Baseera-Verification/1.0 (Islamic Content Verification Tool)' }
    });
    clearTimeout(timeout);

    if (!res.ok) return { found: false };

    const data = await res.json() as {
      ahadith?: { hadith?: Array<{
        hadithRawi?: string;
        hadithMakhrij?: string;
        hadithGrade?: string;
        hadithText?: string;
        hadithBook?: string;
        id?: string;
      }> }
    };

    const hadiths = data?.ahadith?.hadith;
    if (!hadiths || hadiths.length === 0) return { found: false };

    // Return the first (most relevant) result
    const first = hadiths[0];
    return {
      found: true,
      grade: first.hadithGrade,
      source: first.hadithMakhrij,
      book: first.hadithBook,
      text: first.hadithText,
      url: first.id ? `https://dorar.net/hadith/sharh/${first.id}` : undefined
    };
  } catch {
    return { found: false };
  }
}

