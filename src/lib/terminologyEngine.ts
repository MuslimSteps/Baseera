/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import termData from '../../sources/terminology.json' with { type: 'json' };
import { normalizeArabic } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

export function verifyIslamicTerm(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);
  const rawLower = item.text.toLowerCase();
  const contextLower = (item.context || '').toLowerCase();

  // Normalize function for robust English matching (removes apostrophes, hyphens, etc.)
  const normalizeEn = (s: string) => s.toLowerCase().replace(/['''\-]/g, '').trim();
  const normInputEn = normalizeEn(item.text);

  const matched = termData.terms.find(t => {
    const termArNorm = normalizeArabic(t.term_ar);
    const termEnLower = t.term_en.toLowerCase();
    const termEnNorm = normalizeEn(t.term_en);

    // Check Arabic term name
    if (normInput.includes(termArNorm) || termArNorm.includes(normInput)) return true;
    // Check English term (with apostrophe normalization)
    if (normInputEn === termEnNorm) return true;
    if (termEnNorm.includes(normInputEn) && normInputEn.length > 3) return true;
    if (normInputEn.includes(termEnNorm) && termEnNorm.length > 3) return true;
    // Original checks (with raw lower)
    if (rawLower.includes(termEnLower) || termEnLower.includes(rawLower)) return true;
    // Check slash-separated variants
    for (const variant of termEnLower.split('/')) {
      const vn = normalizeEn(variant.trim());
      if (vn === normInputEn || normInputEn.includes(vn) || vn.includes(normInputEn)) return true;
    }
    return false;
  });

  if (matched) {
    // Check for reductionist cues in context
    let isReductionist = false;
    let reductionNote = '';

    const combinedText = `${rawLower} ${contextLower}`;

    if (matched.id === 'term-tawhid') {
      if ((combinedText.includes('only oneness') || combinedText.includes('just monotheism') || combinedText.includes('mere oneness') || combinedText.includes('without worship') || combinedText.includes('deism')) &&
          (!combinedText.includes('worship') || combinedText.includes('without worship'))) {
        isReductionist = true;
        reductionNote = 'تنبيه اختزال: تم تقديم التوحيد كمجرد وحدانية مجردة أو فلسفية دون بيان شقه العملي الأهم وهو إفراد الله بالعبادة والدعاء ونفي الشرك.';
      }
    } else if (matched.id === 'term-sharia') {
      if (combinedText.includes('penal') || combinedText.includes('punishment') || combinedText.includes('flogging') || combinedText.includes('عقوبات') || combinedText.includes('حدود')) {
        if (!combinedText.includes('justice') && !combinedText.includes('mercy') && !combinedText.includes('عدل') && !combinedText.includes('أخلاق')) {
          isReductionist = true;
          reductionNote = 'تنبيه اختزال خطير: تم اختزال الشريعة في العقوبات الجنائية والحدود! الشريعة الإسلامية منظومة شاملة من الأخلاق ومقاصد العدالة والرحمة وحفظ الضروريات الخمس.';
        }
      }
    } else if (matched.id === 'term-jihad') {
      if (combinedText.includes('holy war') || combinedText.includes('حرب مقدسة')) {
        isReductionist = true;
        reductionNote = 'تنبيه تحريف اصطلاحي: مصطلح "Holy War" مفهوم غربي كنسي تاريخي لا وجود له في القرآن والسنة، والجهاد في الإسلام أصله مجاهدة النفس والبيان، والقتالي منه مقيد بالدفاع الشرعي ورد العدوان.';
      }
    } else if (matched.id === 'term-ibadah') {
      if (combinedText.includes('rituals only') || combinedText.includes('مجرد طقوس')) {
        isReductionist = true;
        reductionNote = 'تنبيه اختزال: العبادة في الإسلام اسم جامع لكل ما يحبه الله ويرضاه من الأقوال والأعمال الباطنة والظاهرة، وليست مقتصرة على الطقوس الشعائرية.';
      }
    }

    const citation = {
      source_id: 'jamhara-terms',
      source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
      authority: 'الحزمة المرجعية المعتمدة للمصطلحات والتعريف بالإسلام',
      book: `مفردة: ${matched.term_ar} (${matched.term_en})`,
      url: 'https://islamic-content.com/dictionary'
    };

    if (isReductionist) {
      return {
        id: `term-${matched.id}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'يحتاج مراجعة (استخدام مختزل للمصطلح)',
        status_label_en: 'Needs Review (Reductionist Usage)',
        reason: reductionNote || matched.reduction_warning,
        citation,
        canonical_text: matched.jamhara_definition,
        reduction_warning: matched.reduction_warning,
        jamhara_definition: matched.jamhara_definition,
        verified_translation: matched.approved_translations.join(' | '),
        decision_level: 'B'
      };
    }

    return {
      id: `term-${matched.id}`,
      item,
      status: 'MATCHED',
      status_label_ar: 'معتمد وموثق في موسوعة الجمهرة',
      status_label_en: 'Verified in Jamhara Encyclopedia',
      reason: `تمت مطابقة المصطلح مع التعريف المعتمد في موسوعة الجمهرة وسياقه الشرعي السليم.`,
      citation,
      canonical_text: matched.jamhara_definition,
      reduction_warning: matched.reduction_warning,
      jamhara_definition: matched.jamhara_definition,
      verified_translation: matched.approved_translations.join(' | '),
      decision_level: 'A'
    };
  }

  // If not found in Jamhara
  const pending: VerificationResult & { _needs_live_search?: boolean } = {
    id: `term-notfound-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
    status_label_en: 'Not Found in Checked Sources',
    reason: 'لم يُعثر على توصيف هذا المصطلح في النطاق المفحوص من موسوعة الجمهرة. لا تجزم المنظومة بتعريف آلي غير مدعوم بمرجع.',
    citation: {
      source_id: 'jamhara-terms',
      source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
      authority: 'الحزمة المرجعية المعتمدة للمصطلحات والتعريف بالإسلام'
    },
    abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.',
    _needs_live_search: true
  };
  return pending;
}
