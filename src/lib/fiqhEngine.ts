/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * محرك الفقه والنوازل — Fiqh & Fatwa Decision Engine
 *
 * القاعدة الحاكمة الصارمة:
 * «النموذج لا يصدر حكماً شرعياً ولا يختلق دليلاً، وعند عدم ثبوت النص الصريح المعتمد:
 *  الامتناع الصارم (لم يُعثر عليه في المراجع المفحوصة) أو الإحالة إلى جهة إفتاء رسمية.»
 */

import fiqhData from '../../sources/fiqh.json' with { type: 'json' };
import { normalizeArabic } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';
import { generateSearchQueries, cleanSearchQuery, buildDorarFiqhUrl } from './dorarClient.ts';

// Stopwords to strip before searching
const FIQH_STOPWORDS = new Set([
  'ما', 'حكم', 'في', 'من', 'على', 'عن', 'هل', 'يجوز', 'يصح',
  'الشرع', 'ماذا', 'كيف', 'رأي', 'الشريعة', 'الإسلام', 'الإسلامي',
  'الفقه', 'الدين', 'الشرعي', 'المسلم', 'المسلمين', 'قول', 'هو', 'هي', 'أن'
]);

/**
 * Extract meaningful, specific content words from a fiqh question
 * Strips 'ال' prefix and filters out short words and generic stopwords
 */
function extractMeaningfulWords(normText: string): string[] {
  return normText
    .split(/\s+/)
    .map(w => w.replace(/^ال/, ''))
    .filter(w => w.length >= 3 && !FIQH_STOPWORDS.has(w));
}

export function verifyFiqhQuestion(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);

  // ── المستوى د (Level D): الحالات الشخصية والمنازعات الأسرية والقضائية ──
  // الامتناع الصارم والإحالة الفورية لدار الإفتاء والمحاكم الشرعية
  const isPersonalDispute =
    normInput.includes('طلقت') ||
    normInput.includes('حلفت على زوجتي') ||
    normInput.includes('زوجتي ذهبت') ||
    normInput.includes('هل وقع طلاقي') ||
    normInput.includes('هل يقع طلاقي') ||
    normInput.includes('توفي والدي وترك') ||
    normInput.includes('تقسم التركة') ||
    normInput.includes('هل يجوز لي شخصيا');

  const feqhiaSearchUrl = buildDorarFiqhUrl(item.text);

  const baseCitation = {
    source_id: 'fiqh-madhahib-dorar',
    source_name: 'الموسوعة الفقهية — الدرر السنية والكتب المعتمدة للمذاهب الأربعة',
    authority: 'المذاهب الفقهية الأربعة (الحنفي، المالكي، الشافعي، الحنبلي)',
    book: 'الموسوعة الفقهية المقارنة',
    url: feqhiaSearchUrl
  };

  if (isPersonalDispute) {
    return {
      id: `fiqh-ref-${Date.now()}`,
      item,
      status: 'REFER_TO_SPECIALIST',
      status_label_ar: 'إحالة إلى جهة إفتاء مؤهلة (امتناع آلي)',
      status_label_en: 'Refer to Qualified Authority',
      reason: 'هذه مسألة نازلة أو حالة شخصية تتعلق بالفروج أو المنازعات الأسرية أو قسمة التركات وتتطلب الاستماع المباشر ومعرفة الملابسات من هيئة إفتاء رسمية أو محكمة شرعية، ولا يقدم النظام حكمًا شرعيًا مستقلاً.',
      citation: baseCitation,
      abstention_note: 'هذه حالة شخصية أو نازلة معقدة تتطلب جهة مؤهلة ومحكمة شرعية.',
      decision_level: 'D'
    };
  }

  // ── الطبقة الأولى: البحث في المسائل الفقهية المعتمدة (sources/fiqh.json) ──
  const matched = fiqhData.topics.find(t => {
    // 1. فحص الكلمات المفتاحية
    const kws = (t as any).keywords as string[] | undefined;
    if (kws?.length) {
      for (const kw of kws) {
        const normKw = normalizeArabic(kw);
        if (normKw.length >= 3 && normInput.includes(normKw)) {
          return true;
        }
      }
    }
    // 2. فحص عنوان المسألة
    const normTopic = normalizeArabic(t.topic);
    if (normInput.includes(normTopic) || (normTopic.length >= 8 && normInput.includes(normTopic.slice(0, 15)))) {
      return true;
    }
    return false;
  });

  // المستوى أ: معلومة مستقرة مجمع عليها (إجماع قطعي مع الدليل)
  if (matched?.level === 'A') {
    return {
      id: `fiqh-${matched.id}`,
      item,
      status: 'MATCHED',
      status_label_ar: 'معلومة مستقرة مجمع عليها (حكم معتمد مع الدليل)',
      status_label_en: 'Established Consensus (Ijma & Evidence)',
      reason: `حكم قطعي مجمع عليه في المذاهب الأربعة مع ثبوت الدليل من الكتاب والسنة الصحيحة: ${(matched as any).summary}`,
      citation: {
        ...baseCitation,
        book: matched.topic,
        url: (matched as any)?.url || feqhiaSearchUrl
      },
      canonical_text: (matched as any).summary,
      school_positions: (matched as any).positions,
      decision_level: 'A'
    };
  }

  // المستوى ج: مسألة خلافية سائغة بين المذاهب الأربعة (عرض مقارن دون ترجيح آلي)
  if (matched?.level === 'C') {
    return {
      id: `fiqh-${matched.id}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'مسألة خلافية بين المذاهب الأربعة (عرض مقارن دون ترجيح آلي)',
      status_label_en: 'Scholarly Difference (No Automated Preference)',
      reason: `مسألة خلافية سائغة بين أئمة الفقه، ويعرض النظام أقوال المذاهب المعتمدة دون ترجيح آلي أو فتوى جازمة: ${(matched as any).decision_rule || (matched as any).consensus || ''}`,
      citation: {
        ...baseCitation,
        book: matched.topic,
        url: (matched as any)?.url || feqhiaSearchUrl
      },
      canonical_text: (matched as any).summary,
      school_positions: (matched as any).positions,
      decision_level: 'C'
    };
  }

  // المستوى د: نازلة معقدة
  if (matched?.level === 'D') {
    return {
      id: `fiqh-${matched.id}`,
      item,
      status: 'REFER_TO_SPECIALIST',
      status_label_ar: 'إحالة إلى جهة إفتاء مؤهلة ومجامع فقهية',
      status_label_en: 'Refer to Official Ifta Body',
      reason: (matched as any).abstention_statement || 'مسألة نازلة تتطلب فتوى جماعية من المجامع الفقهية المعتمدة.',
      citation: baseCitation,
      decision_level: 'D'
    };
  }

  // ── عند عدم وجود المسألة في السجل الفقهي المعتمد: التمرير للبحث المباشر والامتناع الصارم ──
  // منعاً للهلوسة: لا نقوم بربط المسألة عشوائياً بأي حديث يحوي كلمة مشتركة (مثل كلمة صوم أو رمضان)
  const meaningfulWords = extractMeaningfulWords(normInput);

  const fallbackResult: VerificationResult = {
    id: `fiqh-abstain-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة (امتناع شرعي)',
    status_label_en: 'Not Found in Checked Sources (Abstention)',
    reason: 'لم يُعثر على نص قطعي أو حديث صريح مطابق لهذه المسألة في المصادر المعتمدة المفحوصة (الموسوعة الفقهية والحديثية). تلتزم منظومة «بصيرة» بالامتناع الصارم عن إصدار أي حكم شرعي أو عزو أحاديث غير مطابقة منعاً للهلوسة والخطأ في دين الله. يمكنك البحث في الموسوعة الفقهية المقارنة بالدرر السنية عبر الرابط المرفق، أو مراجعة أهل العلم المعتمدين.',
    citation: baseCitation,
    decision_level: 'C'
  };

  (fallbackResult as any)._needs_live_search = true;
  (fallbackResult as any)._fiqh_url = feqhiaSearchUrl;
  (fallbackResult as any)._content_words = meaningfulWords;
  return fallbackResult;
}
