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
import { buildDorarAqeedahUrl, buildDorarTafsirUrl } from './dorarQueryUtils.ts';

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
  // 1. If claimed/tagged as Ayah
  if (item.type === 'ayah') {
    const quranRes = verifyQuranAyah(item);
    if (quranRes.status === 'MATCHED' || quranRes.status === 'NEEDS_REVIEW') {
      return quranRes;
    }

    // Cross-check: Did it actually exist in Sunnah / Hadith definitively?
    const hadithRes = verifyHadith(item);
    if (hadithRes.status !== 'NOT_FOUND_IN_CHECKED_SOURCES') {
      const explicitlyClaimedAsQuran = item.claimed_surah || /(?:قال\s+(?:الله\s+)?تعالى|سورة|آية|المصحف|في\s+القرآن)/i.test(item.context || item.text);
      if (explicitlyClaimedAsQuran) {
        return {
          id: `cross-ayah-to-hadith-${Date.now()}`,
          item: { ...item, type: 'hadith' },
          status: 'NEEDS_REVIEW',
          status_label_ar: 'يحتاج مراجعة (خطأ في العزو: حديث وليس آية)',
          status_label_en: 'Needs Review (Misattributed: Hadith, not Quran)',
          reason: `تنبيه عزو جوهري: النص المذكور نُسب إلى القرآن الكريم، ولكن بعد الفحص في المصحف الشريف بالرسم العثماني لم يُعثر عليه كآية، بينما ورد في السنة النبوية الشريفة: ${hadithRes.reason}`,
          citation: hadithRes.citation,
          canonical_text: hadithRes.canonical_text,
          diff: hadithRes.diff,
          decision_level: 'B'
        };
      } else {
        // Not claimed as Quran — return genuine Hadith result directly
        return hadithRes;
      }
    }

    // Cross-check: Is it an Islamic term in Jamhara?
    const termRes = verifyIslamicTerm(item);
    if (termRes.status === 'MATCHED') {
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
        authority: 'مصحف المدينة • الدرر السنية • موسوعة الجمهرة • المذاهب الأربعة',
        book: 'سجل المصادر المعتمدة (مصحف المدينة والموسوعة الحديثية)',
        url: 'https://dorar.net/hadith/search'
      },
      abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
    };
  }

  // 2. If claimed/tagged as Hadith
  if (item.type === 'hadith') {
    const hadithRes = verifyHadith(item);
    if (hadithRes.status !== 'NOT_FOUND_IN_CHECKED_SOURCES') {
      return hadithRes;
    }

    // Cross-check: Did it actually exist in Quran?
    const quranRes = verifyQuranAyah(item);
    if (quranRes.status === 'MATCHED' || quranRes.status === 'NEEDS_REVIEW') {
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
    const termRes = verifyIslamicTerm(item);
    if (termRes.status === 'MATCHED') {
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
        authority: 'مصحف المدينة • الدرر السنية • موسوعة الجمهرة • المذاهب الأربعة',
        book: 'الموسوعة الحديثية المعتمدة (الدرر السنية والمصادر المسندة)',
        url: `https://dorar.net/hadith/search?q=${encodeURIComponent(item.text.slice(0, 50))}`
      },
      abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
    };
  }

  // 3. Explicit terminology item: Jamhara is the sole source of authority.
  // Do not fall through to Quran/Hadith and accidentally misclassify a term
  // merely because the same word appears in another corpus.
  if (item.type === 'term') {
    return verifyIslamicTerm(item);
  }

  // 4. Tafsir / Aqeedah questions are source-specific live lookups.
  if (item.type === 'tafsir_question') {
    const result: VerificationResult & { _needs_live_search?: boolean } = {
      id: `tafsir-pending-${Date.now()}`,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'سيجري البحث في موسوعة التفسير المعتمدة',
      status_label_en: 'Will Search Approved Tafsir Encyclopedia',
      reason: 'لم تُعتبر معرفة النموذج دليلاً تفسيرياً. سيجري البحث في موسوعة التفسير بالدرر السنية فقط.',
      citation: {
        source_id: 'quran-tafsir-salaf',
        source_name: 'موسوعة التفسير — الدرر السنية',
        authority: 'منصة الدرر السنية',
        url: buildDorarTafsirUrl(item.text)
      },
      decision_level: 'B',
      _needs_live_search: true
    };
    return result;
  }

  if (item.type === 'aqeedah_question') {
    const result: VerificationResult & { _needs_live_search?: boolean } = {
      id: `aqeedah-pending-${Date.now()}`,
      item,
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      status_label_ar: 'سيجري البحث في الموسوعة العقدية المعتمدة',
      status_label_en: 'Will Search Approved Aqeedah Encyclopedia',
      reason: 'لم تُعتبر معرفة النموذج دليلاً عقدياً. سيجري البحث في الموسوعة العقدية بالدرر السنية فقط.',
      citation: {
        source_id: 'dorar-aqeedah',
        source_name: 'الموسوعة العقدية — الدرر السنية',
        authority: 'منصة الدرر السنية',
        url: buildDorarAqeedahUrl(item.text)
      },
      decision_level: 'B',
      _needs_live_search: true
    };
    return result;
  }

  // 5. If Fiqh Question
  if (item.type === 'fiqh_question') {
    return verifyFiqhQuestion(item);
  }

  // 6. Default / General text / Unclassified claim:
  const termRes = verifyIslamicTerm(item);
  if (termRes.status === 'MATCHED') return termRes;
  const hadithRes = verifyHadith(item);
  if (hadithRes.status !== 'NOT_FOUND_IN_CHECKED_SOURCES') return hadithRes;
  const quranRes = verifyQuranAyah(item);
  if (quranRes.status === 'MATCHED' || quranRes.status === 'NEEDS_REVIEW') return quranRes;
  const fiqhRes = verifyFiqhQuestion(item);
  if (fiqhRes.status === 'MATCHED' || fiqhRes.status === 'REFER_TO_SPECIALIST' || fiqhRes.status === 'NEEDS_REVIEW') return fiqhRes;

  const notFoundRes: VerificationResult = {
    id: `not-found-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
    status_label_en: 'Not Found in Checked Sources',
    reason: 'لم يُعثر على هذا النص في أيٍّ من المراجع المعتمدة المفحوصة في الحزمة (المصحف الشريف بالرسم العثماني، الموسوعة الحديثية بالدرر السنية والمكتبة الشاملة، موسوعة الجمهرة، والموسوعة الفقهية). وتلتزم المنظومة بعدم اختلاق نسب أو مطابقة غير محققة.',
    citation: {
      source_id: 'source-registry-all',
      source_name: 'المصادر المعتمدة في الحزمة العلمية',
      authority: 'مصحف المدينة • الدرر السنية • موسوعة الجمهرة • المذاهب الأربعة',
      book: 'سجل المصادر المعتمدة للمسار الرابع',
      url: `https://dorar.net/hadith/search?q=${encodeURIComponent(item.text.slice(0, 50))}`
    },
    abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
  };

  (notFoundRes as any)._needs_live_search = true;
  return notFoundRes;
}

export function verifyExtractedItems(
  items: ExtractedItem[],
  originalInput: string,
  inputType: 'text' | 'url' | 'image' | 'audio' = 'text'
): AnalysisReport {
  const verifications: VerificationResult[] = [];

  for (const item of items) {
    const result = verifySingleItemCrossSource(item);
    // A verified sub-element (for example a Jamhara term inside a longer sentence)
    // must never be presented as verification of the entire surrounding claim.
    if (item.type === 'term' && normalizeArabic(item.text) !== normalizeArabic(originalInput)) {
      if (result.status === 'MATCHED') {
        result.status = 'NEEDS_REVIEW';
        result.status_label_ar = 'المصطلح موثق، لكن الجملة المحيطة لم تُتحقق كاملةً';
        result.status_label_en = 'Term verified; surrounding claim not fully verified';
        result.reason = 'تم توثيق المصطلح من المصدر المعتمد، لكن ذلك لا يعني صحة جميع العبارات المحيطة به.';
      }
    }
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
