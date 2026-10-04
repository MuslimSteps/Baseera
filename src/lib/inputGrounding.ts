/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LLM extraction grounding guard.
 * The model may classify/understand text, but it may not manufacture evidence.
 */

import { normalizeArabic } from './normalizer.ts';

export function isGroundedInInput(candidate: unknown, input: string): boolean {
  const value = String(candidate ?? '').trim();
  const source = String(input ?? '').trim();
  if (!value || !source) return false;

  const normalizedCandidate = normalizeArabic(value);
  const normalizedSource = normalizeArabic(source);
  return Boolean(normalizedCandidate && normalizedSource.includes(normalizedCandidate));
}
