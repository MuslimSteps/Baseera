/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VerificationStatus =
  | 'MATCHED'
  | 'NEEDS_REVIEW'
  | 'NOT_FOUND_IN_CHECKED_SOURCES'
  | 'REFER_TO_SPECIALIST';

export type ItemType = 'ayah' | 'hadith' | 'term' | 'fiqh_question' | 'tafsir_question' | 'aqeedah_question' | 'claim';

export interface SourceCitation {
  source_id: string;
  source_name: string;
  authority: string;
  book?: string;
  number_or_page?: string;
  grade?: string;
  url?: string;
  access_method?: string;
  language?: string;
}

export interface DiffWord {
  type: 'equal' | 'missing' | 'added' | 'changed';
  word: string;
  expected?: string;
}

export interface ExtractedItem {
  type: ItemType;
  text: string;
  context: string;
  language: string;
  location_in_input?: string;
  claimed_source?: string;
  claimed_surah?: string;
  claimed_ayah?: number;
  confidence: number;
}

export interface SchoolPosition {
  school: string;
  ruling: string;
}

export interface VerificationResult {
  id: string;
  finding_type?: 'altered_quran_text' | 'partial_quran_quote' | 'wrong_quran_attribution' | 'generic_review' | 'contradicted_claim' | 'ambiguous_question' | 'documented_question' | 'disputed_consensus' | 'documented_consensus' | 'verified_claim';
  item: ExtractedItem;
  status: VerificationStatus;
  status_label_ar: string;
  status_label_en: string;
  reason: string;
  citation: SourceCitation;
  canonical_text?: string;
  source_ruling?: string;
  direct_ruling?: string; // Backwards-compatible alias for source_ruling
  baseera_explanation?: string;
  ambiguity_note?: string;
  is_question?: boolean;
  evidence_alignment?: 'DIRECT' | 'RELATED' | 'OUT_OF_SCOPE';
  canonical_surah?: string;
  canonical_ayah_number?: number;
  /** True when the user's text is a verbatim excerpt (جزء) of the source verse/hadith. */
  is_partial_quote?: boolean;
  /** Word window, inside canonical_text, that the user's excerpt corresponds to. */
  quote_window?: { start: number; words: number };
  verified_translation?: string;
  diff?: DiffWord[];
  reduction_warning?: string;
  jamhara_definition?: string;
  school_positions?: SchoolPosition[];
  abstention_note?: string;
  decision_level?: 'A' | 'B' | 'C' | 'D';
  ai_match?: {
    provider: 'groq';
    candidate_id: string;
    relation: 'exact' | 'altered' | 'partial' | 'related';
    confidence: number;
  };
}

export interface AnalysisReport {
  id: string;
  input_type: 'text' | 'url' | 'image' | 'audio';
  original_input: string;
  normalized_text: string;
  extracted_items_count: number;
  verifications: VerificationResult[];
  overall_status: VerificationStatus;
  summary_ar: string;
  summary_en: string;
  created_at: string;
  verifier_stats: {
    matched_count: number;
    needs_review_count: number;
    not_found_count: number;
    referral_count: number;
  };
}

export interface BenchmarkCase {
  id: string;
  category: string;
  sub_category: string;
  title_ar: string;
  title_en: string;
  input_text: string;
  language: string;
  expected_status: VerificationStatus;
  expected_citation: string;
  critical_rule: string;
  is_frozen: boolean;
}

export interface BenchmarkRunResult {
  total_cases: number;
  accuracy: number;
  false_confirmation_rate: number; // Goal: 0%
  citation_accuracy: number;
  abstention_accuracy: number;
  consistency_score: number;
  system_name: string;
  details: Array<{
    case_id: string;
    expected: VerificationStatus;
    actual: VerificationStatus;
    passed: boolean;
    is_false_confirmation: boolean;
    notes: string;
  }>;
}
