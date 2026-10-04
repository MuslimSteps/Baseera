/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import quranData from '../../sources/quran.json' with { type: 'json' };
import translationData from '../../sources/quran_translations.json' with { type: 'json' };
import { normalizeArabic, normalizeArabicStrict, computeWordDiff } from './normalizer.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

/** Strip diacritics + Uthmani script marks for clean display */
function cleanSurahDisplayName(raw: string): string {
  return raw
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0640]/g, '')
    .replace(/^سُورَةُ\s*/u, '')
    .replace(/^سورة\s*/u, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

/**
 * Compare the input against the best contiguous token window in a canonical
 * verse. This catches an altered word inside a quoted prefix of a longer ayah.
 *
 * Example:
 *   "الله لا إله إلا هو الحي الغفور لا تأخذه سنة ولا نوم"
 * should strongly match the beginning of Al-Baqarah 2:255 while still failing
 * exact verification because "الغفور" != "القيوم".
 */
function orderedTokenSimilarity(input: string, canonical: string): number {
  const inputTokens = normalizeArabic(input).split(/\s+/).filter(Boolean);
  const canonicalTokens = normalizeArabic(canonical).split(/\s+/).filter(Boolean);

  if (inputTokens.length < 3 || canonicalTokens.length < 3) return 0;

  const editSimilarity = (a: string[], b: string[]): number => {
    const m = a.length;
    const n = b.length;
    const prev = Array.from({ length: n + 1 }, (_, j) => j);
    let prevRow = prev;

    for (let i = 1; i <= m; i++) {
      const row = new Array<number>(n + 1);
      row[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(
          prevRow[j] + 1,
          row[j - 1] + 1,
          prevRow[j - 1] + cost
        );
      }
      prevRow = row;
    }

    const maxLen = Math.max(m, n);
    return maxLen ? 1 - prevRow[n] / maxLen : 0;
  };

  // Exact or altered excerpt from a longer ayah: compare the input against
  // every same-length contiguous window in the canonical verse.
  if (canonicalTokens.length >= inputTokens.length) {
    let best = 0;
    for (let start = 0; start <= canonicalTokens.length - inputTokens.length; start++) {
      best = Math.max(
        best,
        editSimilarity(inputTokens, canonicalTokens.slice(start, start + inputTokens.length))
      );
    }
    return Number(Math.max(0, best).toFixed(3));
  }

  // If the canonical ayah is shorter than the input, DO NOT give a high score
  // merely because a few words overlap. Only accept it as a partial quote when
  // the complete canonical ayah occurs contiguously inside the input.
  const inputNorm = inputTokens.join(' ');
  const canonicalNorm = canonicalTokens.join(' ');
  if (inputNorm.includes(canonicalNorm)) return 1;

  return 0;
}

function quranCandidateScore(input: string, canonical: string): {
  score: number;
  diff: ReturnType<typeof computeWordDiff>;
  sequenceSimilarity: number;
} {
  const diff = computeWordDiff(input, canonical);
  const sequenceSimilarity = orderedTokenSimilarity(input, canonical);
  const exact = normalizeArabicStrict(input) === normalizeArabicStrict(canonical);
  return {
    score: exact ? 1 : sequenceSimilarity,
    diff,
    sequenceSimilarity
  };
}

export function getQuranCandidatesForAI(item: ExtractedItem, limit = 12) {
  const normInput = normalizeArabic(item.text);
  const inputWords = new Set(normInput.split(/\s+/).filter(Boolean));
  const fuzzySurah = findSurahFuzzy(item.claimed_surah);

  const pool = fuzzySurah
    ? quranData.verses.filter(v => v.surah_number === fuzzySurah.number)
    : quranData.verses;

  const scored = pool.map(v => {
    const canonical = normalizeArabic(v.text_clean);
    const canonicalWords = new Set(canonical.split(/\s+/).filter(Boolean));
    let shared = 0;
    for (const word of inputWords) if (canonicalWords.has(word)) shared++;

    const overlap = inputWords.size ? shared / inputWords.size : 0;
    const sequence = orderedTokenSimilarity(item.text, v.text_clean);
    const exact = normalizeArabicStrict(item.text) === normalizeArabicStrict(v.text_clean);

    return {
      verse: v,
      retrievalScore: exact ? 2 : Math.max(sequence, overlap * 0.8)
    };
  });

  scored.sort((a, b) => b.retrievalScore - a.retrievalScore);

  return scored
    .filter(x => x.retrievalScore > 0.05)
    .slice(0, limit)
    .map(x => ({
      id: `quran-${x.verse.surah_number}-${x.verse.ayah_number}`,
      source: 'quran-uthmani',
      title: `سورة ${cleanSurahDisplayName(x.verse.surah_name_ar)} — الآية ${x.verse.ayah_number}`,
      text: x.verse.text_clean,
      surah_number: x.verse.surah_number,
      ayah_number: x.verse.ayah_number,
      surah_name_ar: cleanSurahDisplayName(x.verse.surah_name_ar),
      text_uthmani: x.verse.text_uthmani
    }));
}

function findSurahFuzzy(rawName?: string) {
  if (!rawName) return null;
  const norm = normalizeArabic(rawName).replace(/^سوره?\s+/, '').replace(/^ال/, '').trim();
  if (!norm) return null;

  let best = null;
  let minDiff = 999;
  for (const surah of quranData.surahs) {
    const sNorm = normalizeArabic(surah.name_ar).replace(/^سوره?\s+/, '').replace(/^ال/, '').trim();
    if (sNorm === norm) return surah;
    const dist = levenshtein(norm, sNorm);
    if (dist <= 2 && dist < minDiff) {
      minDiff = dist;
      best = surah;
    }
  }
  return best;
}

export function verifyQuranAyah(item: ExtractedItem): VerificationResult {
  const normInput = normalizeArabic(item.text);
  const inputWords = normInput.split(/\s+/).filter(Boolean);

  let bestMatch: (typeof quranData.verses)[0] | null = null;
  let highestScore = 0;
  let wordDiffResult: ReturnType<typeof computeWordDiff> | null = null;

  // 1. Respect explicit attribution without locking onto the first verse.
  //
  // If the user gives BOTH surah + ayah, inspect that exact location.
  // If the user gives ONLY the surah, search ALL verses in that surah and
  // select the strongest textual candidate. Never assume verse 1.
  if (item.claimed_surah || item.claimed_ayah) {
    const fuzzySurah = findSurahFuzzy(item.claimed_surah);
    let resolvedAyah = item.claimed_ayah;

    if (fuzzySurah && resolvedAyah && resolvedAyah > fuzzySurah.ayah_count) {
      // Handle reversed OCR digits only when the stated number is impossible.
      const strDigits = resolvedAyah.toString();
      const reversed = parseInt(strDigits.split('').reverse().join(''), 10);
      if (reversed <= fuzzySurah.ayah_count) {
        resolvedAyah = reversed;
      }
    }

    const surahCandidates = quranData.verses.filter(v => {
      if (fuzzySurah) return v.surah_number === fuzzySurah.number;
      if (!item.claimed_surah) return true;
      return (
        normalizeArabic(v.surah_name_ar).includes(normalizeArabic(item.claimed_surah)) ||
        v.surah_name_en.toLowerCase().includes(item.claimed_surah.toLowerCase())
      );
    });

    const locationCandidates = resolvedAyah
      ? surahCandidates.filter(v => v.ayah_number === resolvedAyah)
      : surahCandidates;

    for (const candidate of locationCandidates) {
      const scored = quranCandidateScore(item.text, candidate.text_clean);
      if (
        scored.score > highestScore ||
        (scored.score === highestScore &&
          candidate.text_clean.length < (bestMatch?.text_clean.length ?? Infinity))
      ) {
        highestScore = scored.score;
        bestMatch = candidate;
        wordDiffResult = scored.diff;
      }
    }
  }

  // 2. If only a surah was supplied, the search above is scoped to that
  // surah. Otherwise search the entire Quran. Either way, do not fabricate
  // a minimum score: similarity must come from the actual text comparison.
  const searchPool = item.claimed_surah
    ? quranData.verses.filter(v => {
        const surah = findSurahFuzzy(item.claimed_surah);
        if (surah) return v.surah_number === surah.number;
        return normalizeArabic(v.surah_name_ar).includes(normalizeArabic(item.claimed_surah));
      })
    : quranData.verses;

  if (!bestMatch || highestScore < 0.6) {
    for (const v of searchPool) {
      const normCanonical = normalizeArabic(v.text_clean);

      // Check if substring / superset
      const exactNormalized = normalizeArabicStrict(item.text) === normalizeArabicStrict(v.text_clean);

      if (exactNormalized) {
        highestScore = 1;
        bestMatch = v;
        wordDiffResult = computeWordDiff(item.text, v.text_clean);
        continue;
      }

      // Fast word-overlap prefilter before the ordered sequence comparison.
      let shared = 0;
      for (const iw of inputWords) {
        if (normCanonical.includes(iw)) shared++;
      }

      const inputSubsequenceCandidate =
        normCanonical.includes(normInput) ||
        normInput.includes(normCanonical) ||
        shared >= 2;

      if (inputSubsequenceCandidate) {
        const scored = quranCandidateScore(item.text, v.text_clean);
        if (scored.score > highestScore) {
          highestScore = scored.score;
          bestMatch = v;
          wordDiffResult = scored.diff;
        }
      }
    }
  }

  // Cross-check the whole Quran when a cited surah has no strong match.
  // This allows the verifier to detect a wrong surah attribution.
  if (item.claimed_surah && (!bestMatch || highestScore < 0.85)) {
    let globalBest = bestMatch;
    let globalScore = highestScore;
    let globalDiff = wordDiffResult;

    for (const v of quranData.verses) {
      const normCanonical = normalizeArabic(v.text_clean);
      let shared = 0;
      for (const iw of inputWords) {
        if (normCanonical.includes(iw)) shared++;
      }
      if (shared < 2 && !normCanonical.includes(normInput) && !normInput.includes(normCanonical)) {
        continue;
      }

      const scored = quranCandidateScore(item.text, v.text_clean);
      if (scored.score > globalScore) {
        globalScore = scored.score;
        globalBest = v;
        globalDiff = scored.diff;
      }
    }

    if (globalBest && globalScore > highestScore) {
      bestMatch = globalBest;
      highestScore = globalScore;
      wordDiffResult = globalDiff;
    }
  }

  // 3. Multilingual / Translation check if input is in English or French
  if (!bestMatch && (item.language === 'en' || item.language === 'fr' || /[a-zA-Z]/.test(item.text))) {
    const lower = item.text.toLowerCase();
    for (const tr of translationData.translations) {
      if (tr.en) {
        const canon = tr.en.text.toLowerCase().replace(/\s+/g, ' ').trim();
        const input = lower.replace(/\s+/g, ' ').trim();
        const exactTranslation = canon === input;
        const partialTranslation = canon.includes(input) && input.split(/\s+/).length >= 8;
        if (!exactTranslation && !partialTranslation) continue;
        const matchedVerse = quranData.verses.find(v => v.surah_number === tr.surah && v.ayah_number === tr.ayah);
        if (matchedVerse) {
          return {
            id: `quran-${matchedVerse.surah_number}-${matchedVerse.ayah_number}`,
            item,
            status: exactTranslation ? 'MATCHED' : 'NEEDS_REVIEW',
            status_label_ar: exactTranslation ? 'مطابقة تامة للترجمة المفهرسة' : 'مطابقة جزئية للترجمة — تحتاج مراجعة',
            status_label_en: exactTranslation ? 'Matched with Approved Translation' : 'Partial Match — Review Required',
            reason: exactTranslation ? `النص يطابق الترجمة المفهرسة للآية في سجل الترجمات المعتمد.` : `عُثر على الترجمة ضمن المصدر المعتمد، لكن النص المدخل مقتطف جزئي منها؛ لذلك لا يُعد تطابقاً كاملاً.` ,
            citation: {
              source_id: 'quran-translations',
              source_name: 'ترجمات معاني القرآن الكريم المعتمدة',
              authority: 'مجمع الملك فهد لطباعة المصحف الشريف / quranpedia',
              book: `سورة ${matchedVerse.surah_name_ar} (${matchedVerse.surah_name_en})`,
              number_or_page: `الآية: ${matchedVerse.ayah_number}`,
              url: `https://quranpedia.net/verse/${matchedVerse.surah_number}/${matchedVerse.ayah_number}`
            },
            canonical_text: matchedVerse.text_uthmani,
            canonical_surah: matchedVerse.surah_name_ar,
            canonical_ayah_number: matchedVerse.ayah_number,
            verified_translation: tr.en.text,
            decision_level: exactTranslation ? 'A' : 'B'
          };
        }
      }
    }
  }

  // 4. Decision logic for Arabic matching.
  // A candidate found only because a surah/topic word overlaps the input is not
  // enough. Require real textual evidence before exposing a canonical verse.
  if (bestMatch && wordDiffResult) {
    const matchedTranslation = translationData.translations.find(
      t => t.surah === bestMatch!.surah_number && t.ayah === bestMatch!.ayah_number
    );

    // Exact or normalized complete match
    if (highestScore >= 0.99 && !wordDiffResult.hasDiscrepancy) {
      const claimedSurah = item.claimed_surah ? findSurahFuzzy(item.claimed_surah) : null;

      if (claimedSurah && claimedSurah.number !== bestMatch.surah_number) {
        return {
          id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
          item,
          status: 'NEEDS_REVIEW',
          status_label_ar: 'يحتاج مراجعة (خطأ في عزو السورة)',
          status_label_en: 'Needs Review (Incorrect Surah Attribution)',
          reason:
            'النص يطابق آية من سورة ' +
            cleanSurahDisplayName(bestMatch.surah_name_ar) +
            '، لكنه عُزي في المدخل إلى سورة ' +
            cleanSurahDisplayName(item.claimed_surah || '') +
            '. تم اعتماد المطابقة النصية من المصحف فقط.',
          citation: {
            source_id: 'quran-uthmani',
            source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
            authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
            book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}`,
            number_or_page: `الآية: ${bestMatch.ayah_number}`
          },
          canonical_text: bestMatch.text_uthmani,
          canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
          canonical_ayah_number: bestMatch.ayah_number,
          verified_translation: matchedTranslation?.en?.text,
          diff: wordDiffResult.diff,
          decision_level: 'A'
        };
      }
      // Check if claimed number was wrong
      if (item.claimed_ayah && item.claimed_ayah !== bestMatch.ayah_number) {
        return {
          id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
          item,
          status: 'NEEDS_REVIEW',
          status_label_ar: 'يحتاج مراجعة (خطأ في رقم الآية)',
          status_label_en: 'Needs Review (Incorrect Verse Number)',
          reason: `النص مطابق لسورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}، ولكن الرقم المذكور (${item.claimed_ayah}) غير صحيح، والرقم الصحيح هو: الآية ${bestMatch.ayah_number}.`,
          citation: {
            source_id: 'quran-uthmani',
            source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
            authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
            book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}`,
            number_or_page: `الآية: ${bestMatch.ayah_number}`
          },
          canonical_text: bestMatch.text_uthmani,
          canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
          canonical_ayah_number: bestMatch.ayah_number,
          verified_translation: matchedTranslation?.en?.text,
          decision_level: 'A'
        };
      }

      return {
        id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
        item,
        status: 'MATCHED',
        status_label_ar: 'مطابقة تامة للنص القرآني المعتمد',
        status_label_en: 'Matched',
        reason: `النص بعد التطبيع يطابق الآية كاملةً مع النص القرآني المعتمد في سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)} الآية ${bestMatch.ayah_number}.`,
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
          authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
          book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)} (${bestMatch.surah_name_en})`,
          number_or_page: `الآية ${bestMatch.ayah_number}`
        },
        canonical_text: bestMatch.text_uthmani,
        canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
        canonical_ayah_number: bestMatch.ayah_number,
        verified_translation: matchedTranslation?.en?.text,
        diff: wordDiffResult.diff,
        decision_level: 'A'
      };
    }

    // Distinguish a concrete word substitution from a legitimate excerpt.
    const changedWords = wordDiffResult.diff.filter(d => d.type === 'changed');
    const missingWords = wordDiffResult.diff.filter(d => d.type === 'missing');
    const lexicalAlteration = changedWords.length > 0;

    // Do not surface a random nearby verse. A Quran candidate must have
    // substantial ordered textual evidence before it can receive a reference.
    if (highestScore >= 0.72) {
      const verdictAr = lexicalAlteration
        ? 'تحريف في اللفظ القرآني — النص المدخل محرّف عن الآية المعتمدة'
        : 'اقتباس جزئي من الآية — ليس النص القرآني كاملاً';

      const verdictEn = lexicalAlteration
        ? 'Altered Quranic Wording — Input differs from the approved verse'
        : 'Partial Quranic Quotation — Input is not the complete verse';

      const reason = lexicalAlteration
        ? `ثبّت الفحص وجود النص المدخل كاقتباس قريب من سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}، الآية ${bestMatch.ayah_number}، لكنه يحتوي على تبديل لفظي صريح: ${changedWords.slice(0, 3).map(d => '«' + d.word + '» بدل «' + (d.expected || '') + '»').join('، ')}. لذلك لا يُعد هذا نصًا قرآنيًا مطابقًا، ويوصف بأنه محرّف عن النص المعتمد.`
        : missingWords.length > 0
          ? `النص المدخل يطابق جزءًا من الآية ${bestMatch.ayah_number} في سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)} دون بقية الآية؛ لذلك هو اقتباس جزئي وليس نص الآية كاملاً.`
          : 'النص لا يطابق الآية مطابقة تامة، لذلك لا يُعتمد كنص قرآني.';

      return {
        id: `quran-${bestMatch.surah_number}-${bestMatch.ayah_number}`,
        item,
        status: 'NEEDS_REVIEW',
        finding_type: lexicalAlteration ? 'altered_quran_text' : 'partial_quran_quote',
        status_label_ar: verdictAr,
        status_label_en: verdictEn,
        reason,
        citation: {
          source_id: 'quran-uthmani',
          source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
          authority: 'مجمع الملك فهد لطباعة المصحف الشريف',
          book: `سورة ${cleanSurahDisplayName(bestMatch.surah_name_ar)}`,
          number_or_page: `الآية: ${bestMatch.ayah_number}`
        },
        canonical_text: bestMatch.text_uthmani,
        canonical_surah: cleanSurahDisplayName(bestMatch.surah_name_ar),
        canonical_ayah_number: bestMatch.ayah_number,
        verified_translation: matchedTranslation?.en?.text,
        diff: wordDiffResult.diff,
        decision_level: 'A'
      };
    }
  }

  // Not found in checked Quranic sources
  return {
    id: `quran-not-found-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'لم يُعثر عليه في المراجع المفحوصة',
    status_label_en: 'Not Found in Checked Sources',
    reason: 'لم يُعثر عليه في المراجع المفحوصة من المصحف الشريف بالرسم العثماني المعتمد.',
    citation: {
      source_id: 'quran-uthmani',
      source_name: 'المصحف الشريف بالرسم العثماني المعتمد',
      authority: 'مجمع الملك فهد لطباعة المصحف الشريف'
    },
    abstention_note: 'لم يُعثر عليه في المراجع المفحوصة.'
  };
}
