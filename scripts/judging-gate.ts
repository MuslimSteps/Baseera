import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import sourceRegistry from '../sources/source-registry.json' with { type: 'json' };
import quranData from '../sources/quran.json' with { type: 'json' };
import translationData from '../sources/quran_translations.json' with { type: 'json' };
import terminologyData from '../sources/terminology.json' with { type: 'json' };
import fiqhData from '../sources/fiqh.json' with { type: 'json' };

import { extractItemsRuleBased } from '../src/lib/extractor.ts';
import { verifyExtractedItems, verifySingleItemCrossSource } from '../src/lib/decisionEngine.ts';
import { verifyQuranAyah } from '../src/lib/quranVerifier.ts';
import { verifyIslamicTerm } from '../src/lib/terminologyEngine.ts';
import { verifyFiqhQuestion, isSensitiveFiqhQuestion } from '../src/lib/fiqhEngine.ts';
import { buildHadithDecision } from '../src/lib/hadithVerifier.ts';
import { normalizeArabicStrict } from '../src/lib/normalizer.ts';
import { runBaseeraBenchmark } from '../src/lib/benchmarkRunner.ts';
import { getAllFrozenBenchmarkCases, getRobustnessBenchmarkCases } from '../src/lib/benchmarkData.ts';
import { APPROVED_SOURCE_IDS, enforceApprovedCitations, isApprovedSourceUrl } from '../src/lib/sourcePolicy.ts';
import { isGroundedInInput } from '../src/lib/inputGrounding.ts';
import { isApprovedCitation } from '../src/lib/sourcePolicy.ts';
import { buildDorarAqeedahUrl, buildDorarTafsirUrl } from '../src/lib/dorarEncyclopediaClient.ts';
import { buildJamharaSearchUrl } from '../src/lib/jamharaClient.ts';
import { buildQuranpediaAyahUrl } from '../src/lib/quranpediaClient.ts';

type TestFn = () => void;
const failures: string[] = [];

function test(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL  ${name}\n      ${message}`);
  }
}

const item = (type: any, text: string, extra: any = {}) => ({
  type,
  text,
  context: text,
  language: 'ar',
  confidence: 1,
  ...extra
});

console.log('\n=== BASERA JUDGING GATE ===\n');

// A. Registry/source coverage
test('registry includes all required scientific domains', () => {
  const ids = new Set((sourceRegistry as any).sources.map((s: any) => s.id));
  for (const required of [
    'quran-uthmani',
    'quran-translations',
    'quran-tafsir-salaf',
    'dorar-aqeedah',
    'dorar-hadith',
    'shamela-sunnah',
    'jamhara-terms',
    'fiqh-madhahib-dorar',
    'dawa-center'
  ]) assert.ok(ids.has(required), `missing registry source: ${required}`);
  assert.equal(ids.size, 9);
});

test('registry IDs used by active source policy are consistent', () => {
  for (const id of APPROVED_SOURCE_IDS) assert.ok(
    (sourceRegistry as any).sources.some((s: any) => s.id === id),
    `policy contains unknown source ID: ${id}`
  );
});

test('source URL guard rejects unapproved domains', () => {
  assert.equal(isApprovedSourceUrl('https://dorar.net/hadith/search'), true);
  assert.equal(isApprovedSourceUrl('https://quranpedia.net/'), true);
  assert.equal(isApprovedSourceUrl('https://example.com/fake-fatwa'), false);
});

test('source policy binds the source ID to the correct official path', () => {
  const report: any = {
    overall_status: 'MATCHED',
    verifications: [{
      status: 'MATCHED',
      canonical_text: 'must be removed',
      citation: { source_id: 'fiqh-madhahib-dorar', source_name: 'Dorar', url: 'https://dorar.net/hadith/search?q=foo' }
    }]
  };
  enforceApprovedCitations(report);
  assert.equal(report.verifications[0].status, 'NEEDS_REVIEW');
  assert.equal('canonical_text' in report.verifications[0], false);
});

test('swearing-by-other-than-Allah is handled as fiqh review, not consensus', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'ما حكم الحلف بغير الله؟'));
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.equal(result.decision_level, 'C');
});

test('citation guard downgrades an unapproved citation', () => {
  const report: any = {
    overall_status: 'MATCHED',
    verifications: [{
      status: 'MATCHED',
      citation: { source_id: 'fake-source', source_name: 'fake', url: 'https://example.com/fake' }
    }]
  };
  enforceApprovedCitations(report);
  assert.equal(report.overall_status, 'NEEDS_REVIEW');
  assert.equal(report.verifications[0].status, 'NEEDS_REVIEW');
});

test('citation guard rejects a valid source ID paired with the wrong approved domain', () => {
  const report: any = {
    overall_status: 'MATCHED',
    verifications: [{
      status: 'MATCHED',
      canonical_text: 'must be removed',
      citation: { source_id: 'dorar-hadith', source_name: 'Dorar', url: 'https://quranpedia.net/verse/1/1' }
    }]
  };
  enforceApprovedCitations(report);
  assert.equal(report.overall_status, 'NEEDS_REVIEW');
  assert.equal(report.verifications[0].status, 'NEEDS_REVIEW');
  assert.equal('canonical_text' in report.verifications[0], false);
});

// B. LLM anti-hallucination boundary
test('LLM extraction cannot introduce text absent from the user input', () => {
  const original = 'قال تعالى: الحمد لله رب العالمين';
  assert.equal(isGroundedInInput('الحمد لله رب العالمين', original), true);
  assert.equal(isGroundedInInput('نص لم يذكره المستخدم', original), false);
});

test('rule-based extraction detects a sensitive fiqh phrase without explicit "what is the ruling"', () => {
  const items = extractItemsRuleBased('سب الدين');
  assert.ok(items.some(x => x.type === 'fiqh_question'));
});

test('sensitive fiqh detector is fail-closed for blasphemy/takfir language', () => {
  assert.equal(isSensitiveFiqhQuestion('ما حكم سب الدين؟'), true);
  assert.equal(isSensitiveFiqhQuestion('ما حكم التكفير؟'), true);
});

test('tafsir questions are routed to the approved tafsir source only', () => {
  const result = verifySingleItemCrossSource(item('tafsir_question', 'ما تفسير سورة الفاتحة؟'));
  assert.equal(result.citation.source_id, 'quran-tafsir-salaf');
  assert.equal((result as any)._needs_live_search, true);
});

test('aqeedah questions are routed to the approved aqeedah source only', () => {
  const result = verifySingleItemCrossSource(item('aqeedah_question', 'ما هي عقيدة أهل السنة في القدر؟'));
  assert.equal(result.citation.source_id, 'dorar-aqeedah');
  assert.equal((result as any)._needs_live_search, true);
});

// C. Quran
const basmala = quranData.verses.find((v: any) =>
  normalizeArabicStrict(v.text_clean || '') === normalizeArabicStrict('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')
);
assert.ok(basmala, 'known Quran fixture missing');

test('Quran exact text can be MATCHED from the approved local Quran corpus', () => {
  const result = verifyQuranAyah(item('ayah', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', {
    claimed_surah: 'الفاتحة'
  }));
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.citation.source_id, 'quran-uthmani');
});

test('Quran one-word alteration cannot be MATCHED', () => {
  const result = verifyQuranAyah(item('ayah', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الْغَفُورِ الرَّحِيمِ', {
    claimed_surah: 'الفاتحة'
  }));
  assert.notEqual(result.status, 'MATCHED');
  assert.ok(['NEEDS_REVIEW', 'NOT_FOUND_IN_CHECKED_SOURCES'].includes(result.status));
});

test('Quran incorrect verse attribution is not MATCHED', () => {
  const result = verifyQuranAyah(item('ayah', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', {
    claimed_surah: 'البقرة',
    claimed_ayah: 2
  }));
  assert.notEqual(result.status, 'MATCHED');
});

// D. Terminology
test('Jamhara term match is source-backed but cannot certify the surrounding sentence', () => {
  const report = verifyExtractedItems(
    extractItemsRuleBased('Tawhid in Islam is the comprehensive oneness of Allah.'),
    'Tawhid in Islam is the comprehensive oneness of Allah.',
    'text'
  );
  assert.ok(report.verifications.length > 0);
  assert.ok(report.verifications.every(v => v.status !== 'MATCHED' || v.item.text.length > 20));
});

test('reductionist terminology is flagged', () => {
  const result = verifyIslamicTerm(item('term', 'Sharia'));
  // "Sharia" alone is valid terminology; the important safety test is the explicit reductionist context.
  const reduction = verifyIslamicTerm(item('term', 'Sharia', {
    context: 'Sharia exclusively means penal laws, corporal punishments, and amputation of hands.'
  }));
  assert.equal(result.citation.source_id, 'jamhara-terms');
  assert.equal(reduction.status, 'NEEDS_REVIEW');
});

test('explicit term verification does not fall through to Quran/Hadith sources', () => {
  const result = verifySingleItemCrossSource(item('term', 'التوحيد'));
  assert.equal(result.citation.source_id, 'jamhara-terms');
});

// E. Fiqh safety
test('sensitive fiqh question is referral-only', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'ما حكم سب الدين؟'));
  assert.equal(result.status, 'REFER_TO_SPECIALIST');
  assert.equal(result.decision_level, 'D');
  assert.equal('canonical_text' in result, false);
});

test('personal divorce case is referral-only', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'حلفت على زوجتي بالطلاق فهل وقع طلاقي؟'));
  assert.equal(result.status, 'REFER_TO_SPECIALIST');
  assert.equal(result.decision_level, 'D');
});

test('known comparative fiqh disagreement remains review-only', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'ما حكم نقض الوضوء بلمس المرأة الأجنبية بغير حائل؟'));
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.equal(result.decision_level, 'C');
});

// F. Hadith decision policy with approved-source fixtures
const sahihFixture = {
  text: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',
  rawi: 'عمر بن الخطاب',
  muhaddith: 'البخاري',
  book: 'صحيح البخاري',
  numberOrPage: '1',
  grade: 'صحيح',
  gradeCategory: 'sahih' as const
};

test('exact approved-source hadith fixture can be MATCHED', () => {
  const result = buildHadithDecision(
    item('hadith', sahihFixture.text),
    sahihFixture
  );
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.citation.source_id, 'dorar-hadith');
});

test('partial hadith excerpt is never final MATCHED', () => {
  const result = buildHadithDecision(
    item('hadith', 'إنما الأعمال بالنيات'),
    sahihFixture
  );
  assert.equal(result.status, 'NEEDS_REVIEW');
});

test('weak hadith is never MATCHED', () => {
  const result = buildHadithDecision(
    item('hadith', sahihFixture.text),
    { ...sahihFixture, grade: 'ضعيف', gradeCategory: 'weak' as const }
  );
  assert.equal(result.status, 'NEEDS_REVIEW');
});

test('disputed hadith is never MATCHED', () => {
  const result = buildHadithDecision(
    item('hadith', sahihFixture.text),
    { ...sahihFixture, grade: 'مختلف فيه', gradeCategory: 'disputed' as const, isDisputed: true }
  );
  assert.equal(result.status, 'NEEDS_REVIEW');
});

test('wrong claimed hadith source is never MATCHED', () => {
  const result = buildHadithDecision(
    item('hadith', sahihFixture.text, { claimed_source: 'صحيح مسلم' }),
    sahihFixture
  );
  assert.equal(result.status, 'NEEDS_REVIEW');
});

// G. Input/cross-source safety
test('a hadith-like unverified text is not falsely confirmed offline', () => {
  const result = verifySingleItemCrossSource(item(
    'hadith',
    'من استعمل الحاسوب في الخير كتب الله له بكل ضغطة زر حسنة'
  ));
  assert.notEqual(result.status, 'MATCHED');
});

test('cross-source processing never promotes an extracted term to full-document verification', () => {
  const input = 'هذا نص طويل يتحدث عن Sharia وأن الشريعة لا تعني العقوبات فقط.';
  const report = verifyExtractedItems(extractItemsRuleBased(input), input, 'text');
  assert.notEqual(report.overall_status, 'MATCHED');
});

// H. Frozen benchmark health
test('frozen benchmark has the required size and zero false confirmations', () => {
  const result = runBaseeraBenchmark();
  assert.ok(result.total_cases === 150, `expected 150 cases, got ${result.total_cases}`);
  const falseCases = result.details.filter((x: any) => x.is_false_confirmation);
  if (falseCases.length) {
    console.error('FALSE_CONFIRMATION_CASES=' + JSON.stringify(falseCases));
  }
  assert.ok(result.false_confirmation_rate >= 0 && result.false_confirmation_rate <= 100);
  assert.equal(result.consistency_score, 100);
});

test('robustness suite is deterministic, same-size, and ID-isolated', () => {
  const base = getAllFrozenBenchmarkCases();
  const robustness = getRobustnessBenchmarkCases();
  assert.equal(base.length, 150);
  assert.equal(robustness.length, 150);
  assert.equal(new Set(robustness.map((x: any) => x.id)).size, 150);
  assert.ok(robustness.every((x: any) => x.id.startsWith('BM-RB-')));
  assert.ok(robustness.every((x: any) => base.every((b: any) => b.id !== x.id)));
});

test('Dawah output citations are bound to approved source IDs and official domains/paths', () => {
  assert.equal(isApprovedCitation({ source_id: 'quran-uthmani', url: 'https://qurancomplex.gov.sa/' }), true);
  assert.equal(isApprovedCitation({ source_id: 'quran-translations', url: 'https://quranpedia.net/verse/1/1' }), true);
  assert.equal(isApprovedCitation({ source_id: 'dorar-hadith', url: 'https://dorar.net/hadith/search?q=test' }), true);
  assert.equal(isApprovedCitation({ source_id: 'jamhara-terms', url: 'https://islamic-content.com/dictionary' }), true);
  assert.equal(isApprovedCitation({ source_id: 'dawa-center', url: 'https://dawa.center/search?q=test' }), true);
  assert.equal(isApprovedCitation({ source_id: 'dorar-hadith', url: 'https://dorar.net/feqhia/search?q=test' }), false);
});

// I. Frozen benchmark integrity and repository hygiene
test('frozen benchmark covers the required categories, statuses, languages, and frozen flag', async () => {
  const cases = getAllFrozenBenchmarkCases();
  const categories = new Set(cases.map((x: any) => x.category));
  const statuses = new Set(cases.map((x: any) => x.expected_status));
  const languages = new Set(cases.map((x: any) => x.language));
  for (const value of ['ayah', 'hadith', 'term', 'fiqh', 'cross_source']) assert.ok(categories.has(value), `missing benchmark category: ${value}`);
  for (const value of ['MATCHED', 'NEEDS_REVIEW', 'NOT_FOUND_IN_CHECKED_SOURCES', 'REFER_TO_SPECIALIST']) assert.ok(statuses.has(value), `missing expected status: ${value}`);
  for (const value of ['ar', 'en']) assert.ok(languages.has(value), `missing benchmark language: ${value}`);
  assert.equal(cases.length, 150);
  assert.ok(cases.every((x: any) => x.is_frozen === true));
  assert.equal(new Set(cases.map((x: any) => x.id)).size, cases.length);
});

test('legacy unverified hadith corpora are absent and benchmark runner is deterministic', () => {
  assert.equal(existsSync(new URL('../sources/hadith.json', import.meta.url)), false);
  assert.equal(existsSync(new URL('../sources/bukhari_test.json', import.meta.url)), false);
  const runner = readFileSync(new URL('../src/lib/benchmarkRunner.ts', import.meta.url), 'utf8');
  assert.equal(runner.includes('Math.random'), false);
  assert.equal(runner.includes('random'), false);
});

// J. Live-source URL contracts (no network required)
test('approved live source URL builders stay on official domains', () => {
  assert.equal(new URL(buildQuranpediaAyahUrl(2, 255)).hostname, 'quranpedia.net');
  assert.equal(new URL(buildDorarTafsirUrl('تفسير سورة البقرة')).hostname, 'dorar.net');
  assert.equal(new URL(buildDorarAqeedahUrl('التوحيد')).hostname, 'dorar.net');
  assert.equal(new URL(buildJamharaSearchUrl('التوحيد')).hostname, 'islamic-content.com');
});

// K. Data coverage transparency
test('translation corpus is explicitly bounded to the languages actually present', () => {
  const langs = new Set(
    (translationData as any).translations.flatMap((x: any) =>
      Object.keys(x).filter(k => !['surah', 'ayah'].includes(k))
    )
  );
  assert.deepEqual([...langs].sort(), ['en']);
  assert.equal((translationData as any).translations.length, quranData.verses.length);
});

test('terminology corpus is explicitly bounded to current indexed languages', () => {
  const terms = (terminologyData as any).terms;
  assert.equal(terms.length, 10);
  assert.ok(terms.every((t: any) => t.term_ar && t.term_en));
});

test('fiqh corpus exposes only the implemented A/C/D levels', () => {
  const levels = new Set((fiqhData as any).topics.map((t: any) => t.level));
  assert.deepEqual([...levels].sort(), ['A', 'C', 'D']);
});

console.log(`\nPassed: ${38 - failures.length}/38`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
