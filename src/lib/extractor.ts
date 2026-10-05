/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedItem, ItemType } from '../types/baseera.ts';

/**
 * Deterministic rule-based extraction for Quran, Hadith, Terms and Fiqh questions.
 * Accurately parses citations, quoted segments, and contextual markers.
 */
export function extractItemsRuleBased(inputText: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const text = inputText.trim();
  if (!text) return items;

  // Track extracted spans to avoid overlapping/duplicate extracts
  const coveredRanges: Array<{ start: number; end: number }> = [];

  const isOverlapping = (start: number, end: number) => {
    return coveredRanges.some(r => Math.max(start, r.start) < Math.min(end, r.end));
  };

  // 1. Quoted Ayah with Citation:
  // e.g. قال تعالى: «...» [سورة البقرة: 255] or «...» [البقرة آية 155]
  const quranQuotedRegex = /(?:قال تعالى|قوله تعالى|في القرآن الكريم|كقوله سبحانه)?\s*[:\s]*[«"“]([^»"”]{5,})[»"”](?:\s*\[(?:سورة\s+)?([\u0621-\u064A]+)(?:\s*(?:آية|الآية)?\s*[:\s]?\s*(\d+))?\])?/gi;
  let qMatch;
  while ((qMatch = quranQuotedRegex.exec(text)) !== null) {
    const fullMatch = qMatch[0];
    const quotedText = qMatch[1]?.trim();
    if (!quotedText || quotedText.length < 5) continue;

    // Check if it's explicitly a hadith quote (e.g. قال رسول الله «...» or حديث «...»)
    const precedingText = text.slice(Math.max(0, qMatch.index - 40), qMatch.index);
    if (precedingText.includes('رسول الله') || precedingText.includes('قال النبي') || precedingText.includes('حديث') || precedingText.includes('الحديث')) {
      continue; // Let the Hadith extractor handle this
    }

    const hasQuranMarker = /(?:قال\s+(?:الله\s+)?تعالى|قوله\s+تعالى|في\s+القرآن|كقوله\s+سبحانه|سورة)/i.test(precedingText) || qMatch[0].includes('تعالى') || qMatch[0].includes('القرآن');
    const hasQuranBracket = !!qMatch[2]; // e.g. [البقرة: ...]

    if (!hasQuranMarker && !hasQuranBracket) {
      // A standalone quote without any Quranic attribution is NOT an Ayah
      continue;
    }

    const claimedSurah = qMatch[2]?.trim();
    const claimedAyah = qMatch[3] ? parseInt(qMatch[3], 10) : undefined;

    coveredRanges.push({ start: qMatch.index, end: qMatch.index + fullMatch.length });

    items.push({
      type: 'ayah',
      text: quotedText,
      context: fullMatch,
      language: /[a-zA-Z]/.test(quotedText) ? 'en' : 'ar',
      location_in_input: `chars ${qMatch.index}-${qMatch.index + fullMatch.length}`,
      claimed_surah: claimedSurah,
      claimed_ayah: claimedAyah,
      confidence: 0.98
    });
  }

  // 1b. Unquoted Ayah after Quranic markers:
  // e.g. "قال تعالى: إنا أعطيناك الكوثر" or "في سورة البقرة آية 300: ..."
  const quranUnquotedRegex = /(?:قال (?:الله )?تعالى|قوله (?:الله )?(?:تعالى|سبحانه)|كما قال (?:الله )?تعالى[^:\n]*|قال (?:الله )?سبحانه(?:\s+وتعالى)?|في (?:سورة|القرآن الكريم)[^:\n]*)[:\s]+([^\n\[«""]{5,})/gim;
  let quMatch;
  while ((quMatch = quranUnquotedRegex.exec(text)) !== null) {
    const fullMatch = quMatch[0];
    const bodyText = quMatch[1]?.trim();
    if (!bodyText || bodyText.length < 5) continue;

    const matchStart = quMatch.index;
    const matchEnd = matchStart + fullMatch.length;
    if (isOverlapping(matchStart, matchEnd)) continue;

    const markerPart = fullMatch.slice(0, Math.max(0, fullMatch.length - bodyText.length));
    const surahMatch = markerPart.match(/سورة\s+([\u0621-\u064A]+)/);
    const ayahMatch = markerPart.match(/آية\s+(\d+)/);

    // Look ahead for bracketed citation like [التغابن: 15] or [التغان: 5 1]
    const afterMatch = text.slice(matchEnd, matchEnd + 50);
    const bracketMatch = afterMatch.match(/^\s*\[(?:سورة\s+)?([^\s:\]]+)(?:\s*[:\s]\s*([\d\s]+))?\]/);
    let claimedSurah = surahMatch?.[1];
    let claimedAyah = ayahMatch ? parseInt(ayahMatch[1], 10) : undefined;
    if (bracketMatch) {
      claimedSurah = bracketMatch[1]?.trim();
      if (bracketMatch[2]) {
        const rawDigits = bracketMatch[2].replace(/\s+/g, '');
        claimedAyah = parseInt(rawDigits, 10);
      }
    }

    coveredRanges.push({ start: matchStart, end: matchEnd });

    items.push({
      type: 'ayah',
      text: bodyText.replace(/^[«"“]+|[»"”]+$/g, '').trim(),
      context: fullMatch,
      language: /[a-zA-Z]/.test(bodyText) ? 'en' : 'ar',
      location_in_input: `chars ${matchStart}-${matchEnd}`,
      claimed_surah: claimedSurah,
      claimed_ayah: claimedAyah,
      confidence: 0.93
    });
  }

  // 1c. Double-Parentheses Narrations ((...)) — common in Arabic posts for Hadith/Athar
  const doubleParenRegex = /\(\(\s*([\s\S]+?)\s*\)\)/g;
  let dpMatch;
  while ((dpMatch = doubleParenRegex.exec(text)) !== null) {
    const fullMatch = dpMatch[0];
    const narrationText = dpMatch[1]?.trim();
    if (!narrationText || narrationText.length < 15) continue;

    const start = dpMatch.index;
    const end = start + fullMatch.length;
    coveredRanges.push({ start, end });

    items.push({
      type: 'hadith',
      text: narrationText,
      context: fullMatch,
      language: 'ar',
      location_in_input: `chars ${start}-${end}`,
      confidence: 0.95
    });
  }

  // 1d. Unquoted Companion Athar / Dialogue Narrations (e.g. دخل حذيفة على عمر / صدقك فيما قال يا عمر)
  const atharDialogueRegex = /(?:دخل [^:\n]+ على [^:\n]+|صدقك فيما قال يا عمر|يحب الفتنة ويكره الحق|يصلي بغير وضوء|روي أن [^:\n]+|جاء في الأثر أن)[\s\S]{20,}/gim;
  let atharMatch;
  while ((atharMatch = atharDialogueRegex.exec(text)) !== null) {
    const fullMatch = atharMatch[0]?.trim();
    const start = atharMatch.index;
    const end = start + (fullMatch?.length || 0);

    // Skip if already covered by double parentheses ((...))
    if (isOverlapping(start, end)) continue;

    if (fullMatch && fullMatch.length >= 20) {
      coveredRanges.push({ start, end });
      items.push({
        type: 'hadith',
        text: fullMatch,
        context: fullMatch,
        language: 'ar',
        location_in_input: `chars ${start}-${end}`,
        confidence: 0.92
      });
    }
  }

  // 2. Hadith with quotation:
  // e.g. قال رسول الله ﷺ: «...» or حديث ضعيف: (...) or قال النبي: "..."
  const hadithQuotedRegex = /(?:حديث(?:\s+(?:صحيح|حسن|ضعيف|موضوع|باطل|مكذوب))?|الحديث|قال رسول الله|قال النبي|سمعت رسول الله|يقول رسول الله|عن النبي|في الحديث|ورد في الحديث|روي أن النبي|في صحيح البخاري|في صحيح مسلم|عن عمر|عن أنس|عن أبي هريرة)[^«"“\(\n]*[:\s]*[«"“\(]([^»"”\)]{5,})[»"”\)](?:\s*(?:رواه|في)?\s*(البخاري|مسلم|الترمذي|أحمد|ابن ماجه)?)?/gi;
  let hMatch;
  while ((hMatch = hadithQuotedRegex.exec(text)) !== null) {
    const fullMatch = hMatch[0];
    const quote = hMatch[1]?.trim();
    if (!quote || quote.length < 5) continue;

    let claimedSource: string | undefined = undefined;
    if (hMatch[2]) {
      claimedSource = hMatch[2].includes('البخاري') ? 'صحيح البخاري' :
                      hMatch[2].includes('مسلم') ? 'صحيح مسلم' :
                      hMatch[2].includes('الترمذي') ? 'سنن الترمذي' : hMatch[2];
    } else if (fullMatch.includes('البخاري')) {
      claimedSource = 'صحيح البخاري';
    } else if (fullMatch.includes('مسلم')) {
      claimedSource = 'صحيح مسلم';
    } else if (fullMatch.includes('الترمذي')) {
      claimedSource = 'سنن الترمذي';
    } else {
      const genericSource = fullMatch.match(/(?:رواه|أخرجه|خرجه)\s+(?:الإمام\s+)?([^،:؛\n]+?)(?:\s+في\s+([^،؛\n]+))?(?:\s*[:؛]|\s*$)/i);
      if (genericSource) {
        const narratorOrAuthor = genericSource[1]?.trim();
        const bookName = genericSource[2]?.trim();
        if (bookName) claimedSource = bookName;
        else if (narratorOrAuthor) claimedSource = narratorOrAuthor;
      }
    }

    coveredRanges.push({ start: hMatch.index, end: hMatch.index + fullMatch.length });

    items.push({
      type: 'hadith',
      text: quote,
      context: fullMatch,
      language: 'ar',
      location_in_input: `chars ${hMatch.index}-${hMatch.index + fullMatch.length}`,
      claimed_source: claimedSource,
      confidence: 0.96
    });
  }

  // 3. Terminology candidates are identified from user phrasing only.
  // No local dictionary is consulted here; the live Jamhara source is the authority.
  const termPatterns = [
    /(?:مصطلح|مفهوم|تعريف|المقصود\s+ب)\s*[:：]?\s*[«"“]?([\u0621-\u064A]{3,})[»"”]?/gi,
    /\b(?:term|concept|definition)\s*[:：]?\s*["']?([A-Za-z][A-Za-z_-]{2,})["']?/gi
  ];

  for (const pattern of termPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const term = match[1]?.trim();
      if (!term) continue;
      const start = match.index;
      const end = start + match[0].length;
      if (isOverlapping(start, end)) continue;

      coveredRanges.push({ start, end });
      items.push({
        type: 'term',
        text: term,
        context: match[0],
        language: /[A-Za-z]/.test(term) ? 'en' : 'ar',
        location_in_input: `chars ${start}-${end}`,
        confidence: 0.85
      });
    }
  }

  // A short standalone expression can be a terminology candidate, but it is
  // still verified against the live approved source before being accepted.


  // 4. Tafsir Question patterns
  const isTafsirQuestionText =
    /(?:^|\s)(?:تفسير|ما\s*تفسير|معنى\s*الآية|معنى\s*قوله\s*تعالى|تأويل|بيان\s*الآية)(?:\s|$)/i.test(text) ||
    text.startsWith('تفسير ');

  if (isTafsirQuestionText) {
    items.push({
      type: 'tafsir_question',
      text: text,
      context: text,
      language: 'ar',
      location_in_input: 'full question',
      confidence: 0.96
    });
  }

  // 5. Aqeedah Question patterns
  const isAqeedahQuestionText =
    /(?:^|\s)(?:توحيد|أركان\s*الإيمان|عقيدة|العقيدة|صفات\s*الله|أسماء\s*الله|القضاء\s*والقدر|اليوم\s*الآخر|أشراط\s*الساعة)(?:\s|$)/i.test(text) ||
    text.includes('توحيد الألوهية') || text.includes('توحيد الربوبية') || text.includes('توحيد الأسماء والصفات');

  if (isAqeedahQuestionText) {
    items.push({
      type: 'aqeedah_question',
      text: text,
      context: text,
      language: 'ar',
      location_in_input: 'full question',
      confidence: 0.95
    });
  }

  // 6. Fiqh Question patterns
  // High-consequence religious/legal terms are routed to the fiqh safety path
  // even when the user omits an explicit phrase such as "ما حكم".
  const isSensitiveFiqhTerm =
    /(?:سب\s+(?:الله|الدين|الرسول|النبي)|شتم\s+(?:الله|الدين|الرسول|النبي)|استهزاء\s+(?:بالدين|بالإسلام|بالرسول|بالقرآن)|الردة|المرتد|التكفير|تكفير)(?:\s|[؟?،.!؛:()]|$)/i.test(text);

  const isFiqhQuestionText =
    /(?:^|\s)(?:ما\s*حكم|حكم|أحكام|هل\s*يجوز|هل\s*يصح|هل\s*يحل|هل\s*يحرم|ما\s*رأي\s*الشرع|طلقت|زوجتي|ينقض\s*الوضوء|قنوت\s*الفجر|الميراث|تركة)(?:\s|$)/i.test(text) ||
    text.startsWith('حكم ') ||
    text.includes('ما حكم') ||
    text.includes('هل يجوز') ||
    text.includes('هل يصح') ||
    text.includes('حكم ') ||
    isSensitiveFiqhTerm;

  if (isFiqhQuestionText && !isTafsirQuestionText && !isAqeedahQuestionText) {
    // Only add if not already extracting an ayah or hadith solely
    items.push({
      type: 'fiqh_question',
      text: text,
      context: text,
      language: 'ar',
      location_in_input: 'full question',
      confidence: 0.92
    });
  }

  // 7. Standalone Islamic Terminology (e.g. "الاستصحاب", "القياس", "الإجماع")
  const isSingleIslamicTerm =
    items.length === 0 &&
    /^[\u0621-\u064A\s]{3,40}$/.test(text) &&
    text.split(/\s+/).length <= 3 &&
    !isFiqhQuestionText &&
    !isTafsirQuestionText &&
    !isAqeedahQuestionText;

  if (isSingleIslamicTerm) {
    items.push({
      type: 'term',
      text: text,
      context: text,
      language: 'ar',
      location_in_input: 'standalone term',
      confidence: 0.88
    });
  }

  // 8. Fallback: If no items detected at all, treat the entire string as candidate claim
  if (items.length === 0 && text.length > 3) {
    let guessedType: ItemType = 'claim';
    if (text.includes('سورة') || text.includes('آية') || text.includes('تعالى') || text.includes('المصحف')) guessedType = 'ayah';
    else if (text.includes('رسول') || text.includes('النبي') || text.includes('حديث') || text.includes('صلى الله عليه وسلم')) guessedType = 'hadith';

    items.push({
      type: guessedType,
      text: text,
      context: text,
      language: /[a-zA-Z]/.test(text) ? 'en' : 'ar',
      confidence: 0.75
    });
  }

  // Deduplicate items
  const uniqueItems: ExtractedItem[] = [];
  const seenTexts = new Set<string>();

  for (const it of items) {
    const key = `${it.type}:${it.text.trim()}`;
    if (!seenTexts.has(key)) {
      seenTexts.add(key);
      uniqueItems.push(it);
    }
  }

  // Prioritize primary narrative/hadith before internal quotes/verses
  uniqueItems.sort((a, b) => {
    if (a.type === 'hadith' && b.type === 'ayah') return -1;
    if (a.type === 'ayah' && b.type === 'hadith') return 1;
    return 0;
  });

  return uniqueItems;
}
