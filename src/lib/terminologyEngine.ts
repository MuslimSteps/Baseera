/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Source-first Islamic terminology verification.
 *
 * There is no checked-in terminology knowledge base and no term-specific
 * religious assertions in this module. The approved Jamhara source is queried
 * live; AI may assist with search/ranking only.
 */

import { buildJamharaSearchUrl } from './jamharaClient.ts';
import { ExtractedItem, VerificationResult } from '../types/baseera.ts';

export function verifyIslamicTerm(item: ExtractedItem): VerificationResult {
  const searchUrl = buildJamharaSearchUrl(item.text);

  const pending: VerificationResult & { _needs_live_search?: boolean } = {
    id: `term-live-${Date.now()}`,
    item,
    status: 'NOT_FOUND_IN_CHECKED_SOURCES',
    status_label_ar: 'سيجري البحث في موسوعة الجمهرة المعتمدة مباشرة',
    status_label_en: 'Will Search the Approved Jamhara Source Directly',
    reason: 'لا يعتمد النظام على سجل مصطلحات محلي. ستُسترجع المادة مباشرة من موسوعة الجمهرة، ثم تُعرض فقط إذا ثبتت في المصدر.',
    citation: {
      source_id: 'jamhara-terms',
      source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
      authority: 'islamic-content.com',
      url: searchUrl
    },
    abstention_note: 'لا يُنشأ تعريف للمصطلح من معرفة النموذج عند غياب المادة المصدرية.',
    decision_level: 'B',
    _needs_live_search: true
  };

  return pending;
}
