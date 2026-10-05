/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text Normalization for Quranic and Arabic religious texts.
 * Removes diacritics, standardizes letter variants, removes tatweel,
 * and enables accurate semantic/exact matches without altering original input.
 */

// Arabic Tashkeel (diacritics) Unicode ranges including Quranic marks
const TASHKEEL_REGEX = /[\u0617-\u061A\u064B-\u0653\u06D6-\u06ED]/g;

// Tatweel (Kashida)
const TATWEEL_REGEX = /\u0640/g;

// Quranic signs (Sajdah, Rub el Hizb, Ayah signs, etc.)
const QURANIC_SIGNS = /[\u06D6-\u06ED\uFD3E\uFD3F]/g;

// Quranic ayah-end glyphs used by some Hafs datasets (for example \uFC00–\uFC6E).
const QURAN_AYAH_MARKERS = /[\uFC00-\uFC6E]/g;

export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    // Normalize dagger alef to standard alef before diacritic removal
    .replace(/\u0670/g, 'ا')
    // Remove Tashkeel and Quranic stop marks
    .replace(TASHKEEL_REGEX, '')
    .replace(QURANIC_SIGNS, '')
    .replace(QURAN_AYAH_MARKERS, '')
    .replace(TATWEEL_REGEX, '')
    // Standardize Alef variations (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Standardize Taa Marbuta (ة -> ه or vice-versa for normalized comparison)
    .replace(/ة/g, 'ه')
    // Standardize Alef Maqsura (ى -> ي)
    .replace(/ى/g, 'ي')
    // Standardize Hamza on Waw and Yaa (ؤ -> و, ئ -> ي)
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Remove brackets, quotes, parentheticals, and punctuation
    .replace(/[.,/#!$%^&*;:{}=\-_`~()«»""''[\]؟،؛]/g, ' ')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


/**
 * Strict normalization for source-text verification.
 * It removes reading marks and punctuation but preserves the actual Arabic
 * letters, so substitutions such as ة→ه cannot become an exact match.
 */
export function normalizeArabicStrict(text: string): string {
  if (!text) return '';
  return text
    // Convert Uthmani dagger alef and alef wasla to standard alef for orthographic alignment
    .replace(/\u0670/g, 'ا')
    .replace(/ٱ/g, 'ا')
    .replace(TASHKEEL_REGEX, '')
    .replace(QURANIC_SIGNS, '')
    .replace(QURAN_AYAH_MARKERS, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/[.,/#!$%^&*;:{}=\-_\`~()«»"'\[\]؟،؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/**
 * Tokenizes normalized text into words.
 */
export function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Computes word-level diff between original/input text and verified canonical text.
 */
export interface DiffItem {
  type: 'equal' | 'missing' | 'added' | 'changed';
  word: string;
  expected?: string;
}

export function computeWordDiff(inputStr: string, canonicalStr: string): {
  diff: DiffItem[];
  similarityScore: number;
  hasDiscrepancy: boolean;
} {
  const looseTokens = (text: string) => normalizeArabic(text).split(/\s+/).filter(Boolean);
  const strictTokens = (text: string) => normalizeArabicStrict(text).split(/\s+/).filter(Boolean);

  const inputLoose = looseTokens(inputStr);
  const canonicalLoose = looseTokens(canonicalStr);
  const inputWords = strictTokens(inputStr);
  const canonWords = strictTokens(canonicalStr);

  if (inputWords.length === 0 || canonWords.length === 0) {
    return { diff: [], similarityScore: 0, hasDiscrepancy: true };
  }

  const strictInput = normalizeArabicStrict(inputStr);
  const strictCanonical = normalizeArabicStrict(canonicalStr);
  const exact = strictInput === strictCanonical;
  const strictSubstring = !exact && strictCanonical.includes(strictInput) && inputWords.length >= 2;

  // Find the best local window so a partial quotation is compared with the
  // corresponding words in the source, rather than with the beginning of
  // the full verse. This prevents false "altered" reports for valid excerpts.
  let best = {
    start: 0,
    end: canonWords.length,
    distance: Number.POSITIVE_INFINITY,
    score: 0
  };

  if (canonWords.length > inputWords.length + 1) {
    const minLen = Math.max(1, inputWords.length - 2);
    const maxLen = Math.min(canonWords.length, inputWords.length + 2);

    for (let len = minLen; len <= maxLen; len++) {
      for (let start = 0; start + len <= canonWords.length; start++) {
        const a = inputLoose;
        const b = canonicalLoose.slice(start, start + len);
        const m = a.length;
        const n = b.length;
        const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + cost
            );
          }
        }

        const distance = dp[m][n];
        const score = 1 - distance / Math.max(m, n);
        const preferred = score > best.score ||
          (score === best.score && Math.abs(len - inputWords.length) < Math.abs((best.end - best.start) - inputWords.length));

        if (preferred) {
          best = { start, end: start + len, distance, score };
        }
      }
    }
  }

  // Align the user text against the best source window with edit operations.
  // Outside words of a longer source verse are intentionally omitted from the
  // diff because they are not errors; they are simply not part of the quote.
  const canonWindow = canonWords.slice(best.start, best.end);
  const m = inputWords.length;
  const n = canonWindow.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = inputWords[i - 1] === canonWindow[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const aligned: DiffItem[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + (inputWords[i - 1] === canonWindow[j - 1] ? 0 : 1)
    ) {
      if (inputWords[i - 1] === canonWindow[j - 1]) {
        aligned.unshift({ type: 'equal', word: inputWords[i - 1] });
      } else {
        aligned.unshift({ type: 'changed', word: inputWords[i - 1], expected: canonWindow[j - 1] });
      }
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      aligned.unshift({ type: 'added', word: inputWords[i - 1] });
      i--;
    } else {
      aligned.unshift({ type: 'missing', word: canonWindow[j - 1] });
      j--;
    }
  }

  const strictExact = exact || strictSubstring;
  const similarityScore = strictExact ? 1 : Number((1 - dp[m][n] / Math.max(m, n)).toFixed(3));

  return {
    diff: aligned,
    similarityScore,
    hasDiscrepancy: !strictExact
  };
}
