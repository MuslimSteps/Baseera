/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live Fiqh Verification Gate
 *
 * قاعدة المصدر:
 * - لا توجد قاعدة بيانات فقهية محلية داخل التطبيق.
 * - لا تُضمَّن أحكام أو موضوعات أو روابط مقالات بعينها في الشفرة.
 * - كل مادة فقهية تُسترجع حيًا من المصدر المعتمد، وتُستخدم طبقة الذكاء الاصطناعي
 *   لفهم السؤال واختيار المرشح من نتائج المصدر فقط.
 *
 * طبقة الأمان:
 * «النموذج لا يصدر حكمًا شرعيًا من معرفته الخاصة، ولا يختلق دليلاً أو مصدرًا».
 */

import { normalizeArabic } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';
import { buildDorarFiqhUrl } from './dorarQueryUtils.ts';

const FIQH_GENERIC_WORDS = new Set([
  'ما','هو','هي','هل','هذه','هذا','ذلك','تلك','المسألة','المساله','مسألة','مساله',
  'الأمر','الامر','الفعل','موضوع','موضع','أمر','امر','خلاف','خلافية','خلافيه',
  'مختلف','مختلفة','مسائل','المسائل','الحكم','حكم','الشرع','الشرعي','الشريعة',
  'الإسلام','الإسلامي','الفقه','الدين'
]);

function hasConcreteFiqhSubject(text: string): boolean {
  const normalized = normalizeArabic(text || '')
    .replace(/[؟?.,!؛،:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const subject = normalized
    .replace(/^ما\s+(?:هو\s+)?حكم\s*/i, '')
    .replace(/^ما\s+حكم\s*/i, '')
    .replace(/^هل\s+(?:يجوز|يجب|يصح|يحل|يحرم)\s*/i, '')
    .replace(/^ما\s+رأي\s+الشرع\s+في\s*/i, '')
    .replace(/\b(?:حكم|يجوز|يجب|يصح|يحرم|واجب|فرض|حرام|مكروه|مستحب|جائز)\b/gi, ' ');

  const tokens = subject
    .split(/\s+/)
    .map(w => w.replace(/^ال/, ''))
    .map(w => w.replace(/[^\u0621-\u064Aa-zA-Z0-9_-]/g, ''))
    .filter(w => w.length >= 3 && !FIQH_GENERIC_WORDS.has(w));

  return tokens.length > 0;
}

const SENSITIVE_FIQH_PATTERNS: RegExp[] = [
  /سب\s+(?:الله|الدين|الرسول|النبي)/i,
  /شتم\s+(?:الله|الدين|الرسول|النبي)/i,
  /إهان(?:ة|ه)\s+(?:الله|الدين|الرسول|النبي)/i,
  /الاستهزاء\s+(?:بالله|بالدين|بالرسول|بالإسلام|بالقرآن)/i,
  /استهز(?:أ|اء)\s+(?:بالله|بالدين|بالرسول|بالإسلام|بالقرآن)/i,
  /(?:الردة|الردّة|المرتد|الكفر|تكفير|التكفير)/i,
  /(?:الزنا|القذف|الحدود|القصاص|القتل)\b/i,
  /(?:الطلاق|اللعان|النسب|النكاح)\b/i
];

/**
 * Questions involving takfir/apostasy, blasphemy, or other high-consequence
 * personal/legal matters are referral-only. This is safety policy, not a
 * database of religious content.
 */
export function isSensitiveFiqhQuestion(text: string): boolean {
  const normalized = normalizeArabic(text || '');
  return SENSITIVE_FIQH_PATTERNS.some(re => re.test(normalized));
}

function isPersonalDispute(text: string): boolean {
  const normalized = normalizeArabic(text || '');

  return (
    normalized.includes('طلقت') ||
    normalized.includes('حلفت على زوجتي') ||
    normalized.includes('زوجتي ذهبت') ||
    normalized.includes('هل وقع طلاقي') ||
    normalized.includes('هل يقع طلاقي') ||
    normalized.includes('توفي والدي وترك') ||
    normalized.includes('تقسم التركة') ||
    normalized.includes('هل يجوز لي شخصيا')
  );
}

/**
 * Every fiqh question enters the live retrieval pipeline.
 * There is deliberately no local topic matcher and no hard-coded fiqh answer.
 */
export function verifyFiqhQuestion(item: ExtractedItem): VerificationResult {
  const searchUrl = buildDorarFiqhUrl(item.text);
  const sensitive = isSensitiveFiqhQuestion(item.text);
  const personal = isPersonalDispute(item.text);

  // A generic label such as «مسألة خلافية» or «ما حكم هذه المسألة؟» has no
  // concrete subject. Never let source-search ranking turn it into an
  // unrelated Fiqh article.
  if (!sensitive && !personal && !hasConcreteFiqhSubject(item.text)) {
    return {
      id: `fiqh-unclear-${Date.now()}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'السؤال غير محدد بما يكفي للبحث الفقهي',
      status_label_en: 'Fiqh Question Is Too Vague to Search Reliably',
      reason: 'لم يتضمن الإدخال موضوعًا فقهيًا محددًا يمكن ربطه بمادة مصدرية بعينها. لن تختار بصيرة مقالًا غير مرتبط لمجرد تشابه عام في نتائج البحث؛ اذكر الفعل أو المسألة محل السؤال بوضوح.',
      citation: {
        source_id: 'fiqh-madhahib-dorar',
        source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية',
        authority: 'مؤسسة الدرر السنية',
        url: searchUrl
      },
      abstention_note: 'امتناع عن اختيار مادة فقهية غير مرتبطة بسبب غموض المدخل.',
      decision_level: 'C'
    };
  }

  const result: VerificationResult = {
    id: `fiqh-live-${Date.now()}`,
    item,
    status: sensitive || personal ? 'REFER_TO_SPECIALIST' : 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: sensitive || personal
      ? 'إحالة إلى جهة مؤهلة — البحث المصدرّي مستمر'
      : 'جارٍ البحث في المصدر الفقهي المعتمد',
    status_label_en: sensitive || personal
      ? 'Refer to Qualified Authority — Live Source Retrieval'
      : 'Live Search in Approved Fiqh Source',
    reason: sensitive
      ? 'المسألة عالية الحساسية؛ لا يصدر النظام فتوى أو ترجيحًا آليًا. سيُستخدم المصدر المعتمد للمراجعة فقط.'
      : personal
        ? 'هذه حالة شخصية تتطلب جهة إفتاء مؤهلة. سيُستخدم المصدر المعتمد للمراجعة فقط دون فتوى شخصية.'
        : 'لا يعتمد النظام على سجل فقهي محلي. سيُفهم السؤال آليًا، ثم تُسترجع نتائج حية من الموسوعة الفقهية المعتمدة ويُختار المرشح منها فقط.',
    citation: {
      source_id: 'fiqh-madhahib-dorar',
      source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية',
      authority: 'مؤسسة الدرر السنية',
      url: searchUrl
    },
    abstention_note: sensitive || personal
      ? 'المصدر المعروض للمراجعة البشرية فقط، وليس فتوى صادرة عن بصيرة.'
      : undefined,
    decision_level: sensitive || personal ? 'D' : 'C'
  };

  (result as any)._needs_live_search = true;
  (result as any)._fiqh_url = searchUrl;
  return result;
}
