/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser-safe Dorar query utilities.
 * No Node.js/network dependencies belong in this file.
 */

export function cleanSearchQuery(query: string): string {
  return query
    .replace(/[«»"“؟?.,!]/g, '')
    .replace(/^(?:ما\s+(?:هو\s+)?حكم(?:\s+الشرع(?:\s+في)?)?|هل\s+(?:يجوز|يصح)|ما\s+القول\s+في|حكم|هل|ما|ماذا|كيف|ما\s+رأي\s+الشرع\s+في)\s*/gi, '')
    .replace(/^(?:في\s+القرآن(?:\s+الكريم)?|قال\s+رسول\s+الله|قال\s+النبي|في\s+الحديث|عن\s+النبي|ورد\s+في\s+الحديث|روي\s+أن|سمعت\s+رسول\s+الله)[:\s]*/gi, '')
    .trim()
    .slice(0, 120);
}

export function buildDorarFiqhUrl(query: string): string {
  const clean = cleanSearchQuery(query);
  return 'https://dorar.net/feqhia/search?q=' + encodeURIComponent(clean || query);
}

export function generateFiqhSearchKeywords(rawText: string): string[] {
  const clean = cleanSearchQuery(rawText);
  const words = clean
    .split(/\s+/)
    .filter(w => w.length > 2 && !['حكم', 'شرع', 'ماذا', 'يجوز', 'يصح', 'رأي', 'الشريعة', 'في', 'من', 'على', 'عن', 'هل', 'ما'].includes(w));
  return [...new Set(words)];
}
