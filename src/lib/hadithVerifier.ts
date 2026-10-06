/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Source-first Hadith verification.
 *
 * The bundled dataset is not treated as an authority. A hadith may only be
 * marked as verified after a strict match against the approved live Dorar
 * Encyclopedia. Approximate matches are never marked MATCHED.
 */

import { normalizeArabic, normalizeArabicStrict, stripPropheticFraming, locateQuoteWindow, computeWordDiff } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

// locateQuoteWindow is provided by normalizer.ts (edit-distance tolerant, shared
// with the Quran verifier so excerpts are detected consistently).

export type DorarMatch = {
  text: string;
  rawi: string;
  muhaddith: string;
  book: string;
  numberOrPage: string;
  grade: string;
  gradeCategory: 'sahih' | 'hasan' | 'weak' | 'fabricated' | 'unknown' | 'disputed';
  isDisputed?: boolean;
  disputeDetails?: string;
  matchQuality?: 'exact' | 'partial' | 'close';
  /** Real Dorar permalink id and direct page URL (https://dorar.net/h/<id>). */
  id?: string | null;
  url?: string | null;
};

type HadithVerificationResult = VerificationResult & { _needs_live_search?: boolean };

function notFound(item: ExtractedItem, reason: string): HadithVerificationResult {
  return {
    id: `hadith-notfound-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُثبت في المصدر الحديثي المعتمد بعد',
    status_label_en: 'Not Yet Verified in the Approved Hadith Source',
    reason,
    citation: {
      source_id: 'dorar-hadith',
      source_name: 'الموسوعة الحديثية — الدرر السنية',
      authority: 'مؤسسة الدرر السنية للإشراف العلمي'
    },
    abstention_note: 'لا تُثبت النسبة إلى النبي ﷺ حتى توجد مطابقة صريحة في المصدر الحديثي المعتمد.',
    _needs_live_search: true
  };
}

export function verifyHadith(item: ExtractedItem): HadithVerificationResult {
  const normalizedInput = normalizeArabic(item.text).trim();

  if (!normalizedInput || normalizedInput.split(/\s+/).length < 3) {
    return notFound(item, 'النص قصير جداً لإثبات نسبة حديث من خلال المطابقة النصية الصارمة.');
  }

  // The checked-in corpus can help benchmark/development workflows, but is
  // deliberately not trusted for user-facing religious verification.
  return notFound(
    item,
    'لم يُثبت هذا الحديث بعد من المصدر الحديثي المعتمد. ستُجرى مطابقة صارمة في منصة الدرر السنية قبل إصدار نتيجة موثقة.'
  );
}

export function buildHadithDecision(item: ExtractedItem, bestMatch: DorarMatch): VerificationResult {
  // Match on the actual matn, not on the surrounding narration frame
  // («قال رسول الله ﷺ: …»).
  const matnInput = stripPropheticFraming(item.text);
  const normalizedInput = normalizeArabicStrict(matnInput);
  const normalizedCanonical = normalizeArabicStrict(bestMatch.text);

  const exact = normalizedInput === normalizedCanonical;
  const quoteWindow = exact ? null : locateQuoteWindow(matnInput, bestMatch.text);
  const partial =
    !exact &&
    ((normalizedCanonical.includes(normalizedInput) && normalizedInput.split(/\s+/).length >= 4) ||
      quoteWindow !== null);

  // Evidence boundary: a hadith may only cite a REAL permalink page
  // (https://dorar.net/h/<id>). A search URL is never a source and is never
  // emitted here; when no permalink exists the citation carries no URL.
  const permalink =
    bestMatch.url && /^https:\/\/dorar\.net\/h\/[A-Za-z0-9]+$/.test(bestMatch.url)
      ? bestMatch.url
      : bestMatch.id
        ? `https://dorar.net/h/${bestMatch.id}`
        : undefined;

  const citation = {
    source_id: 'dorar-hadith',
    source_name: 'الموسوعة الحديثية — الدرر السنية',
    authority: 'مؤسسة الدرر السنية للإشراف العلمي',
    book: bestMatch.book,
    number_or_page: bestMatch.numberOrPage,
    grade: bestMatch.grade,
    url: permalink
  };

  if (item.claimed_source) {
    const claim = normalizeArabic(item.claimed_source);
    const book = normalizeArabic(bestMatch.book);
    const knownBook = /بخاري|مسلم|ترمذي|أحمد|ابن ماجه|أبي داود|ابي داود|نسائي|موطأ|موطا|مالك|الدارمي|النسائي|ابن حبان|الحاكم/.test(claim);
    if (knownBook && !book.includes(claim.replace(/^صحيح|سنن|مسند/,'').trim()) && !claim.includes(book.replace(/^صحيح|سنن|مسند/,'').trim())) {
      return {
        id: `hadith-attribution-${Date.now()}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: 'خطأ في العزو — المتن وُجد لكن المصدر المذكور لا يطابق المصدر الموثق',
        status_label_en: 'Source Attribution Mismatch',
        reason: `المتن موجود في الموسوعة الحديثية، لكن العزو المذكور («${item.claimed_source}») لا يطابق المصدر الموثق («${bestMatch.book}»).`,
        citation,
        canonical_text: bestMatch.text,
        decision_level: 'B',
        abstention_note: 'لا تُثبت النسبة إلى النبي ﷺ حتى توجد مطابقة صريحة في المصدر الحديثي المعتمد.'
      };
    }
  }

  if (!exact && !partial)
    return {
      id: `hadith-review-${Date.now()}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'يحتاج مراجعة — عُثر على نتيجة قريبة دون ثبوت مطابقة اللفظ',
      status_label_en: 'Needs Review — Related result found, wording not proven identical',
      reason: (bestMatch.gradeCategory === 'weak' || bestMatch.gradeCategory === 'fabricated' || bestMatch.gradeCategory === 'unknown')
        ? `عُثر على رواية قريبة اللفظ في المصدر المعتمد («${bestMatch.book}»)، ودرجتها في المصدر: ${bestMatch.grade || 'غير محددة'}. النص المدخل لا يطابقها مطابقة حرفية كاملة؛ لذلك لا تُنسب إلى النبي ﷺ آليًا.`
        : 'وجدت منصة الدرر السنية نتيجة قريبة، لكن النص المدخل لا يطابقها مطابقة صريحة؛ لذلك لا تُنسب الرواية إلى النبي ﷺ آلياً.',
      citation,
      canonical_text: bestMatch.text,
      decision_level: 'B',
      abstention_note: 'لا تُثبت النسبة إلى النبي ﷺ حتى توجد مطابقة صريحة في المصدر الحديثي المعتمد.'
    };

  if (bestMatch.isDisputed || bestMatch.gradeCategory === 'disputed') {
    return {
      id: `hadith-${Date.now()}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'حديث مختلف في صحته — لا يُجزم بنسبته',
      status_label_en: 'Disputed Hadith — Attribution Not Certain',
      reason: bestMatch.disputeDetails || 'المصدر المعتمد يذكر خلافاً في ثبوته.',
      citation,
      canonical_text: bestMatch.text,
      decision_level: 'B'
    };
  }

  if (bestMatch.gradeCategory === 'fabricated') {
    return {
      id: `hadith-${Date.now()}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: 'حديث موضوع/مكذوب — لا يجوز نسبته إلى النبي ﷺ',
      status_label_en: 'Fabricated/Rejected Hadith',
      reason: `الحكم في المصدر المعتمد: ${bestMatch.grade}.`,
      citation,
      canonical_text: bestMatch.text,
      decision_level: 'B'
    };
  }

  if (bestMatch.gradeCategory === 'weak' || bestMatch.gradeCategory === 'unknown') {
    return {
      id: `hadith-${Date.now()}`,
      item,
      status: 'NEEDS_REVIEW',
      status_label_ar: bestMatch.gradeCategory === 'weak'
        ? 'حديث ضعيف — لا تصح نسبته إلى النبي ﷺ'
        : 'حديث غير ثابت الدرجة — لا تصح نسبته إلى النبي ﷺ',
      status_label_en: 'Weak / Unverified Hadith — Attribution Not Established',
      reason: `درجة الحديث في المصدر المعتمد: ${bestMatch.grade || 'غير محددة'}.`,
      citation,
      canonical_text: bestMatch.text,
      decision_level: 'B'
    };
  }

  const authentic = bestMatch.gradeCategory === 'sahih' || bestMatch.gradeCategory === 'hasan';

  if (partial && authentic) {
    const gradeLabel = bestMatch.gradeCategory === 'hasan' ? 'حسن' : 'صحيح';
    const partialDiff = computeWordDiff(matnInput, bestMatch.text).diff;
    const hasChange = partialDiff.some(d => d.type === 'changed' || d.type === 'missing' || d.type === 'added');
    return {
      id: `hadith-${Date.now()}`,
      item,
      status: 'MATCHED',
      status_label_ar: hasChange
        ? `جزء من حديث ${gradeLabel} — مع اختلاف يسير في اللفظ (انظر التظليل)`
        : `مطابق للمصدر — النص جزء من حديث ${gradeLabel}`,
      status_label_en: 'Verified Hadith Excerpt',
      reason: `المقطع المدخل جزء من متن الرواية في المصدر الحديثي المعتمد («${bestMatch.book}»)، وهو جزء من حديث ${gradeLabel} وليس كامل الحديث${hasChange ? '، مع فروق يسيرة في اللفظ موضّحة بالتظليل دون استبدال لفظك' : ''}.`,
      citation,
      canonical_text: bestMatch.text,
      is_partial_quote: true,
      quote_window: quoteWindow || undefined,
      diff: partialDiff,
      decision_level: 'B'
    };
  }

  return {
    id: `hadith-${Date.now()}`,
    item,
    status: partial ? 'NEEDS_REVIEW' : 'MATCHED',
    status_label_ar: partial
      ? 'مطابقة جزئية موثقة — لا تثبت الحديث كاملًا'
      : (bestMatch.gradeCategory === 'hasan' ? 'حديث حسن ثابت في الدرر السنية' : 'حديث صحيح ثابت في الدرر السنية'),
    status_label_en: partial ? 'Partial Match — Review Required' : 'Verified Hadith in Dorar',
    reason: partial
      ? 'المقطع المدخل وارد حرفياً ضمن متن الرواية في المصدر الحديثي المعتمد. لم يُعامل المقطع على أنه كامل الحديث.'
      : 'النص المدخل يطابق متن الرواية في المصدر الحديثي المعتمد، مع إظهار الراوي والمحدث والمصدر ودرجة الحكم.',
    citation,
    canonical_text: bestMatch.text,
    decision_level: partial ? 'B' : 'A'
  };
}
