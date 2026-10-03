/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedItem, ItemType } from '../types/baseera.ts';
import termData from '../../sources/terminology.json' with { type: 'json' };

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

    // Check if it's explicitly a hadith quote (e.g. قال رسول الله «...»)
    const precedingText = text.slice(Math.max(0, qMatch.index - 40), qMatch.index);
    if (precedingText.includes('رسول الله') || precedingText.includes('قال النبي') || precedingText.includes('في الحديث')) {
      continue; // Let the Hadith extractor handle this
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

    // Try to extract claimed surah and ayah from the marker phrase
    const markerPart = fullMatch.slice(0, fullMatch.length - bodyText.length);
    const surahMatch = markerPart.match(/سورة\s+([\u0621-\u064A]+)/);
    const ayahMatch = markerPart.match(/آية\s+(\d+)/);

    coveredRanges.push({ start: matchStart, end: matchEnd });

    items.push({
      type: 'ayah',
      text: bodyText,
      context: fullMatch,
      language: /[a-zA-Z]/.test(bodyText) ? 'en' : 'ar',
      location_in_input: `chars ${matchStart}-${matchEnd}`,
      claimed_surah: surahMatch?.[1],
      claimed_ayah: ayahMatch ? parseInt(ayahMatch[1], 10) : undefined,
      confidence: 0.93
    });
  }

  // 2. Hadith with quotation:
  // e.g. قال رسول الله ﷺ: «...» رواه البخاري
  const hadithQuotedRegex = /(?:قال رسول الله|قال النبي|سمعت رسول الله|يقول رسول الله|عن النبي|في الحديث|ورد في الحديث|روي أن النبي|في صحيح البخاري|في صحيح مسلم|عن عمر|عن أنس|عن أبي هريرة)[^«"“\n]*[:\s]*[«"“]([^»"”]{5,})[»"”](?:\s*(?:رواه|في)?\s*(البخاري|مسلم|الترمذي|أحمد|ابن ماجه)?)?/gi;
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

  // 3. Sensitive Term patterns (Jamhara terms: Tawhid, Sharia, Jihad, Worship, etc.)
  for (const termObj of termData.terms) {
    const termAr = termObj.term_ar;
    const termEn = termObj.term_en.split('/')[0].trim();

    const containsAr = text.includes(termAr);
    const regexEn = new RegExp(`\\b${termEn}\\b`, 'i');
    const containsEn = regexEn.test(text);

    if (containsAr || containsEn) {
      const foundIdx = containsAr ? text.indexOf(termAr) : text.search(regexEn);
      const surroundingContext = text.slice(Math.max(0, foundIdx - 60), Math.min(text.length, foundIdx + 140));

      items.push({
        type: 'term',
        text: containsAr ? termAr : termEn,
        context: surroundingContext,
        language: containsAr ? 'ar' : 'en',
        location_in_input: `term match at ${foundIdx}`,
        confidence: 0.92
      });
    }
  }

  // 4. Fiqh Question patterns
  if (text.includes('هل يجوز') || text.includes('ما حكم') || text.includes('طلقت') || text.includes('زوجتي') || text.includes('ينقض الوضوء') || text.includes('قنوت الفجر') || text.includes('الميراث') || text.includes('تركة')) {
    // Only add if not already extracting an ayah or hadith solely
    items.push({
      type: 'fiqh_question',
      text: text,
      context: text,
      language: 'ar',
      location_in_input: 'full question',
      confidence: 0.9
    });
  }

  // 5. Fallback: If no items detected at all, treat the entire string as candidate claim
  if (items.length === 0 && text.length > 3) {
    let guessedType: ItemType = 'claim';
    if (text.includes('الله') || text.includes('سورة') || text.includes('آية')) guessedType = 'ayah';
    else if (text.includes('رسول') || text.includes('النبي') || text.includes('حديث')) guessedType = 'hadith';

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

  return uniqueItems;
}
