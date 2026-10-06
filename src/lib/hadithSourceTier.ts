/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hadith source-tier classifier (dependency-free).
 *
 * Distinguishes a PRIMARY hadith collection (where a narration is originally
 * recorded and graded, e.g. the two Sahihs and the Sunan/Masanid) from a
 * SECONDARY reference work that merely quotes the narration (fiqh, manasik,
 * fatwa collections, explanations, etc.).
 *
 * Used so that an authentic wording found only inside a reference book is never
 * presented as a verified attribution to the Prophet ﷺ.
 */

const PRIMARY_HADITH_BOOKS = /صحيح\s*البخاري|صحيح\s*مسلم|سنن\s*(?:أبي\s*داود|ابي\s*داود|الترمذي|النسائي|ابن\s*ماجه|الدارمي|الدارقطني)|مسند\s*أحمد|الموطأ|موطا|صحيح\s*ابن\s*حبان|صحيح\s*ابن\s*خزيمة|المستدرك|السنن\s*الكبرى|الطبراني|المعجم\s*(?:الكبير|الأوسط|الصغير)/;

export type SourceTier = 'primary' | 'secondary';

export function classifySourceTier(book: string): SourceTier {
  return PRIMARY_HADITH_BOOKS.test(book || '') ? 'primary' : 'secondary';
}
