/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Evidence Alignment Engine (محرك مواءمة الأدلة والادعاءات)
 * 
 * Architectural Flow:
 *   Retriever
 *     ↓
 *   Evidence Normalizer
 *     ↓
 *   Claim–Evidence Alignment (Evidence Alignment Engine)
 *     ↓
 *   Decision Engine
 * 
 * Responsibilities:
 * 1. Analyzes user claim/question into structured semantic components:
 *    - subject (الموضوع: e.g. الخمر، المسح على الخفين، اللغو...)
 *    - action (الفعل/المسألة: e.g. شرب، مسح، حلف...)
 *    - ruling (الحكم المدعى: e.g. حلال، جائز 5 أيام...)
 *    - qualifiers (القيود والشروط والصفات: e.g. العنب، لعطش، 5 أيام، للمقيم، للغضبان...)
 *    - context (السياق والفرع)
 * 
 * 2. Normalizes retrieved candidate evidence documents.
 * 
 * 3. Classifies candidate evidence into:
 *    - DIRECT: Matches subject, action, AND all required qualifiers.
 *      (e.g., Article 3362 matches "الخمر" + "العنب" -> DIRECT).
 *    - RELATED: Matches broad subject, but has different, missing, or conflicting qualifiers.
 *      (e.g., Article 3368 matches "الخمر" + "العطش" -> RELATED, NOT DIRECT!).
 *    - OUT_OF_SCOPE: Topic divergence.
 * 
 * 4. Ensures that only DIRECT evidence forms the basis for primary source ruling / contradiction verdicts.
 */

import { normalizeArabic } from './normalizer.ts';

export type AlignmentType = 'DIRECT' | 'RELATED' | 'OUT_OF_SCOPE';

export interface ClaimDecomposition {
  core_subject: string;
  action?: string;
  claimed_ruling?: string;
  is_claim: boolean;
  required_qualifiers: string[];
  context?: string;
}

export interface CandidateEvidence {
  id?: string;
  title: string;
  text?: string;
  url: string;
  leafSegment?: string;
  score?: number;
}

export interface AlignedEvidence {
  candidate: CandidateEvidence;
  alignment: AlignmentType;
  alignment_score: number;
  matched_qualifiers: string[];
  missing_qualifiers: string[];
  extraneous_qualifiers: string[];
  explanation: string;
  is_underspecified?: boolean;
  ambiguity_note?: string;
}

const FIQH_STOP_WORDS = new Set([
  'ما', 'هو', 'هي', 'هل', 'في', 'من', 'على', 'عن', 'الى', 'إلى', 'مع', 'بعد', 'قبل',
  'ان', 'إن', 'أن', 'إذا', 'اذا', 'كان', 'كانت', 'شخص', 'كاتب', 'يقول', 'قال', 'حكم',
  'حلال', 'حرام', 'واجب', 'جائز', 'يجوز', 'يصح', 'يحرم', 'الشرع', 'الشرعي', 'الدين'
]);

/**
 * Normalizes text and extracts significant qualifier keywords.
 */
export function extractQualifierTokens(qualifier: string): string[] {
  const norm = normalizeArabic(qualifier);
  const parts = norm.split(/\s+/).map(p => p.replace(/^ال/, '').trim());
  return parts.filter(p => p.length >= 3 && !FIQH_STOP_WORDS.has(p));
}

/**
 * Evidence Normalizer: Normalizes candidate evidence metadata, splits breadcrumbs,
 * and isolates the leaf section title (المبحث / الفرع / المسألة المباشرة).
 */
export function normalizeCandidateEvidence(raw: { title: string; text?: string; url: string }): CandidateEvidence {
  const normTitle = normalizeArabic(raw.title || '');
  const leafSegment = normTitle.split(/[—–-]/).pop()?.trim() || normTitle;
  return {
    ...raw,
    title: raw.title.trim(),
    text: raw.text?.trim() || '',
    leafSegment,
    url: raw.url.trim()
  };
}

/**
 * Claim-Evidence Alignment Engine:
 * Compares a decomposed claim with candidate evidence documents.
 * Dissects subject, action, ruling, and especially required qualifiers.
 */
export function alignClaimWithEvidence(
  claim: ClaimDecomposition,
  candidates: Array<{ title: string; text?: string; url: string; score?: number }>
): AlignedEvidence[] {
  const normSubject = normalizeArabic(claim.core_subject).replace(/^ال/, '');
  const normQualifiers = (claim.required_qualifiers || [])
    .map(q => normalizeArabic(q).replace(/[0-9٥-٩]/g, '').trim())
    .filter(q => q.length >= 2);

  const results: AlignedEvidence[] = [];

  for (const rawCand of candidates) {
    const cand = normalizeCandidateEvidence(rawCand);
    const normTitle = normalizeArabic(cand.title);
    const normLeaf = cand.leafSegment || normTitle;
    const normText = normalizeArabic(cand.text || '');

    const matchedQualifiers: string[] = [];
    const missingQualifiers: string[] = [];
    const extraneousQualifiers: string[] = [];

    // Check each required qualifier
    for (const qual of normQualifiers) {
      const tokens = extractQualifierTokens(qual);
      const matchToken = (t: string, text: string) =>
        text.includes(t) ||
        ((t === 'لمس' || t === 'لامس') && (text.includes('مس') || text.includes('ملموس'))) ||
        ((t === 'مس' || t === 'ملموس') && (text.includes('لمس') || text.includes('لامس')));

      const phraseMatch = normLeaf.includes(qual) || normTitle.includes(qual);
      const tokenMatches = tokens.filter(t => matchToken(t, normLeaf) || matchToken(t, normTitle));

      const isSubstantiveMatch =
        phraseMatch ||
        (tokens.length === 1 && tokenMatches.length === 1) ||
        (tokens.length > 1 && tokenMatches.length >= Math.min(tokens.length, Math.max(1, Math.ceil(tokens.length / 2))));

      if (isSubstantiveMatch) {
        matchedQualifiers.push(qual);
      } else {
        missingQualifiers.push(qual);
      }
    }

    // Check for extraneous/conflicting qualifiers in leaf title
    // (e.g. user asked about عنب, but candidate is about عطش; or asked about مدة, but candidate is about انتهاء)
    const knownConflictingModifiers = [
      'عطش', 'تداوي', 'مكره', 'اضطرار', 'انتهاء', 'بدايه', 'ابتداء', 'يبطل', 'مبطلات', 'مفسدات'
    ];
    for (const mod of knownConflictingModifiers) {
      if ((normLeaf.includes(mod) || normTitle.includes(mod)) && !normQualifiers.some(q => q.includes(mod))) {
        extraneousQualifiers.push(mod);
      }
    }

    // Subject match check
    const subjectHit = normTitle.includes(normSubject) || normLeaf.includes(normSubject);

    let alignment: AlignmentType = 'OUT_OF_SCOPE';
    let alignmentScore = 0;
    let explanation = '';

    if (!subjectHit && matchedQualifiers.length === 0) {
      alignment = 'OUT_OF_SCOPE';
      alignmentScore = 0;
      explanation = 'المستند خارج نطاق موضوع السؤال الأساسي.';
    } else if (normQualifiers.length > 0 && matchedQualifiers.length === normQualifiers.length && extraneousQualifiers.length === 0) {
      // Direct match on all required qualifiers with no conflicting modifiers
      alignment = 'DIRECT';
      alignmentScore = 1000 + (normLeaf.includes(matchedQualifiers[0]) ? 300 : 100);
      explanation = `دليل مباشر يطابق قيود وشروط المسألة المطلوبة بالكامل («${matchedQualifiers.join('، ')}»).`;
    } else if (matchedQualifiers.length > 0) {
      // Partial qualifier match or has extraneous modifier
      if (extraneousQualifiers.length > 0) {
        alignment = 'RELATED';
        alignmentScore = 500 + matchedQualifiers.length * 100 - extraneousQualifiers.length * 150;
        explanation = `مستند مرتبط بالسياق العام، لكنه يختص بقيد فرعي مختلف («${extraneousQualifiers.join('، ')}») عن قيد السؤال المباشر.`;
      } else {
        alignment = 'DIRECT';
        alignmentScore = 800 + matchedQualifiers.length * 100;
        explanation = `دليل مباشر يطابق القيد الأساسي («${matchedQualifiers.join('، ')}»).`;
      }
    } else if (normQualifiers.length > 0 && matchedQualifiers.length === 0) {
      // Missing required qualifiers (e.g. asked about wine from grapes, but candidate is wine from thirst)
      alignment = 'RELATED';
      alignmentScore = 300 - extraneousQualifiers.length * 100;
      explanation = `مستند عام في ذات الباب، ولكنه لا يتناول القيد الإلزامي المطلوب («${missingQualifiers.join('، ')}»).`;
    } else {
      // No specific qualifiers required in question; general subject match
      // Check if this was a question and candidate narrows it with extra specialization words
      const candTokens = normLeaf.split(/\s+/).map(t => t.replace(/^ال/, '')).filter(t => t.length >= 3 && !FIQH_STOP_WORDS.has(t));
      const subjectTokens = normSubject.split(/\s+/).map(t => t.replace(/^ال/, '')).filter(t => t.length >= 3 && !FIQH_STOP_WORDS.has(t));
      const extraSpecializations = candTokens.filter(t => !subjectTokens.some(st => t.includes(st) || st.includes(t)));

      if (!claim.is_claim && extraSpecializations.length > 0 && subjectTokens.length <= 2) {
        // Broad question, candidate is specialized branch (e.g. question: "اللغو", candidate: "لغو اليمين")
        alignment = 'RELATED';
        alignmentScore = 650;
        const subBranch = cand.leafSegment || cand.title;
        const ambiguityNote = `تنبيه دلالي: مصطلح «${claim.core_subject}» في السؤال عام وغير محدد؛ والمادة الفقهية التي عُثر عليها تتناول تحديداً «${subBranch}». ينبغي تحديد المسألة والفرع المقصود بدقة للتحقق التام.`;
        explanation = ambiguityNote;
        results.push({
          candidate: cand,
          alignment,
          alignment_score: alignmentScore,
          matched_qualifiers: matchedQualifiers,
          missing_qualifiers: missingQualifiers,
          extraneous_qualifiers: extraneousQualifiers,
          explanation,
          is_underspecified: true,
          ambiguity_note: ambiguityNote
        });
        continue;
      } else {
        alignment = 'DIRECT';
        alignmentScore = 700;
        explanation = 'دليل مباشر يتناول أصل المسألة العامة دون قيود عارضة.';
      }
    }

    results.push({
      candidate: cand,
      alignment,
      alignment_score: alignmentScore,
      matched_qualifiers: matchedQualifiers,
      missing_qualifiers: missingQualifiers,
      extraneous_qualifiers: extraneousQualifiers,
      explanation
    });
  }

  // Sort: DIRECT candidates first, sorted by alignment score descending
  results.sort((a, b) => b.alignment_score - a.alignment_score);

  return results;
}
