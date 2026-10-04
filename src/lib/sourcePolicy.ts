/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single source-policy boundary for Baseera.
 * Religious evidence may only leave the backend when its source ID and URL
 * are both allowed by the approved source registry.
 */

import sourceRegistry from '../../sources/source-registry.json' with { type: 'json' };

export const APPROVED_SOURCE_IDS = new Set(
  (Array.isArray((sourceRegistry as any).sources) ? (sourceRegistry as any).sources : [])
    .map((source: any) => source.id)
    .filter(Boolean)
);

export function isApprovedSourceUrl(rawUrl?: string): boolean {
  if (!rawUrl) return true;
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return (
      host === 'dorar.net' || host.endsWith('.dorar.net') ||
      host === 'qurancomplex.gov.sa' || host.endsWith('.qurancomplex.gov.sa') ||
      host === 'quranpedia.net' || host.endsWith('.quranpedia.net') ||
      host === 'islamic-content.com' || host.endsWith('.islamic-content.com') ||
      host === 'dawa.center' || host.endsWith('.dawa.center') ||
      host === 'shamela.ws' || host.endsWith('.shamela.ws')
    );
  } catch {
    return false;
  }
}

const SOURCE_ALLOWED_PATHS: Record<string, RegExp> = {
  'quran-translations': /^\/verse(?:\/|$)/,
  'quran-tafsir-salaf': /^\/tafseer(?:\/|$)/,
  'dorar-aqeedah': /^\/aqeeda(?:\/|$)/,
  'dorar-hadith': /^\/(?:hadith|dorar_api\.json)(?:\/|$|\?)/,
  'shamela-sunnah': /^\//,
  'jamhara-terms': /^\/(?:dictionary|search)(?:\/|$|\?)/,
  'fiqh-madhahib-dorar': /^\/feqhia(?:\/|$|\?)/,
  'dawa-center': /^\//
};

function pathAllowedForSource(sourceId: string, rawUrl?: string): boolean {
  if (!rawUrl) return true;
  const pattern = SOURCE_ALLOWED_PATHS[sourceId];
  if (!pattern) return true;
  try {
    const url = new URL(rawUrl);
    return pattern.test(url.pathname + (url.search ? url.search : ''));
  } catch {
    return false;
  }
}

const SOURCE_ALLOWED_HOSTS: Record<string, string[]> = {
  'quran-uthmani': ['qurancomplex.gov.sa'],
  'quran-translations': ['quranpedia.net', 'qurancomplex.gov.sa'],
  'quran-tafsir-salaf': ['dorar.net'],
  'dorar-aqeedah': ['dorar.net'],
  'dorar-hadith': ['dorar.net'],
  'shamela-sunnah': ['shamela.ws'],
  'jamhara-terms': ['islamic-content.com'],
  'fiqh-madhahib-dorar': ['dorar.net'],
  'dawa-center': ['dawa.center']
};

function hostAllowedForSource(sourceId: string, rawUrl?: string): boolean {
  if (!rawUrl) return true;
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    const allowed = SOURCE_ALLOWED_HOSTS[sourceId] || [];
    return allowed.some(domain => host === domain || host.endsWith('.' + domain));
  } catch {
    return false;
  }
}

export function isApprovedCitation(citation: { source_id?: string; url?: string }): boolean {
  // Registry metadata is policy metadata, not religious evidence. It is allowed
  // only without a fabricated evidence URL; evidence citations must be source-specific.
  if (citation?.source_id === 'source-registry-all') return !citation.url;
  if (!citation?.source_id || !APPROVED_SOURCE_IDS.has(citation.source_id)) return false;
  return isApprovedSourceUrl(citation.url) &&
    hostAllowedForSource(citation.source_id, citation.url) &&
    pathAllowedForSource(citation.source_id, citation.url);
}

export function enforceApprovedCitations(report: any): void {
  let blocked = false;
  for (const verification of report.verifications || []) {
    const citation = verification.citation;
    if (!citation) continue;

    if (!isApprovedCitation(citation)) {
      blocked = true;
      verification.status = 'NEEDS_REVIEW';
      verification.status_label_ar = 'يحتاج مراجعة — المرجع خارج سجل المصادر المعتمد';
      verification.status_label_en = 'Needs Review — Citation outside approved registry';
      verification.reason = 'تم منع هذه النتيجة لأن المرجع أو نطاق الرابط ليس ضمن سجل المصادر المعتمد للحزمة العلمية.';
      delete verification.canonical_text;
      delete verification.verified_translation;
      delete verification.school_positions;
      delete verification.diff;
      delete verification.jamhara_definition;
    }
  }

  if (blocked) report.overall_status = 'NEEDS_REVIEW';
}
