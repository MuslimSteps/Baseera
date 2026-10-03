/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { verifyQuranAyah } from './quranVerifier.ts';
import { verifyHadith } from './hadithVerifier.ts';
import { verifyIslamicTerm } from './terminologyEngine.ts';
import { verifyFiqhQuestion } from './fiqhEngine.ts';
import {
  ExtractedItem,
  VerificationResult,
  VerificationStatus,
  AnalysisReport
} from '../types/baseera.ts';
import { normalizeArabic } from './normalizer.ts';

/**
 * Core Decision Engine with Cross-Source Search
 * 
 * Rules:
 * 1. "النموذج اللغوي لا يصدر الحكم الشرعي ولا يختلق المصدر.
 *     الحكم يُسترجع من المصادر المعتمدة حصرًا."
 * 2. البحث الشامل في جميع المصادر: إذا لم يوجد النص في القرآن،
 *    يتم البحث تلقائياً في السنة والحديث والجمهرة والفقه.
 * 3. كشف أخطاء العزو المتبادل:
 *    - حديث منسوب خطأ على أنه آية قرآنية.
 *    - آية منسوبة خطأ على أنها حديث نبوي.
 * 4. عند غياب المرجع بعد فحص كافة المصادر:
 *    التصريح حصراً بـ: "لم يُعثر عليه في المراجع المفحوصة."
 */

export function verifySingleItemCrossSource(item: ExtractedItem): VerificationResult {
  // Check across all 4 official corpora
  const quranRes = verifyQuranAyah(item);
  const hadithRes = verifyHadith(item);
  const termRes = verifyIslamicTerm(item);
  const fiqhRes = verifyFiqhQuestion(item);

  const isQuranFound = quranRes.status === 'MATCHED' || quranRes.status === 'NEEDS_REVIEW';
  const isHadithFound = hadithRes.status === 'MATCHED' || hadithRes.status === 'NEEDS_REVIEW';
  const isTermFound = termRes.status === 'MATCHED' || termRes.status === 'NEEDS_REVIEW';

  // 1. If claimed/tagged as Ayah
  if (item.type === 'ayah') {
    if (isQuranFound) {
      return quranRes;
    }

    // Cross-check: Did it actually exist in Sunnah / Hadith?
    if (isHadithFound) {
      return {
        id: `cross-ayah-to-hadith-${Date.now()}`,
        item: { ...item, type: 'hadith' },
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (خطأ في العزو: حديث وليس آية)',
        status_label_en: 'Needs Review (Misattributed: Hadith, not Quran)',
        reason: `تنبيه عزو جوهري: النص المذكور نُسب إلى القرآن الكريم، ولكن بعد الفحص في المصحف الشريف بالرسم العثماني لم يُعثر عليه كآية، بينما ثبت في السنة النبوية الشريفة: ${hadithRes.reason}`,
        citation: hadithRes.citation,
        canonical_text: hadithRes.canonical_text,
        diff: hadithRes.diff,
        decision_level: 'B'
      };
    }

    // Cross-check: Is it an Islamic term in Jamhara?
    if (isTermFound) {
      return {
        ...termRes,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (مصطلح شرعي وليس آية)',
        reason: `النص المدخل يمثل مصطلحاً شرعياً في موسوعة الجمهرة وليس آية قرآنية.`
      };
    }

    // Not found in Quran NOR in Sunnah NOR in Jamhara NOR in Fiqh
    return {
      id: `not-found-${Date.now()}`,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
      status_label_en: 'Not Found in Checked Sources',
      reason: 'لم يُعثر على هذا النص في أيٍّ من المراجع المعتمدة المفحوصة (المصحف الشريف بالرسم العثماني، الموسوعة الحديثية بالدرر السنية والمكتبة الشاملة، موسوعة الجمهرة، والموسوعة الفقهية). تلتزم بصيرة بعدم الحكم بالبطلان أو الاختلاق إلا إذا صرّح به المرجع المفحوص.',
      citation: {
        source_id: 'source-registry-all',
        source_name: 'المصادر المعتمدة في الحزمة العلمية',
        authority: 'مصحف المدينة • الدرر السنية • موسوعة الجمهرة • المذاهب الأربعة'
      },
      abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
    };
  }

  // 2. If claimed/tagged as Hadith
  if (item.type === 'hadith') {
    if (isHadithFound) {
      return hadithRes;
    }

    // Cross-check: Did it actually exist in Quran?
    if (isQuranFound) {
      return {
        id: `cross-hadith-to-ayah-${Date.now()}`,
        item: { ...item, type: 'ayah' },
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (خطأ في العزو: آية كريمة وليست حديثاً)',
        status_label_en: 'Needs Review (Misattributed: Quranic Ayah, not Hadith)',
        reason: `تنبيه عزو جوهري: النص المذكور نُسب إلى الحديث النبوي، ولكن بعد الفحص في الموسوعة الحديثية لم يُعثر عليه، بينما ثبت أنه آية كريمة من كتاب الله في ${quranRes.citation.book} ${quranRes.citation.number_or_page}.`,
        citation: quranRes.citation,
        canonical_text: quranRes.canonical_text,
        canonical_surah: quranRes.canonical_surah,
        canonical_ayah_number: quranRes.canonical_ayah_number,
        diff: quranRes.diff,
        decision_level: 'A'
      };
    }

    // Cross-check: Is it in Jamhara?
    if (isTermFound) {
      return {
        ...termRes,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (مصطلح شرعي وليس حديثاً)'
      };
    }

    // Not found in any checked source
    return {
      id: `not-found-${Date.now()}`,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
      status_label_en: 'Not Found in Checked Sources',
      reason: 'لم يُعثر على هذا اللفظ في أيٍّ من المراجع المعتمدة المفحوصة (الموسوعة الحديثية، المصحف الشريف، موسوعة الجمهرة، والموسوعة الفقهية). تلتزم المنظومة بالامتناع عن التخريج غير الموثق.',
      citation: {
        source_id: 'source-registry-all',
        source_name: 'المصادر المعتمدة في الحزمة العلمية',
        authority: 'مصحف المدينة • الدرر السنية • موسوعة الجمهرة • المذاهب الأربعة'
      },
      abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
    };
  }

  // 3. If Term
  if (item.type === 'term') {
    if (isTermFound) {
      return termRes;
    }
    if (isQuranFound) return quranRes;
    if (isHadithFound) return hadithRes;

    return {
      id: `not-found-${Date.now()}`,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
      status_label_en: 'Not Found in Checked Sources',
      reason: 'لم يُعثر على توصيف هذا المصطلح في المراجع المعتمدة المفحوصة (موسوعة الجمهرة، المصحف الشريف، والموسوعة الحديثية).',
      citation: {
        source_id: 'jamhara-terms',
        source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
        authority: 'الحزمة المرجعية المعتمدة للمصطلحات والتعريف بالإسلام'
      },
      abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
    };
  }

  // 4. If Fiqh Question
  if (item.type === 'fiqh_question') {
    return fiqhRes;
  }

  // 5. Default / General text / Unclassified claim:
  // Exhaustive search across all corpora
  if (isQuranFound) return quranRes;
  if (isHadithFound) return hadithRes;
  if (isTermFound) return termRes;
  if (fiqhRes.status === 'MATCHED' || fiqhRes.status === 'REFER_TO_SPECIALIST' || fiqhRes.status === 'NEEDS_REVIEW') return fiqhRes;

  // If nowhere found
  return {
    id: `not-found-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
    status_label_en: 'Not Found in Checked Sources',
    reason: 'لم يُعثر على هذا النص في أيٍّ من المراجع المعتمدة المفحوصة في الحزمة (المصحف الشريف بالرسم العثماني، الموسوعة الحديثية بالدرر السنية والمكتبة الشاملة، موسوعة الجمهرة، والموسوعة الفقهية). وتلتزم المنظومة بعدم اختلاق نسب أو مطابقة غير محققة.',
    citation: {
      source_id: 'source-registry-all',
      source_name: 'المصادر المعتمدة في الحزمة العلمية',
      authority: 'مصحف المدينة • الدرر السنية • موسوعة الجمهرة • المذاهب الأربعة'
    },
    abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
  };
}

export function verifyExtractedItems(
  items: ExtractedItem[],
  originalInput: string,
  inputType: 'text' | 'url' | 'image' | 'audio' = 'text'
): AnalysisReport {
  const verifications: VerificationResult[] = [];

  for (const item of items) {
    const result = verifySingleItemCrossSource(item);
    verifications.push(result);
  }

  // Calculate statistics
  let matchedCount = 0;
  let needsReviewCount = 0;
  let notFoundCount = 0;
  let referralCount = 0;

  for (const v of verifications) {
    if (v.status === 'MATCHED') matchedCount++;
    else if (v.status === 'NEEDS_REVIEW') needsReviewCount++;
    else if (v.status === 'NOT_FOUND_IN_CHECKED_SOURCES') notFoundCount++;
    else if (v.status === 'REFER_TO_SPECIALIST') referralCount++;
  }

  // Determine overall status
  let overallStatus: VerificationStatus = 'MATCHED';
  if (referralCount > 0) {
    overallStatus = 'REFER_TO_SPECIALIST';
  } else if (needsReviewCount > 0) {
    overallStatus = 'NEEDS_REVIEW';
  } else if (notFoundCount > 0 && matchedCount === 0) {
    overallStatus = 'NOT_FOUND_IN_CHECKED_SOURCES';
  } else if (notFoundCount > 0) {
    overallStatus = 'NEEDS_REVIEW';
  }

  // Generate Scannable Summary
  let summaryAr = '';
  let summaryEn = '';

  if (verifications.length === 0) {
    summaryAr = 'لم يتم رصد نصوص قرآنية أو أحاديث أو مصطلحات حساسة في المدخل.';
    summaryEn = 'No specific Quranic verses, Hadiths, or sensitive terms detected in input.';
  } else if (overallStatus === 'MATCHED') {
    summaryAr = `تم التحقق بنجاح: جميع العناصر (${matchedCount}) مطابقة للمصادر المعتمدة المحددة في الحزمة العلمية.`;
    summaryEn = `Verified successfully: all (${matchedCount}) items match the approved sources.`;
  } else if (overallStatus === 'NEEDS_REVIEW') {
    summaryAr = `تنبيه: يتضمن المحتوى عناصر تحتاج لمراجعة ودقة في النقل (${needsReviewCount} عناصر) لتجنب الخلط أو الخطأ في العزو أو اختزال المعاني.`;
    summaryEn = `Alert: Input contains items requiring review (${needsReviewCount} items) to prevent misattribution, textual drift, or reductionist framing.`;
  } else if (overallStatus === 'REFER_TO_SPECIALIST') {
    summaryAr = `إحالة شرعية: يتضمن المحتوى مسائل فقهية أو حالات شخصية تتطلب استشارة أهل الاختصاص والهيئات الإفتائية المعتمدة.`;
    summaryEn = `Specialist Referral: Input contains legal/personal queries that require direct qualified religious consultation.`;
  } else {
    summaryAr = `امتناع: لم يتم العثور على النصوص المدخلة في نطاق المراجع المفحوصة (القرآن، السنة، الجمهرة، الفقه).`;
    summaryEn = `Abstention: Text not found within any of the checked reference corpora (Quran, Sunnah, Jamhara, Fiqh).`;
  }

  return {
    id: `rep-${Date.now()}`,
    input_type: inputType,
    original_input: originalInput,
    normalized_text: normalizeArabic(originalInput),
    extracted_items_count: items.length,
    verifications,
    overall_status: overallStatus,
    summary_ar: summaryAr,
    summary_en: summaryEn,
    created_at: new Date().toISOString(),
    verifier_stats: {
      matched_count: matchedCount,
      needs_review_count: needsReviewCount,
      not_found_count: notFoundCount,
      referral_count: referralCount
    }
  };
}
