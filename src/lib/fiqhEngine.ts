/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fiqhData from '../../sources/fiqh.json' with { type: 'json' };
import { normalizeArabic } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

export function verifyFiqhQuestion(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);

  // Search fiqh topics
  const matched = fiqhData.topics.find(t => {
    const normTopic = normalizeArabic(t.topic);
    return normInput.includes(normTopic) || normTopic.includes(normInput) ||
      (t.topic.includes('طلاق') && (normInput.includes('طلاق') || normInput.includes('زوجتي'))) ||
      (t.topic.includes('وضوء') && normInput.includes('وضوء') && normInput.includes('لمس')) ||
      (t.topic.includes('قنوت') && normInput.includes('قنوت'));
  });

  const citation = {
    source_id: 'fiqh-madhahib-dorar',
    source_name: 'الموسوعة الفقهية — الدرر السنية والكتب المعتمدة للمذاهب الأربعة',
    authority: 'المذاهب الفقهية الأربعة (الحنفي، المالكي، الشافعي، الحنبلي)',
    book: matched ? matched.topic : 'الموسوعة الفقهية المقارنة'
  };

  // Level D: Personal Fatwa / Case -> Strict Referral
  if (matched?.level === 'D' || normInput.includes('طلقت') || normInput.includes('زوجتي') || normInput.includes('هل يجوز لي شخصيا')) {
    return {
      id: `fiqh-ref-${Date.now()}`,
      item,
      status: 'REFER_TO_SPECIALIST',
      status_label_ar: 'إحالة إلى جهة إفتاء مؤهلة',
      status_label_en: 'Refer to Qualified Authority',
      reason: matched?.abstention_statement || 'هذه مسألة نازلة أو حالة شخصية تتطلب الاستماع المباشر ومعرفة الملابسات من هيئة إفتاء رسمية أو محكمة شرعية، ولا يقدم النظام حكمًا شرعيًا مستقلاً.',
      citation,
      abstention_note: 'هذه حالة شخصية تتطلب جهة مؤهلة.',
      decision_level: 'D'
    };
  }

  // Level C: Disputed among Four Madhhabs -> Show viewpoints without automated bias
  if (matched?.level === 'C') {
    return {
      id: `fiqh-${matched.id}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'مسألة خلافية بين المذاهب الأربعة (دون ترجيح آلي)',
      status_label_en: 'Scholarly Difference (No Automated Preference)',
      reason: `مسألة خلافية سائغة بين أئمة الفقه، ويعرض النظام أقوال المذاهب المعتمدة دون ترجيح آلي أو فتوى جازمة: ${matched.decision_rule}`,
      citation,
      school_positions: matched.positions,
      decision_level: 'C'
    };
  }

  // Level A: Established Consensus
  if (matched?.level === 'A') {
    return {
      id: `fiqh-${matched.id}`,
      item,
      status: 'MATCHED',
      status_label_ar: 'معلومة مستقرة مجمع عليها',
      status_label_en: 'Established Consensus (Ijma)',
      reason: `حكم مجمع عليه قطعي الثبوت والدلالة في المذاهب الأربعة: ${matched.summary}`,
      citation,
      canonical_text: matched.summary,
      decision_level: 'A'
    };
  }

  // Fallback for unlisted fiqh queries
  return {
    id: `fiqh-unknown-${Date.now()}`,
    item,
    status: 'REFER_TO_SPECIALIST',
    status_label_ar: 'إحالة إلى مختص',
    status_label_en: 'Refer to Specialist',
    reason: 'المسألة الفقهية غير مدرجة ضمن المسائل المفحوصة، وقاعدة بصيرة: الامتناع أو الإحالة إلى الهيئات الشرعية المعتمدة.',
    citation,
    abstention_note: 'توجد معلومات تحتاج إلى مراجعة مختص أو جهة إفتاء معتمدة.',
    decision_level: 'D'
  };
}
