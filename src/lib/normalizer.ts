/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text Normalization for Quranic and Arabic religious texts.
 * Removes diacritics, standardizes letter variants, removes tatweel,
 * and enables accurate semantic/exact matches without altering original input.
 */

// Arabic Tashkeel (diacritics) Unicode ranges
const TASHKEEL_REGEX = /[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]/g;

// Tatweel (Kashida)
const TATWEEL_REGEX = /\u0640/g;

// Quranic signs (Sajdah, Rub el Hizb, Ayah signs, etc.)
const QURANIC_SIGNS = /[\u06D6-\u06ED\uFD3E\uFD3F]/g;

export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    // Remove Tashkeel and Quranic stop marks
    .replace(TASHKEEL_REGEX, '')
    .replace(QURANIC_SIGNS, '')
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
    .replace(TASHKEEL_REGEX, '')
    .replace(QURANIC_SIGNS, '')
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
  const inputWords = tokenize(inputStr);
  const canonWords = tokenize(canonicalStr);

  if (inputWords.length === 0 || canonWords.length === 0) {
    return {
      diff: [],
      similarityScore: 0,
      hasDiscrepancy: true
    };
  }

  // Simple alignment comparison
  const diff: DiffItem[] = [];
  let matches = 0;
  const maxLen = Math.max(inputWords.length, canonWords.length);

  // Check overlap
  const inputSet = new Set(inputWords);
  const canonSet = new Set(canonWords);

  const normIn = normalizeArabic(inputStr);
  const normCan = normalizeArabic(canonicalStr);
  const isExactSubstring = normCan.includes(normIn) && inputWords.length >= 2;

  canonWords.forEach((cWord, idx) => {
    const inWord = inputWords[idx];
    if (inWord === cWord) {
      diff.push({ type: 'equal', word: cWord });
      matches++;
    } else if (inWord && canonSet.has(inWord)) {
      diff.push({ type: 'changed', word: inWord, expected: cWord });
    } else if (!inWord) {
      if (!isExactSubstring) {
        diff.push({ type: 'missing', word: cWord });
      }
    } else {
      diff.push({ type: 'changed', word: inWord, expected: cWord });
    }
  });

  // Calculate Jaccard word similarity
  let intersection = 0;
  inputSet.forEach(w => {
    if (canonSet.has(w)) intersection++;
  });
  const union = new Set([...inputWords, ...canonWords]).size;
  const similarityScore = union > 0 ? intersection / union : 0;

  return {
    diff,
    similarityScore: isExactSubstring ? 1.0 : Number(similarityScore.toFixed(3)),
    hasDiscrepancy: isExactSubstring ? false : (similarityScore < 0.99 || inputWords.join(' ') !== canonWords.join(' '))
  };
}
