import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import sourceRegistry from '../sources/source-registry.json' with { type: 'json' };

import { extractItemsRuleBased } from '../src/lib/extractor.ts';
import { verifySingleItemCrossSource } from '../src/lib/decisionEngine.ts';
import { verifyFiqhQuestion, isSensitiveFiqhQuestion } from '../src/lib/fiqhEngine.ts';
import { verifyQuranAyah, buildQuranDecision } from '../src/lib/quranVerifier.ts';
import { extractAyahRefsFromHtml } from '../src/lib/quranpediaClient.ts';
import { verifyIslamicTerm } from '../src/lib/terminologyEngine.ts';
import { buildHadithDecision } from '../src/lib/hadithVerifier.ts';
import { enforceDecisionPolicy } from '../src/lib/decisionPolicy.ts';
import { enforceApprovedCitations, isApprovedCitation, isApprovedSourceUrl } from '../src/lib/sourcePolicy.ts';
import { isGroundedInInput } from '../src/lib/inputGrounding.ts';
import { buildDorarAqeedahUrl, buildDorarTafsirUrl } from '../src/lib/dorarQueryUtils.ts';
import { buildJamharaSearchUrl } from '../src/lib/jamharaClient.ts';
import { buildQuranpediaAyahUrl, searchHafsAyahsLocal } from '../src/lib/quranpediaClient.ts';
import { getAllFrozenBenchmarkCases, getRobustnessBenchmarkCases } from '../src/lib/benchmarkData.ts';

type TestFn = () => void;
const failures: string[] = [];
let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: TestFn): void {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL  ${name}\n      ${message}`);
  }
}

function item(type: any, text: string, extra: any = {}) {
  return {
    type,
    text,
    context: text,
    language: /[A-Za-z]/.test(text) ? 'en' : 'ar',
    confidence: 1,
    ...extra
  };
}

function sourceBackedResult(type: any, status: any = 'MATCHED'): any {
  return {
    id: 'fixture',
    item: item(type, 'نص مصدرّي للاختبار'),
    status,
    status_label_ar: 'اختبار',
    status_label_en: 'test',
    reason: 'fixture',
    canonical_text: 'نص مصدرّي للاختبار',
    citation: {
      source_id: 'dorar-hadith',
      source_name: 'Dorar',
      authority: 'Dorar',
      book: 'Fixture',
      url: 'https://dorar.net/hadith/search?q=test'
    },
    decision_level: 'B'
  };
}

console.log('\n=== BASEERA SOURCE-FIRST JUDGING GATE ===\n');

// 1. Registry is identity/configuration only.
test('registry contains the required approved source identities', () => {
  const ids = new Set((sourceRegistry as any).sources.map((s: any) => s.id));
  for (const id of [
    'quran-uthmani',
    'quran-translations',
    'quran-tafsir-salaf',
    'dorar-aqeedah',
    'dorar-hadith',
    'shamela-sunnah',
    'jamhara-terms',
    'fiqh-madhahib-dorar',
    'dawa-center'
  ]) assert.ok(ids.has(id), `missing source: ${id}`);
});

test('legacy runtime knowledge files are not embedded in the repository', () => {
  for (const file of [
    '../sources/quran.json',
    '../sources/quran_translations.json',
    '../sources/terminology.json',
    '../sources/fiqh.json'
  ]) {
    assert.equal(existsSync(new URL(file, import.meta.url)), false, `legacy local knowledge file still exists: ${file}`);
  }
});

test('fiqh source client contains no hard-coded article IDs', () => {
  const ts = readFileSync(new URL('../src/lib/dorarClient.ts', import.meta.url), 'utf8');
  const py = readFileSync(new URL('../src/lib/dorar_feqhia.py', import.meta.url), 'utf8');
  for (const text of [ts, py]) {
    assert.equal(/feqhia\/218|feqhia\/240|CANONICAL_FIQH_SECTION_ANCHORS/.test(text), false);
  }
});

test('terminology verifier has no local terminology import', () => {
  const text = readFileSync(new URL('../src/lib/terminologyEngine.ts', import.meta.url), 'utf8');
  assert.equal(text.includes('sources/terminology.json'), false);
});

test('single common Quran word does not become a fuzzy match', () => {
  const rows = searchHafsAyahsLocal('الله', 5);
  assert.equal(rows.length, 0);
});

test('deterministic Hafs source resolves the canonical 2:255 quotation', () => {
  const rows = searchHafsAyahsLocal('مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ', 5);
  assert.ok(rows.some(row => Number(row.surah) === 2 && row.number === 255));
});

// 2. Dynamic source contracts.
test('source URL policy accepts only approved source domains', () => {
  assert.equal(isApprovedSourceUrl('https://dorar.net/hadith/search?q=test'), true);
  assert.equal(isApprovedSourceUrl('https://quranpedia.net/verse/1/1'), true);
  assert.equal(isApprovedSourceUrl('https://islamic-content.com/dictionary/word/1817'), true);
  assert.equal(isApprovedSourceUrl('https://example.com/fake'), false);
});

test('source policy binds source IDs to source-specific paths', () => {
  assert.equal(isApprovedCitation({
    source_id: 'dorar-hadith',
    url: 'https://dorar.net/hadith/search?q=test'
  }), true);
  assert.equal(isApprovedCitation({
    source_id: 'dorar-hadith',
    url: 'https://dorar.net/feqhia/search?q=test'
  }), false);
  assert.equal(isApprovedCitation({
    source_id: 'quran-uthmani',
    url: 'https://quranpedia.net/verse/2/255'
  }), true);
});

test('live URL builders remain source-specific', () => {
  assert.equal(new URL(buildQuranpediaAyahUrl(2, 255)).hostname, 'quranpedia.net');
  assert.equal(new URL(buildDorarTafsirUrl('تفسير سورة البقرة')).hostname, 'dorar.net');
  assert.equal(new URL(buildDorarAqeedahUrl('التوحيد')).hostname, 'dorar.net');
  assert.equal(new URL(buildJamharaSearchUrl('التوحيد')).hostname, 'islamic-content.com');
});

// 3. AI boundary and grounding.
test('LLM extraction cannot introduce text absent from the input', () => {
  assert.equal(isGroundedInInput('الحمد لله رب العالمين', 'قال تعالى: الحمد لله رب العالمين'), true);
  assert.equal(isGroundedInInput('نص لم يذكره المستخدم', 'قال تعالى: الحمد لله رب العالمين'), false);
});

test('AI cannot turn an unverified candidate into MATCHED', () => {
  const result = sourceBackedResult('term', 'MATCHED');
  const decision = enforceDecisionPolicy({ result, sourceEvidenceValidated: false });
  assert.equal(decision.allowed, false);
  assert.equal(decision.status, 'NOT_FOUND_IN_CHECKED_SOURCES');
});

test('MATCHED requires source evidence and a valid source-specific URL', () => {
  const result = sourceBackedResult('hadith', 'MATCHED');

  const valid = enforceDecisionPolicy({ result, sourceEvidenceValidated: true });
  assert.equal(valid.allowed, true);
  assert.equal(valid.status, 'MATCHED');

  const noUrl = { ...result, citation: { ...result.citation, url: undefined } };
  const rejected = enforceDecisionPolicy({ result: noUrl, sourceEvidenceValidated: true });
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.status, 'NOT_FOUND_IN_CHECKED_SOURCES');
});

test('citation enforcement is fail-closed', () => {
  const report: any = {
    overall_status: 'MATCHED',
    verifications: [{
      status: 'MATCHED',
      canonical_text: 'evidence',
      citation: { source_id: 'dorar-hadith', url: 'https://quranpedia.net/verse/1/1' }
    }]
  };
  enforceApprovedCitations(report);
  assert.equal(report.verifications[0].status, 'NEEDS_REVIEW');
  assert.equal('canonical_text' in report.verifications[0], false);
});

// 4. Safety routing.
test('sensitive fiqh input is referral-only', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'ما حكم سب الدين؟'));
  assert.equal(isSensitiveFiqhQuestion('ما حكم سب الدين؟'), true);
  assert.equal(result.status, 'REFER_TO_SPECIALIST');
  assert.equal(result.decision_level, 'D');
});

test('personal legal/family fiqh questions are referral-only', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'حلفت على زوجتي بالطلاق فهل وقع طلاقي؟'));
  assert.equal(result.status, 'REFER_TO_SPECIALIST');
});

test('fiqh can never be autonomously MATCHED', () => {
  const result = sourceBackedResult('fiqh_question', 'MATCHED');
  const decision = enforceDecisionPolicy({ result, sourceEvidenceValidated: true });
  assert.equal(decision.status, 'NEEDS_REVIEW');
  assert.equal(decision.allowed, false);
});

test('tafsir and aqeedah cannot be autonomously MATCHED', () => {
  for (const type of ['tafsir_question', 'aqeedah_question']) {
    const result = sourceBackedResult(type, 'MATCHED');
    const decision = enforceDecisionPolicy({ result, sourceEvidenceValidated: true });
    assert.equal(decision.status, 'NEEDS_REVIEW');
    assert.equal(decision.allowed, false);
  }
});

// 5. Runtime verifier entrypoints fail closed before live resolution.
test('Quran verifier never produces MATCHED from local state', () => {
  const result = verifyQuranAyah(item('ayah', 'الحمد لله رب العالمين', { claimed_surah: 'الفاتحة' }));
  assert.notEqual(result.status, 'MATCHED');
  assert.equal((result as any)._needs_live_search, true);
});

test('Quranpedia search parser keeps the canonical ayah reference when HTML uses surah links', () => {
  const html = '<a href="/surah/2/al-baqara?ayah_id=255">من ذا الذي يشفع عنده</a>';
  assert.deepEqual(extractAyahRefsFromHtml(html), [{ surah: 2, ayah: 255 }]);
});

test('partial Quran quotation is matched against the canonical source text', () => {
  const result = buildQuranDecision(
    item('ayah', 'من ذا الذي يشفع عنده'),
    {
      id: 'quran-2-255',
      source: 'quran-uthmani',
      title: 'سورة البقرة — الآية 255',
      text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ',
      surah_number: 2,
      ayah_number: 255,
      surah_name_ar: 'البقرة',
      text_uthmani: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ'
    }
  );
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.canonical_ayah_number, 255);
  assert.equal(result.canonical_surah, 'البقرة');
});

test('term verifier never produces MATCHED from local state', () => {
  const result = verifyIslamicTerm(item('term', 'التوحيد'));
  assert.notEqual(result.status, 'MATCHED');
  assert.equal((result as any)._needs_live_search, true);
});

test('explicit fiqh question always enters the live-source path', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'ما حكم نقض الوضوء بلمس المرأة الأجنبية؟'));
  assert.equal((result as any)._needs_live_search, true);
});

test('cross-source engine does not route vague general claims into Fiqh', () => {
  const result = verifySingleItemCrossSource(item('claim', 'مسألة خلافية'));
  assert.notEqual(result.item.type, 'fiqh_question');
  assert.notEqual(result.citation?.source_id, 'fiqh-madhahib-dorar');
  assert.equal((result as any)._needs_live_search, true);
});

test('vague explicit Fiqh questions are rejected before source ranking', () => {
  const result = verifyFiqhQuestion(item('fiqh_question', 'ما حكم هذه المسألة؟'));
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.equal((result as any)._needs_live_search, undefined);
  assert.match(result.reason, /غير محدد/);
});

test('cross-source engine does not falsely certify unverified hadith-like text offline', () => {
  const result = verifySingleItemCrossSource(item('hadith', 'من استعمل الحاسوب في الخير كتب الله له بكل ضغطة زر حسنة'));
  assert.notEqual(result.status, 'MATCHED');
});

// 6. Frozen benchmark is test data, not authority.
test('frozen benchmark remains isolated from runtime source knowledge', () => {
  const base = getAllFrozenBenchmarkCases();
  const robustness = getRobustnessBenchmarkCases();
  assert.equal(base.length, 150);
  assert.equal(robustness.length, 150);
  assert.equal(new Set(base.map((x: any) => x.id)).size, 150);
  assert.equal(new Set(robustness.map((x: any) => x.id)).size, 150);
  assert.ok(base.every((x: any) => x.is_frozen === true));
});

// 7. Hadith policy tests with explicit source fixtures.
const sahihFixture = {
  text: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',
  rawi: 'عمر بن الخطاب',
  muhaddith: 'البخاري',
  book: 'صحيح البخاري',
  numberOrPage: 'fixture',
  grade: 'صحيح',
  gradeCategory: 'sahih' as const
};

test('verified hadith fixture can be MATCHED only after source evidence exists', () => {
  const result = buildHadithDecision(item('hadith', sahihFixture.text), sahihFixture);
  const decision = enforceDecisionPolicy({ result, sourceEvidenceValidated: true });
  assert.equal(decision.status, 'MATCHED');
});

test('partial, weak, disputed and wrongly attributed hadiths stay review-only', () => {
  const partial = buildHadithDecision(item('hadith', 'إنما الأعمال بالنيات'), sahihFixture);
  assert.equal(partial.status, 'NEEDS_REVIEW');

  const weak = buildHadithDecision(
    item('hadith', sahihFixture.text),
    { ...sahihFixture, grade: 'ضعيف', gradeCategory: 'weak' as const }
  );
  assert.equal(weak.status, 'NEEDS_REVIEW');

  const disputed = buildHadithDecision(
    item('hadith', sahihFixture.text),
    { ...sahihFixture, grade: 'مختلف فيه', gradeCategory: 'disputed' as const }
  );
  assert.equal(disputed.status, 'NEEDS_REVIEW');

  const wrongBook = buildHadithDecision(
    item('hadith', sahihFixture.text, { claimed_source: 'صحيح مسلم' }),
    sahihFixture
  );
  assert.equal(wrongBook.status, 'NEEDS_REVIEW');
});

// 8. Keep benchmark fixtures clearly separated from production source retrieval.
test('benchmark code labels fixtures as fixtures and contains no randomization', () => {
  const runner = readFileSync(new URL('../src/lib/benchmarkRunner.ts', import.meta.url), 'utf8');
  assert.equal(runner.includes('Math.random'), false);
  assert.equal(runner.includes('random'), false);
  assert.ok(runner.includes('fixture'));
});

console.log(`\nPassed: ${passedTests}/${totalTests}`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('JUDGING_GATE_PASS');
