/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Baseera decision policy.
 *
 * This module is deliberately deterministic. AI can rank or suggest queries,
 * but it can never by itself authorize a MATCHED result.
 */

import { VerificationResult, VerificationStatus } from '../types/baseera.ts';
import { isApprovedCitation } from './sourcePolicy.ts';

export type DecisionInput = {
  result: VerificationResult;
  sourceEvidenceValidated: boolean;
};

export type DecisionReasonCode =
  | 'SOURCE_EVIDENCE_REQUIRED'
  | 'INVALID_CITATION'
  | 'FIQH_REVIEW_ONLY'
  | 'TAFSIR_REVIEW_ONLY'
  | 'AQEEDAH_REVIEW_ONLY'
  | 'MATCH_ALLOWED';

export type DecisionOutcome = {
  status: VerificationStatus;
  allowed: boolean;
  reasonCode: DecisionReasonCode;
};

function sourceEvidenceIsComplete(result: VerificationResult, sourceEvidenceValidated: boolean): boolean {
  return (
    sourceEvidenceValidated &&
    Boolean(result.canonical_text?.trim()) &&
    Boolean(result.citation?.source_id) &&
    Boolean(result.citation?.url) &&
    isApprovedCitation(result.citation)
  );
}

/**
 * Enforces the final output boundary.
 *
 * Rules:
 * 1. MATCHED requires actual source evidence + valid source-specific citation.
 * 2. AI metadata can never be proof.
 * 3. Fiqh, tafsir and aqeedah are review/referral surfaces, not autonomous rulings.
 * 4. Missing source evidence fails closed to NOT_FOUND unless the existing result
 *    is a specialist referral.
 */
export function enforceDecisionPolicy(input: DecisionInput): DecisionOutcome {
  const { result, sourceEvidenceValidated } = input;
  const type = result.item.type;

  if (type === 'fiqh_question') {
    if (result.status === 'MATCHED') {
      return {
        status: 'NEEDS_REVIEW',
        allowed: false,
        reasonCode: 'FIQH_REVIEW_ONLY'
      };
    }
    return {
      status: result.status,
      allowed: result.status === 'NEEDS_REVIEW' || result.status === 'REFER_TO_SPECIALIST',
      reasonCode: result.status === 'REFER_TO_SPECIALIST' ? 'MATCH_ALLOWED' : 'FIQH_REVIEW_ONLY'
    };
  }

  if (type === 'tafsir_question') {
    if (result.status === 'MATCHED') {
      return { status: 'NEEDS_REVIEW', allowed: false, reasonCode: 'TAFSIR_REVIEW_ONLY' };
    }
    return { status: result.status, allowed: true, reasonCode: 'TAFSIR_REVIEW_ONLY' };
  }

  if (type === 'aqeedah_question') {
    if (result.status === 'MATCHED') {
      return { status: 'NEEDS_REVIEW', allowed: false, reasonCode: 'AQEEDAH_REVIEW_ONLY' };
    }
    return { status: result.status, allowed: true, reasonCode: 'AQEEDAH_REVIEW_ONLY' };
  }

  if (result.status === 'MATCHED') {
    if (!sourceEvidenceIsComplete(result, sourceEvidenceValidated)) {
      return {
        status: 'NOT_FOUND_IN_CHECKED_SOURCES',
        allowed: false,
        reasonCode: sourceEvidenceValidated ? 'INVALID_CITATION' : 'SOURCE_EVIDENCE_REQUIRED'
      };
    }

    return {
      status: 'MATCHED',
      allowed: true,
      reasonCode: 'MATCH_ALLOWED'
    };
  }

  if (
    result.status === 'NEEDS_REVIEW' &&
    result.canonical_text?.trim() &&
    (!result.citation?.source_id || !isApprovedCitation(result.citation))
  ) {
    return {
      status: 'NOT_FOUND_IN_CHECKED_SOURCES',
      allowed: false,
      reasonCode: 'INVALID_CITATION'
    };
  }

  return {
    status: result.status,
    allowed: true,
    reasonCode: result.status === 'REFER_TO_SPECIALIST' ? 'MATCH_ALLOWED' : 'SOURCE_EVIDENCE_REQUIRED'
  };
}
