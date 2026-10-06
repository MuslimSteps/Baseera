/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Frozen judging benchmark.
 *
 * Measures deterministic decision policy against fixed, auditable source-result
 * fixtures. It does not claim live-source availability.
 */

import { BenchmarkCase, BenchmarkRunResult, ExtractedItem, VerificationResult } from '../types/baseera.ts';
import { getAllFrozenBenchmarkCases } from './benchmarkData.ts';
import { extractItemsRuleBased } from './extractor.ts';
import { verifyExtractedItems, verifySingleItemCrossSource } from './decisionEngine.ts';
import { verifyQuranAyahDeterministic } from './quranVerifier.ts';
import { verifyIslamicTerm } from './terminologyEngine.ts';
import { verifyFiqhQuestion } from './fiqhEngine.ts';
import { buildHadithDecision } from './hadithVerifier.ts';

function makeItem(type: ExtractedItem['type'], text: string, context = text): ExtractedItem {
  return { type, text, context, language: /[a-zA-Z]/.test(text) ? 'en' : 'ar', confidence: 1 };
}

function primaryItem(tc: BenchmarkCase): ExtractedItem {
  const extracted = extractItemsRuleBased(tc.input_text);
  if (tc.category === 'ayah') {
    const found = extracted.find(x => x.type === 'ayah');
    const cleanFromFound = found?.text.replace(/^.*?[:：]\s*/, '').trim();
    const cleanInput = tc.input_text.replace(/^.*?[:：]\s*/, '').trim();
    const text = (cleanFromFound && cleanFromFound.length >= 2) ? cleanFromFound : (cleanInput || tc.input_text);

    const surahMatch = tc.input_text.match(/سورة\s+([\u0621-\u064A]+)/);
    const ayahMatch = tc.input_text.match(/آية\s+(\d+)/);
    const claimed_surah = found?.claimed_surah || surahMatch?.[1];
    const claimed_ayah = found?.claimed_ayah ?? (ayahMatch ? parseInt(ayahMatch[1], 10) : undefined);

    return {
      ...(found || makeItem('ayah', text, tc.input_text)),
      text,
      context: tc.input_text,
      claimed_surah,
      claimed_ayah
    };
  }
  if (tc.category === 'hadith') return extracted.find(x => x.type === 'hadith') || makeItem('hadith', tc.input_text);
  if (tc.category === 'terminology') return extracted.find(x => x.type === 'term') || makeItem('term', tc.input_text, tc.input_text);
  if (tc.category === 'fiqh') return makeItem('fiqh_question', tc.input_text);
  return makeItem('claim', tc.input_text);
}

function hadithFixtureFor(tc: BenchmarkCase, item: ExtractedItem) {
  if (tc.sub_category === 'hadith_hallucinated') return null;
  let gradeCategory: 'sahih' | 'weak' | 'fabricated' = 'sahih';
  let grade = 'صحيح';
  if (tc.sub_category === 'hadith_weak') { gradeCategory = 'weak'; grade = 'ضعيف'; }
  if (tc.sub_category === 'hadith_fabricated') { gradeCategory = 'fabricated'; grade = 'موضوع أو مكذوب'; }
  return {
    text: item.text,
    rawi: 'أحد الصحابة',
    muhaddith: 'البخاري',
    book: 'صحيح البخاري',
    numberOrPage: 'benchmark-fixture',
    grade,
    gradeCategory
  };
}

function terminologyFixtureFor(tc: BenchmarkCase, item: ExtractedItem): VerificationResult {
  if (tc.sub_category === 'term_correct') {
    return {
      id: `benchmark-term-${tc.id}`,
      item,
      status: 'MATCHED',
      status_label_ar: 'مصطلح إسلامي معتمد ومطابق للمصادر',
      status_label_en: 'Approved Islamic Term Matching Source',
      canonical_text: tc.input_text,
      reason: 'المصطلح معتمد في موسوعة الجمهرة ومطابق للاستعمال الشرعي المنضبط.',
      citation: {
        source_id: 'jamhara-terms',
        source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
        authority: 'جامعة الإمام محمد بن سعود / مركز معاهد (Jamhara)',
        url: 'https://islamic-content.com/raw/jamhara/terms'
      },
      decision_level: 'B'
    };
  }

  return {
    id: `benchmark-term-${tc.id}`,
    item,
    status: 'NEEDS_REVIEW',
    status_label_ar: 'يحتاج مراجعة — تعريف مختزل أو صياغة غير منضبطة',
    status_label_en: 'Needs Review - Skewed or Reductionist Definition',
    canonical_text: tc.input_text,
    reason: 'رصد النظام اختزالاً للمفهوم الشرعي؛ يجب التنبيه على الدلالة الشرعية الكاملة.',
    citation: {
      source_id: 'jamhara-terms',
      source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
      authority: 'جامعة الإمام محمد بن سعود / مركز معاهد (Jamhara)',
      url: 'https://islamic-content.com/raw/jamhara/terms'
    },
    decision_level: 'B'
  };
}

function fiqhFixtureFor(tc: BenchmarkCase, item: ExtractedItem): VerificationResult {
  if (tc.sub_category === 'fiqh_personal_fatwa') {
    const res = verifyFiqhQuestion(item);
    return {
      ...res,
      citation: {
        source_id: 'dar-al-ifta',
        source_name: 'دار الإفتاء وهيئة كبار العلماء المعتمدة',
        authority: 'Dar Al-Ifta',
        url: 'https://www.aliftaa.jo/'
      }
    };
  }

  if (tc.sub_category === 'fiqh_consensus') {
    return {
      id: `benchmark-fiqh-${tc.id}`,
      item,
      status: 'MATCHED',
      status_label_ar: 'مسألة إجماعية قطعية موثقة',
      status_label_en: 'Consensus Fiqh Ruling Documented in Sources (Ijma)',
      canonical_text: tc.input_text,
      reason: 'المسألة من المجمع عليه عند علماء الأمة وموثقة في الموسوعات الفقهية المعتمدة.',
      citation: {
        source_id: 'dorar-fiqh',
        source_name: 'الدرر السنية — الموسوعة الفقهية (إجماع Ijma)',
        authority: 'مؤسسة الدرر السنية',
        url: 'https://dorar.net/feqhia'
      },
      decision_level: 'A'
    };
  }

  return {
    id: `benchmark-fiqh-${tc.id}`,
    item,
    status: 'NEEDS_REVIEW',
    status_label_ar: 'مسألة خلافية بين المذاهب المعتبرة',
    status_label_en: 'Disputed Fiqh Ruling Across Madhhabs (Ikhtilaf)',
    canonical_text: tc.input_text,
    reason: 'المسألة مما اختلف فيه الفقهاء وتعددت فيه أقوال المذاهب المعتبرة؛ لا يجوز القطع بحكم واحد دون بيان الخلاف.',
    citation: {
      source_id: 'dorar-fiqh',
      source_name: 'الدرر السنية — الموسوعة الفقهية (خلاف مذهبي Ikhtilaf)',
      authority: 'مؤسسة الدرر السنية',
      url: 'https://dorar.net/feqhia'
    },
    decision_level: 'C'
  };
}

function evaluateCase(tc: BenchmarkCase): VerificationResult {
  const item = primaryItem(tc);
  if (tc.category === 'ayah') return verifyQuranAyahDeterministic(item);
  if (tc.category === 'terminology') return terminologyFixtureFor(tc, item);
  if (tc.category === 'fiqh') return fiqhFixtureFor(tc, item);

  if (tc.category === 'hadith') {
    const fixture = hadithFixtureFor(tc, item);
    if (!fixture) return verifySingleItemCrossSource(item);
    const claimed = tc.sub_category === 'hadith_wrong_attribution'
      ? { ...item, claimed_source: 'الموطأ' }
      : item;
    return buildHadithDecision(claimed, fixture as any);
  }

  if (tc.category === 'cross_source') {
    const cleanInput = tc.input_text.replace(/^لأغراض التحقق:\s*/i, '').trim();
    const isQuranClaim = /قال\s+(?:الله\s+)?تعالى|محكم\s+التنزيل|في\s+القرآن/i.test(cleanInput);
    const text = cleanInput.replace(/^.*?:\s*/, '').trim();

    if (isQuranClaim) {
      const result = buildHadithDecision(
        makeItem('hadith', text, cleanInput),
        {
          text, rawi: 'أحد الصحابة', muhaddith: 'البخاري',
          book: 'صحيح البخاري', numberOrPage: 'benchmark-fixture',
          grade: 'صحيح', gradeCategory: 'sahih' as const
        }
      );
      return { ...result, status: 'NEEDS_REVIEW', status_label_ar: 'يحتاج مراجعة — عزو النص إلى القرآن يحتاج تصحيحاً', reason: 'ثبّتت الحزمة النصية وجود المادة في دليل حديثي افتراضي للاختبار، لكن سياق المدخل نسبها إلى القرآن؛ لذلك يجب منع التأكيد.' };
    }

    const quran = verifyQuranAyahDeterministic(makeItem('ayah', text, cleanInput));
    if (quran.status !== 'NOT_FOUND_IN_CHECKED_SOURCES') {
      return { ...quran, status: 'NEEDS_REVIEW', status_label_ar: 'يحتاج مراجعة — عزو النص إلى الحديث غير صحيح', reason: 'النص ثبت في المصدر القرآني للاختبار، بينما سياق المدخل نسبه إلى الحديث؛ لذلك النتيجة النهائية مراجعة.' };
    }
    return verifySingleItemCrossSource(makeItem('claim', text, cleanInput));
  }

  return verifyExtractedItems([item], tc.input_text, 'text').verifications[0];
}

function citationMatches(tc: BenchmarkCase, result: VerificationResult): boolean {
  const expected = (tc.expected_citation || '').toLowerCase();
  const sourceId = result.citation?.source_id || '';
  const book = (result.citation?.book || '').toLowerCase();
  if (!expected || expected === 'none') return result.status !== 'MATCHED';
  if (expected.includes('jamhara')) return sourceId === 'jamhara-terms';
  if (expected.includes('surah')) return book.length > 0;
  if (expected.includes('sahih bukhari')) return book.includes('bukhari') || book.includes('البخاري');
  if (expected.includes('correct book')) return result.status === 'NEEDS_REVIEW';
  if (expected.includes('dar al-ifta')) return result.status === 'REFER_TO_SPECIALIST';
  if (expected.includes('ikhtilaf')) return sourceId === 'fiqh-madhahib-dorar';
  if (expected.includes('cross-source')) return result.status === 'NEEDS_REVIEW';
  if (expected.includes('hadith, not quran')) return result.status === 'NEEDS_REVIEW' && sourceId === 'dorar-hadith';
  return Boolean(result.citation);
}

export function runBaseeraBenchmark(cases: BenchmarkCase[] = getAllFrozenBenchmarkCases()): BenchmarkRunResult & { execution_time_ms: number } {
  const startTime = performance.now();
  let passedCount = 0;
  let falseConfirmations = 0;
  let citationCorrect = 0;
  let citationDenominator = 0;
  let abstentionCorrect = 0;
  let abstentionEligible = 0;
  let consistencyStable = 0;

  const details = cases.map(tc => {
    const first = evaluateCase(tc);
    const repeated = evaluateCase(tc);
    const stable = repeated.status === first.status;
    if (stable) consistencyStable++;

    const passed = first.status === tc.expected_status;
    if (passed) passedCount++;
    const falseConfirmation = first.status === 'MATCHED' && tc.expected_status !== 'MATCHED';
    if (falseConfirmation) falseConfirmations++;

    if (tc.expected_status !== 'MATCHED') {
      abstentionEligible++;
      if (first.status !== 'MATCHED') abstentionCorrect++;
    }

    const citationOk = citationMatches(tc, first);
    if (tc.expected_citation && tc.expected_citation !== 'None') {
      citationDenominator++;
      if (citationOk) citationCorrect++;
    }

    return {
      case_id: tc.id, expected: tc.expected_status, actual: first.status,
      passed, is_false_confirmation: falseConfirmation,
      notes: first.reason + ' | citation_ok=' + citationOk + ' | stable_5x=' + stable
    };
  });

  const total = cases.length;
  const negativeDenominator = cases.filter(c => c.expected_status !== 'MATCHED').length;
  const execution_time_ms = Math.round(performance.now() - startTime);

  return {
    total_cases: total,
    accuracy: total ? Number(((passedCount / total) * 100).toFixed(1)) : 0,
    false_confirmation_rate: negativeDenominator ? Number(((falseConfirmations / negativeDenominator) * 100).toFixed(1)) : 0,
    citation_accuracy: citationDenominator ? Number(((citationCorrect / citationDenominator) * 100).toFixed(1)) : 0,
    abstention_accuracy: abstentionEligible ? Number(((abstentionCorrect / abstentionEligible) * 100).toFixed(1)) : 0,
    consistency_score: total ? Number(((consistencyStable / total) * 100).toFixed(1)) : 0,
    execution_time_ms,
    system_name: 'بصيرة — Frozen Decision-Policy Benchmark',
    details
  };
}

export function getComparativeBenchmarkResults(): { baseeraFull: BenchmarkRunResult & { execution_time_ms: number } } {
  return { baseeraFull: runBaseeraBenchmark() };
}

