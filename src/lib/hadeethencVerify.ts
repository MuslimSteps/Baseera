/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HadeethEnc verification layer (via the approved Islamic Content MCP).
 *
 * HadeethEnc is an approved hadith encyclopedia from the scientific package. It
 * is retrieved through the approved MCP server (islamic-content-mcp) and returns
 * the canonical narration with its grade, attribution and a real permalink
 * (hadeethenc.com/ar/browse/hadith/<id>) — never a search URL.
 */

import { normalizeArabicStrict, normalizeArabic, stripPropheticFraming, locateQuoteWindow, computeWordDiff } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';
import { searchHadeethEnc, IslamicContentDocument } from './islamicContentMcpClient.ts';

// locateQuoteWindow is provided by normalizer.ts (edit-distance tolerant, shared
// with the Quran verifier so excerpts are detected consistently).

function classifyHadeethEncGrade(grade: string): 'sahih' | 'hasan' | 'weak' | 'fabricated' | 'unknown' {
  const g = grade || '';
  if (/موضوع|مكذوب|باطل|لا أصل له|منكر/.test(g)) return 'fabricated';
  if (/ضعيف|لا يصح|لا يثبت/.test(g)) return 'weak';
  if (/صحيح|متفق عليه|حسن/.test(g)) return /حسن/.test(g) && !/صحيح/.test(g) ? 'hasan' : 'sahih';
  return 'unknown';
}

/** Extracts the canonical matn (the quoted «...» narration) from a document. */
function extractMatn(doc: IslamicContentDocument): string {
  const exactSegments = (doc.segments || [])
    .filter((s) => s.kind === 'exact' && s.text)
    .map((s) => s.text);
  const source = exactSegments.length ? exactSegments.join(' ') : (doc.text || '');
  const quoted = source.match(/[«"]([^»"]{5,})[»"]/);
  return (quoted ? quoted[1] : (doc.title || source)).trim();
}

interface ScoredDoc {
  doc: IslamicContentDocument;
  matn: string;
  exact: boolean;
  partial: boolean;
  similarity: number;
}

function hasSubstantiveDifferences(diff: any[]): boolean {
  return diff.some(
    d => d.type === 'missing' ||
         d.type === 'added' ||
         (d.type === 'changed' && normalizeArabic(d.word) !== normalizeArabic(d.expected || ''))
  );
}

function scoreDoc(input: string, doc: IslamicContentDocument): ScoredDoc {
  const normInput = normalizeArabicStrict(input);
  const looseInput = normalizeArabic(input);
  const matn = extractMatn(doc);
  const normMatn = normalizeArabicStrict(matn);
  const looseMatn = normalizeArabic(matn);
  const normTitle = normalizeArabicStrict(doc.title || '');
  const looseTitle = normalizeArabic(doc.title || '');

  // "Exact" means the FULL narration matn — NOT the entry's short title (which is
  // often just the famous opening phrase). A title match is therefore treated as
  // a partial excerpt, so the interface reports «جزء من الحديث» instead of
  // presenting a short quote as the whole hadith.
  const exact = normInput === normMatn || looseInput === looseMatn;
  // Verbatim sub-quote: the user quoted a part of the narration, or the whole
  // narration plus surrounding framing. Both are exact wording matches.
  const partial =
    !exact &&
    looseInput.split(/\s+/).length >= 3 &&
    (normMatn.includes(normInput) || normTitle.includes(normInput) ||
      looseMatn.includes(looseInput) || looseTitle.includes(looseInput) ||
      (looseMatn.length >= 10 && looseInput.includes(looseMatn)));

  // token overlap similarity against the matn/title
  const inputTokens = new Set(looseInput.split(/\s+/).filter(Boolean));
  const targetTokens = new Set((looseMatn + ' ' + looseTitle).split(/\s+/).filter(Boolean));
  let shared = 0;
  for (const t of inputTokens) if (targetTokens.has(t)) shared++;
  let similarity = inputTokens.size ? shared / inputTokens.size : 0;

  // Exact variant ranking: if the matn contains the exact words without substantive changes (e.g. بالنيات vs بالنية)
  const diffCheck = computeWordDiff(input, matn);
  const hasSubstantive = hasSubstantiveDifferences(diffCheck.diff);
  if (!hasSubstantive && (partial || similarity >= 0.7)) {
    similarity += 1000; // massive priority boost so exact narration variant is chosen
  }

  return { doc, matn, exact, partial, similarity };
}

function isPermalink(url: string): boolean {
  return /^https:\/\/hadeethenc\.com\/(?:[a-z]{2}\/)?browse\/hadith\/[A-Za-z0-9]+$/.test(url || '');
}

/**
 * Verifies a hadith against HadeethEnc through the MCP.
 * Returns null when nothing usable was retrieved (so callers can fall back).
 */
export async function verifyHadithWithHadeethEnc(
  item: ExtractedItem
): Promise<VerificationResult | null> {
  let docs: IslamicContentDocument[];
  const matnInput = stripPropheticFraming(item.text);
  try {
    docs = await searchHadeethEnc(matnInput, 'ar', 5);
  } catch {
    return null;
  }
  const usable = docs.filter((d) => d.text || d.title);
  if (!usable.length) return null;

  const scored = usable
    .map((d) => scoreDoc(matnInput, d))
    .filter((s) => s.exact || s.partial || s.similarity >= 0.6)
    .sort((a, b) => {
      const rank = (s: ScoredDoc) => (s.exact ? 3 : s.partial ? 2 : 1) * 1000 + s.similarity * 100;
      return rank(b) - rank(a);
    });

  if (!scored.length) return null;
  const best = scored[0];
  const gradeRaw = String(best.doc.metadata?.grade || '');
  const attribution = String(best.doc.metadata?.attribution || '');
  const gradeCategory = classifyHadeethEncGrade(gradeRaw);
  const permalink = isPermalink(best.doc.url) ? best.doc.url : undefined;

  const citation = {
    source_id: 'hadeethenc-hadith',
    source_name: 'موسوعة الحديث النبوي المعتمدة',
    authority: 'قاعدة الأحاديث النبوية المعتمدة',
    book: attribution || 'موسوعة الحديث النبوي المعتمدة',
    grade: gradeRaw || undefined,
    url: permalink
  };

  const canonicalText = best.matn || best.doc.text;
  const isFullNarration = normalizeArabic(matnInput) === normalizeArabic(canonicalText);
  const quoteWindow = isFullNarration ? null : locateQuoteWindow(matnInput, canonicalText);
  const inputCount = normalizeArabic(matnInput).split(/\s+/).filter(Boolean).length;
  const canonicalCount = normalizeArabic(canonicalText).split(/\s+/).filter(Boolean).length;

  // A shorter verbatim/close extract of the narration is an EXCERPT of the
  // hadith, never the full hadith — even when it happens to equal the entry's
  // short title (which is how «إنما الأعمال بالنيات» matched before).
  const isExcerpt =
    !isFullNarration &&
    inputCount >= 3 &&
    inputCount < canonicalCount &&
    (best.partial || quoteWindow !== null);

  const authentic = gradeCategory === 'sahih' || gradeCategory === 'hasan';

  if (authentic && permalink && isFullNarration) {
    return {
      id: `hadeethenc-${Date.now()}`,
      item,
      status: 'MATCHED',
      status_label_ar: `حديث ${gradeCategory === 'hasan' ? 'حسن' : 'صحيح'} ثابت في موسوعة الحديث المعتمدة`,
      status_label_en: 'Verified Hadith',
      reason: `النص مطابق لمتن الرواية في موسوعة الحديث المعتمدة، مع إظهار الراوي والدرجة والرابط.${attribution ? ` (${attribution})` : ''}`,
      citation,
      canonical_text: canonicalText,
      decision_level: 'A'
    };
  }

  if (authentic && permalink && isExcerpt) {
    const gradeLabel = gradeCategory === 'hasan' ? 'حسن' : 'صحيح';
    // Surface any substantive wording difference (e.g. «بالنيات» in the user's copy vs
    // «بالنية» in the source) instead of silently substituting the wording.
    const excerptDiff = computeWordDiff(matnInput, canonicalText).diff;
    const excerptHasSubstantive = hasSubstantiveDifferences(excerptDiff);
    if (excerptHasSubstantive) {
      return {
        id: `hadeethenc-${Date.now()}`,
        item,
        status: 'NEEDS_REVIEW',
        status_label_ar: `رواية بلفظ مقارب — يختلف اللفظ عن المدخل`,
        status_label_en: 'Variant Narration — Wording Differs',
        reason: `المقطع المدخل قريب من لفظ الرواية في موسوعة الحديث المعتمدة (حديث ${gradeLabel})، لكن توجد فروق في اللفظ (انظر التظليل أدناه)؛ لذلك لا تُنسب باللفظ المدخل آليًا${attribution ? ` — ${attribution}` : ''}.`,
        citation,
        canonical_text: canonicalText,
        is_partial_quote: true,
        quote_window: quoteWindow || undefined,
        diff: excerptDiff,
        decision_level: 'B'
      };
    }
    return {
      id: `hadeethenc-${Date.now()}`,
      item,
      status: 'MATCHED',
      status_label_ar: `مطابق للمصدر — النص جزء من حديث ${gradeLabel}`,
      status_label_en: 'Verified Hadith Excerpt',
      reason: `المقطع المدخل جزء من متن الرواية في موسوعة الحديث المعتمدة (حديث ${gradeLabel})؛ والجزء المظلَّل أدناه هو ما أدخلته${attribution ? ` — ${attribution}` : ''}.`,
      citation,
      canonical_text: canonicalText,
      is_partial_quote: true,
      quote_window: quoteWindow || undefined,
      diff: excerptDiff,
      decision_level: 'A'
    };
  }

  // Found in the approved encyclopedia but not proven identical → review.
  return {
    id: `hadeethenc-review-${Date.now()}`,
    item,
    status: 'NEEDS_REVIEW',
    status_label_ar: 'عُثر على رواية قريبة في الموسوعة المعتمدة دون ثبوت مطابقة اللفظ',
    status_label_en: 'Related narration found — wording not proven identical',
    reason: 'عُثر في موسوعة الحديث المعتمدة على رواية قريبة، لكن النص المدخل لا يطابقها مطابقة صريحة؛ لذلك لا تُنسب الرواية آليًا.',
    citation,
    canonical_text: best.matn || best.doc.text,
    decision_level: 'B'
  };
}
