/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import sourceRegistry from './sources/source-registry.json' with { type: 'json' };

import { extractItemsRuleBased } from './src/lib/extractor.ts';
import { verifyExtractedItems } from './src/lib/decisionEngine.ts';
import { isSensitiveFiqhQuestion } from './src/lib/fiqhEngine.ts';
import { enforceApprovedCitations, isApprovedCitation } from './src/lib/sourcePolicy.ts';
import { enforceDecisionPolicy } from './src/lib/decisionPolicy.ts';
import { isGroundedInInput } from './src/lib/inputGrounding.ts';
import { getAvailableTranslationLanguages, getAyahTranslations, getHafsAyah, findExactHafsAyahLocal, searchHafsAyahsLocal, getHafsSurahName, buildQuranpediaAyahUrl } from './src/lib/quranpediaClient.ts';
import { searchDorarAqeedahLive, searchDorarTafsirLive } from './src/lib/dorarEncyclopediaClient.ts';
import { buildDorarAqeedahUrl, buildDorarTafsirUrl } from './src/lib/dorarQueryUtils.ts';
import { buildJamharaSearchUrl, searchJamharaLive } from './src/lib/jamharaClient.ts';
import { buildHadithDecision } from './src/lib/hadithVerifier.ts';
import { normalizeArabic, normalizeArabicStrict, locateQuoteWindow, computeWordDiff } from './src/lib/normalizer.ts';
import { getComparativeBenchmarkResults } from './src/lib/benchmarkRunner.ts';
import { searchDorarApiLive, searchDorarWithSmartQueries, searchDorarFiqhLive, fetchDorarFiqhArticleLive, fetchDorarFiqhArticleDetailedLive, buildDorarFiqhUrl, cleanSearchQuery, generateSearchQueries, classifySourceTier } from './src/lib/dorarClient.ts';
import { generateDawahContent, formatContentAsText, generateInfographicSvg, DawahContentRequest } from './src/lib/dawahGenerator.ts';
import { ExtractedItem } from './src/types/baseera.ts';
import { fetchRemoteSafely, readTextWithLimit, readBytesWithLimit } from './src/lib/safeRemoteFetch.ts';
import { getQuranCandidatesForAI, buildQuranDecision, QuranCandidate } from './src/lib/quranVerifier.ts';
import { rankCandidatesWithAI, generateFiqhSearchQueriesWithAI, generateSourceSearchQueriesWithAI, generateQuranReferenceCandidatesWithAI, understandQuestionWithAI, judgeFiqhTopicRelevance, answerFiqhFromSources } from './src/lib/aiMatcher.ts';
import { groqChat, groqVisionText, groqTranscribe, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from './src/lib/groqClient.ts';
import { alignClaimWithEvidence } from './src/lib/evidenceAlignment.ts';
import { getIslamicContentMcpStatus, callIslamicContentTool, searchIslamicContent, fetchIslamicContent } from './src/lib/islamicContentMcpClient.ts';
import { verifyHadithWithHadeethEnc } from './src/lib/hadeethencVerify.ts';

dotenv.config();
const BASEERA_SERVER_VERSION = 'baseera-2026-10-06-quran-excerpt-fix';
console.log('[BASEERA][BOOT]', JSON.stringify({ version: BASEERA_SERVER_VERSION, cwd: process.cwd(), node: process.version, platform: process.platform, groq_key_configured: Boolean(process.env.GROQ_API_KEY?.trim()) }));

const __filename = fileURLToPath(import.meta.url);
process.on('uncaughtException', (err) => {
  console.error('[Baseera Server Error]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Baseera Unhandled Rejection]', reason);
});

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable CORS for Chrome Extension and all local/external clients
app.use((req, res, next) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => { res.setHeader('X-Baseera-Server-Version', BASEERA_SERVER_VERSION); next(); });

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Groq AI is configured server-side. Secrets are never accepted from request bodies.
const aiEnabled = Boolean(process.env.GROQ_API_KEY?.trim());

// AI readiness — exposes provider/model state only; never exposes the API key.
app.get('/api/ai-status', (_req, res) => {
  console.log('[BASEERA][AI_STATUS]', JSON.stringify({ version: BASEERA_SERVER_VERSION, groq_key_configured: aiEnabled, cwd: process.cwd() }));
  res.json({
    enabled: aiEnabled,
    provider: 'groq',
    text_model: GROQ_TEXT_MODEL,
    vision_model: GROQ_VISION_MODEL,
    audio_model: 'whisper-large-v3-turbo',
    key_source: 'server_environment',
    server_version: BASEERA_SERVER_VERSION,
    cwd: process.cwd()
  });
});

// 1. Source Registry API
app.get('/api/sources', (_req, res) => {
  res.json({
    registry: sourceRegistry,
    stats: {
      hadith_verification_mode: 'live_dorar_only',
      active_verification_source_ids: [
        'quran-uthmani',
        'quran-translations',
        'quran-tafsir-salaf',
        'dorar-aqeedah',
        'dorar-hadith',
        'jamhara-terms',
        'fiqh-madhahib-dorar'
      ],
      registry_only_source_ids: [
        'shamela-sunnah'
      ],
      supplemental_source_ids: ['dawa-center'],
      coverage_note: 'المحتوى الديني السلطوي لا يعتمد على قواعد معرفة محلية: القرآن والترجمات من Quranpedia API، الحديث والفقه والتفسير والعقيدة من مسارات المصدر المعتمدة، والمصطلحات من الجمهرة الحية.'
    }
  });
});

async function applyAISemanticMatching(items: ExtractedItem[]): Promise<void> {
  // AI only ranks candidates already retrieved from the approved live source.
  // It never supplies source text, citation, or ruling.
  for (const item of items) {
    if (item.type !== 'ayah') continue;

    let candidates;
    try {
      candidates = await getQuranCandidatesForAI(item, 12);
    } catch (error) {
      console.warn('[BASEERA][AI][QURAN_CANDIDATES][ERROR]', error);
      continue;
    }

    if (candidates.length === 0) continue;

    const strictInput = normalizeArabicStrict(item.text);
    const looseInput = normalizeArabic(item.text);
    const hasStrongSourceMatch = candidates.some(candidate => {
      const strictCandidate = normalizeArabicStrict(candidate.text);
      const looseCandidate = normalizeArabic(candidate.text);
      return strictCandidate === strictInput ||
        (looseInput.length >= 4 && looseCandidate.includes(looseInput));
    });

    if (hasStrongSourceMatch) continue;

    const ai = await rankCandidatesWithAI(
      'quran',
      item.text,
      candidates.map(c => ({
        id: c.id,
        source: c.source,
        title: c.title,
        text: c.text
      }))
    );

    if (!ai || !ai.candidate_id || ai.confidence < 0.55 || ai.relation === 'none') continue;

    const selected = candidates.find(c => c.id === ai.candidate_id);
    if (!selected) continue;

    (item as any).ai_match_hint = {
      candidate_id: ai.candidate_id,
      relation: ai.relation,
      confidence: ai.confidence,
      source_text: selected.text
    };
  }
}

/**
 * Master Verification Resolver with Live Dorar Encyclopedia Search
 * Unified across both Web Application (/api/verify) and Browser Extension (/api/extension-lookup)
 */
async function resolveVerificationWithLiveSearch(v: any, fullContext: string = ''): Promise<void> {
  const r = v as typeof v & { _needs_live_search?: boolean; _content_words?: string[]; _fiqh_url?: string };
  if (!r._needs_live_search) return;

  const queryToSearch = v.item.text.trim();
  // Source-grounded passages collected during Fiqh retrieval, used to synthesise
  // a direct answer (Dorar fiqh + approved library via MCP + any source text).
  let fiqhPassages: Array<{ source: string; title: string; text: string; url?: string }> = [];
  const isFiqhQuestion = v.item.type === 'fiqh_question' || (
    v.item.type === 'claim' &&
    /(?:حلال|حرام|يحرم|تحريم|يجوز|لا يجوز|يصح|لا يصح|واجب|فرض|مكروه|مستحب|حكم|أحكام|المسح|خف|خفين|شرب الخمر|الربا|صلاة|زكاة|صيام|طهارة|وضوء|غسل|تيمم|طلاق|نكاح|أشربة|يمكن\s+.+\s+لمدة)/i.test(queryToSearch)
  );
  const isTafsirQuestion = v.item.type === 'tafsir_question';
  const isAqeedahQuestion = v.item.type === 'aqeedah_question';

  try {
    // ── QURAN PATH: live Quranpedia source is authoritative ────────────────
    if (v.item.type === 'ayah') {
      let candidates: QuranCandidate[] = [];
      let sourceFetchFailed = false;

      // HARD SOURCE-FIRST PATH:
      // Resolve exact/normalized text directly against the bundled Hafs
      // source snapshot before touching remote search or AI. This guarantees
      // that a valid Quran verse is not reported as "not found" merely because
      // Quranpedia's web search endpoint is unavailable or returns HTML without
      // machine-readable verse references.
      try {
        const exactLocal = findExactHafsAyahLocal(queryToSearch);
        const localMatches = exactLocal ? [exactLocal] : searchHafsAyahsLocal(queryToSearch, 12);
        candidates = localMatches.map(ayah => {
          const surahNumber = Number(ayah.surah);
          const ayahNumber = Number(ayah.number);
          const surahName = getHafsSurahName(surahNumber);
          return {
            id: `quran-${surahNumber}-${ayahNumber}`,
            source: 'quran-uthmani' as const,
            title: `سورة ${surahName} — الآية ${ayahNumber}`,
            text: ayah.text,
            search: ayah.search || ayah.text,
            surah_number: surahNumber,
            ayah_number: ayahNumber,
            surah_name_ar: surahName,
            text_uthmani: ayah.text
          };
        });
      } catch (error: any) {
        console.warn('[BASEERA][QURAN][LOCAL_DISCOVERY_ERROR]', error?.message || String(error));
      }

      if (candidates.length === 0) {
        try {
          candidates = await getQuranCandidatesForAI(v.item, 12);
        } catch (error: any) {
          sourceFetchFailed = true;
          console.warn('[BASEERA][QURAN][DISCOVERY_UNAVAILABLE]', error?.message || String(error));
        }
      }

      // Search is only candidate discovery. When discovery is unavailable or
      // returns nothing, the AI may suggest references, but every reference
      // is fetched from the canonical Hafs endpoint before it can be accepted.
      if (candidates.length === 0 && aiEnabled) {
        const refs = await generateQuranReferenceCandidatesWithAI(queryToSearch);
        const hinted = await (await import('./src/lib/quranVerifier.ts')).getQuranCandidatesFromReferences(refs);
        if (hinted.length > 0) {
          candidates = hinted;
          sourceFetchFailed = false;
        }
      }

      let selected: QuranCandidate | undefined;

      const strictInput = normalizeArabicStrict(queryToSearch);
      const looseInput = normalizeArabic(queryToSearch);
      // Choose the verse whose canonical text actually CONTAINS the input, using
      // edit-distance windowing (tolerant of minor orthographic differences such
      // as the trailing alef in «مباركا»). Among such verses, prefer the shortest
      // (most specific) — this is what previously matched «كتاب أنزلناه إليك
      // مباركا» (ص 38:29) to إبراهيم 14:1 and reported a false wording difference.
      const windowed = candidates
        .map(candidate => ({ candidate, win: locateQuoteWindow(queryToSearch, candidate.text) }))
        .filter(x => x.win !== null)
        .sort((a, b) =>
          (b.win!.score - a.win!.score) ||
          (normalizeArabic(a.candidate.text).length - normalizeArabic(b.candidate.text).length)
        );

      selected = windowed[0]?.candidate || candidates.find(candidate => {
        const strictCandidate = normalizeArabicStrict(candidate.text);
        const looseCandidate = normalizeArabic(candidate.text);
        const strictSearch = candidate.search ? normalizeArabicStrict(candidate.search) : '';
        const looseSearch = candidate.search ? normalizeArabic(candidate.search) : '';
        return strictCandidate === strictInput ||
          strictSearch === strictInput ||
          (looseInput.length >= 4 && (looseCandidate.includes(looseInput) || looseSearch.includes(looseInput)));
      });

      const hintId = (v.item as any).ai_match_hint?.candidate_id as string | undefined;
      if (!selected && hintId) {
        selected = candidates.find(c => c.id === hintId);
      }

      if (!selected && candidates.length > 0) {
        if (aiEnabled) {
          const aiCandidates = candidates.map(c => ({
            id: c.id,
            source: c.source,
            title: c.title,
            text: c.text
          }));
          const ai = await rankCandidatesWithAI('quran', queryToSearch, aiCandidates);
          if (ai?.candidate_id && ai.confidence >= 0.55 && ai.relation !== 'none') {
            selected = candidates.find(c => c.id === ai.candidate_id);
            if (selected) {
              v.ai_match = {
                provider: 'groq',
                candidate_id: ai.candidate_id,
                relation: ai.relation,
                confidence: ai.confidence
              };
            }
          }
        }
        selected = selected || candidates[0];
      }

      if (selected) {
        // Populate the canonical surah name from the source candidate; citations use the canonical verse URL.
        // The final decision is based only on the source-returned canonical text.
        const quranDecision = buildQuranDecision(v.item, selected);
        if (quranDecision.status !== 'NOT_FOUND_IN_CHECKED_SOURCES') {
          Object.assign(v, quranDecision);
          delete r._needs_live_search;
          return;
        }
      }

      // A user-selected Quran check is hard-scoped to the Quran source.
      // Never reinterpret the same input as a hadith or another category.
      if (v.item.verification_scope === 'quran') {
        if (sourceFetchFailed) {
          v.status = 'NEEDS_REVIEW';
          v.status_label_ar = 'تعذر التحقق الآن';
          v.status_label_en = 'Verification Temporarily Unavailable';
          v.reason = 'تعذر الوصول إلى المصحف المعتمد لإكمال الفحص.';
          v.citation = {
            source_id: 'quran-uthmani',
            source_name: 'المصحف الشريف — النص الحفصي المعتمد',
            authority: 'مجمع الملك فهد / Quranpedia',
            url: 'https://quranpedia.net/'
          };
        } else {
          v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
          v.status_label_ar = 'لم يُعثر على تطابق في المصحف';
          v.status_label_en = 'No Match Found in the Quran';
          v.reason = 'لم يُعثر على تطابق للنص في المصحف المعتمد.';
          v.citation = {
            source_id: 'quran-uthmani',
            source_name: 'المصحف الشريف — النص الحفصي المعتمد',
            authority: 'مجمع الملك فهد / Quranpedia',
            url: 'https://quranpedia.net/'
          };
        }
        delete r._needs_live_search;
        return;
      }
    }

    if (v.item.type === 'hadith') {
      // Preferred source: the approved HadeethEnc encyclopedia (via the
      // islamic-content MCP). It returns the canonical matn with its grade,
      // attribution and a REAL permalink (hadeethenc.com/ar/browse/hadith/<id>).
      // When it yields a verified match it is authoritative and the Dorar
      // fallback is skipped.
      const heResult = await verifyHadithWithHadeethEnc(v.item).catch(() => null);
      if (heResult && heResult.status === 'MATCHED') {
        Object.assign(v, heResult);
        delete r._needs_live_search;
        return;
      }

      const queries = [...new Set([queryToSearch, ...generateSearchQueries(queryToSearch)])].slice(0, 5);
      const collected = new Map<string, any>();

      for (const query of queries) {
        const rows = await searchDorarApiLive(query);
        for (const row of rows) {
          const key = `${row.text}::${row.book}::${row.numberOrPage}`;
          if (!collected.has(key)) collected.set(key, row);
        }
      }

      const candidates = Array.from(collected.values());
      const strictInput = normalizeArabicStrict(queryToSearch);
      const looseInput = normalizeArabic(queryToSearch);

      const scoreCandidate = (row: any): number => {
        let score = 0;
        const strictRow = normalizeArabicStrict(String(row.text || '').replace(/\[.*?\]/g, ' '));
        const looseRow = normalizeArabic(String(row.text || '').replace(/\[.*?\]/g, ' '));

        // 1. Text match quality
        const isExactStrict = strictRow === strictInput;
        const isExactLoose = looseRow === looseInput;
        const startsStrict = strictRow.startsWith(strictInput) || strictInput.startsWith(strictRow);
        const includesStrict = strictRow.includes(strictInput);
        const includesLoose = looseInput.length >= 4 && looseRow.includes(looseInput);

        if (isExactStrict) score += 3000;
        else if (isExactLoose) score += 2500;
        else if (startsStrict) score += 2000;
        else if (includesStrict) score += 1500;
        else if (includesLoose) score += 1000;
        else {
          const inputWords = looseInput.split(/\s+/).filter((w: string) => w.length >= 3);
          const rowWords = looseRow.split(/\s+/).filter((w: string) => w.length >= 3);
          if (inputWords.length > 0) {
            const matches = inputWords.filter((w: string) => rowWords.some((rw: string) => rw === w || rw.includes(w))).length;
            const overlap = matches / inputWords.length;
            if (overlap >= 0.6) score += Math.round(overlap * 800);
          }
        }

        if (score === 0) return -10000;

        // Exact narration variant boost: prioritize candidates with NO substantive word differences (e.g. بالنيات vs بالنية)
        const diffCheck = computeWordDiff(queryToSearch, String(row.text || ''));
        const hasNoSubstantiveChange = !diffCheck.diff.some(
          (d: any) => d.type === 'missing' ||
               d.type === 'added' ||
               (d.type === 'changed' && normalizeArabic(d.word) !== normalizeArabic(d.expected || ''))
        );
        if (hasNoSubstantiveChange) {
          score += 4000;
        }

        // 2. Hadith authenticity & grade quality
        const cat = row.gradeCategory;
        const gradeText = String(row.grade || '');
        if (cat === 'sahih') score += 1500;
        else if (cat === 'hasan') score += 1000;
        else if (cat === 'disputed') score += 200;
        else if (cat === 'weak') score -= 800;
        else if (cat === 'fabricated') score -= 1500;

        if (/صحيح|المجمع على صحته|مجمع على صحته|مشهور بالصحة|متفق عليه|رواية صحيحة|صحاح الأحاديث/i.test(gradeText)) {
          score += 500;
        }

        if (/خطأ|أخطأ|وهم|لا يصح|منكر|معلول/i.test(gradeText)) {
          score -= 1000;
        }

        // 3. Canonical primary books boost
        const book = String(row.book || '');
        if (/صحيح البخاري|صحيح مسلم/i.test(book)) {
          score += 800;
        } else if (/الترمذي|أبي داود|ابي داود|النسائي|ابن ماجه|موطأ|مسند أحمد/i.test(book)) {
          score += 400;
        } else if (/ابن حبان|ابن خزيمة|مستدرك الحاكم/i.test(book)) {
          score += 200;
        }

        // 4. Claimed source match boost
        if (v.item.claimed_source) {
          const claim = normalizeArabic(v.item.claimed_source);
          const normBook = normalizeArabic(book);
          const normRawi = normalizeArabic(String(row.rawi || ''));
          if (normBook.includes(claim) || claim.includes(normBook) || normRawi.includes(claim)) {
            score += 1500;
          }
        }

        return score;
      };

      const scoredCandidates = candidates
        .map(row => ({ row, score: scoreCandidate(row) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      let selected = scoredCandidates.length > 0 ? scoredCandidates[0].row : undefined;

      if (!selected && aiEnabled && candidates.length > 0) {
        const ai = await rankCandidatesWithAI(
          'hadith',
          queryToSearch,
          candidates.slice(0, 8).map((row, index) => ({
            id: `hadith-${index}`,
            source: 'dorar-hadith',
            title: row.book,
            text: row.text
          }))
        );

        if (ai?.candidate_id && ai.confidence >= 0.55 && ai.relation !== 'none') {
          const index = Number(ai.candidate_id.replace('hadith-', ''));
          if (Number.isInteger(index) && candidates[index]) {
            selected = candidates[index];
            v.ai_match = {
              provider: 'groq',
              candidate_id: ai.candidate_id,
              relation: ai.relation,
              confidence: ai.confidence
            };
          }
        }
      }

      if (selected) {
        const decision = buildHadithDecision(v.item, selected);
        Object.assign(v, decision);
      } else if (heResult) {
        // Dorar yielded nothing usable: surface the approved encyclopedia's
        // closest result (still gated by the decision policy).
        Object.assign(v, heResult);
      } else {
        v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
        v.status_label_ar = 'لم يُعثر عليه';
        v.status_label_en = 'Not Found in Checked Sources';
        v.reason = 'لم يُعثر على تطابق موثوق في الموسوعة الحديثية المفحوصة.';
        v.citation = {
          source_id: 'dorar-hadith',
          source_name: 'الموسوعة الحديثية — الدرر السنية',
          authority: 'مؤسسة الدرر السنية للإشراف العلمي'
          // No URL: a search URL is never a source. A permalink is only emitted
          // when a genuine /h/<id> page exists.
        };
        v.decision_level = 'B';
      }

      delete r._needs_live_search;
      return;
    }

    if (isTafsirQuestion || isAqeedahQuestion) {
      const isAqeedah = isAqeedahQuestion;
      const cleanQ = cleanSearchQuery(queryToSearch);
      const queryForSearch = cleanQ && cleanQ.length >= 2 ? cleanQ : queryToSearch;

      let found = isAqeedah
        ? await searchDorarAqeedahLive(queryForSearch)
        : await searchDorarTafsirLive(queryForSearch);

      if (!found?.found && queryForSearch !== queryToSearch) {
        found = isAqeedah
          ? await searchDorarAqeedahLive(queryToSearch)
          : await searchDorarTafsirLive(queryToSearch);
      }

      // Check if there is an exact or related verse in the verified Hafs Quran
      let matchedAyah: any = undefined;
      if (!isAqeedah) {
        const surahMatch = found?.url?.match(/\/tafseer\/(\d+)\//);
        const surahNum = surahMatch ? parseInt(surahMatch[1], 10) : undefined;

        const contentWords = (cleanQ || queryToSearch)
          .split(/\s+/)
          .filter((w: string) => w.length >= 3 && !['الله', 'تعالى', 'القرآن', 'الكريم', 'سورة', 'آية', 'الذي', 'التي'].includes(w));
        const keyQuery = contentWords.slice(0, 3).join(' ');

        const verseCandidates = searchHafsAyahsLocal(keyQuery || cleanQ || queryToSearch, 30);
        if (verseCandidates.length > 0) {
          if (surahNum) {
            matchedAyah = verseCandidates.find(c => c.surah === surahNum);
          }
          if (!matchedAyah) {
            matchedAyah = verseCandidates[0];
          }
        }
      }

      const fallbackUrl = isAqeedah ? buildDorarAqeedahUrl(queryToSearch) : buildDorarTafsirUrl(queryToSearch);
      const sourceId = isAqeedah ? 'dorar-aqeedah' : 'quran-tafsir-salaf';
      const sourceName = isAqeedah
        ? 'الموسوعة العقدية — الدرر السنية'
        : 'موسوعة التفسير — الدرر السنية';

      if (found?.found) {
        v.status = 'NEEDS_REVIEW';
        v.status_label_ar = isAqeedah
          ? 'مادة عقدية من مصدر معتمد — تحتاج مراجعة'
          : 'تفسير موثق من المصدر المعتمد';
        v.status_label_en = isAqeedah
          ? 'Approved Aqeedah Source Found — Review Required'
          : 'Approved Tafsir Source Found';
        
        const surahName = matchedAyah ? (matchedAyah.surah_name_ar || getHafsSurahName(matchedAyah.surah)) : '';
        v.reason = matchedAyah
          ? `تم العثور على الآية الكريمة: سورة ${surahName} (الآية ${matchedAyah.number}) «${matchedAyah.text}»، مع بيان تفسيرها المعتمد في ${sourceName} («${found.title}»). يُعرض التفسير كمحتوى مرجعي فقط دون اجتهاد مستقل.`
          : `تم العثور على مادة مصدرية في ${sourceName} («${found.title}»). تُعرض المادة كمحتوى مرجعي فقط؛ لا تنشئ بصيرة تفسيراً أو حكماً عقدياً مستقلاً ولا تختار قولاً من خارج المصدر.`;
        
        v.canonical_text = found.text || found.title;
        v.decision_level = 'B';
        v.citation = {
          source_id: sourceId,
          source_name: sourceName,
          authority: 'منصة الدرر السنية',
          book: matchedAyah ? `سورة ${surahName} (الآية ${matchedAyah.number}) — ${found.title}` : found.title,
          url: found.url
        };
      } else {
        v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
        v.status_label_ar = 'لم يُعثر عليه في المرجع المعتمد المفحوص';
        v.status_label_en = 'Not Found in Checked Approved Source';
        v.reason = `لم يُعثر على مادة مطابقة في ${sourceName}. لا تُنشئ بصيرة بديلاً مولداً من النموذج، ويمكن مراجعة صفحة المصدر مباشرة.`;
        v.citation = {
          source_id: sourceId,
          source_name: sourceName,
          authority: 'منصة الدرر السنية',
          url: fallbackUrl
        };
        v.decision_level = 'B';
      }

      delete r._needs_live_search;
      return;
    }

    if (v.item.type === 'term') {
      const queries = aiEnabled
        ? await generateSourceSearchQueriesWithAI('terminology', queryToSearch)
        : [];

      const collected = new Map<string, { title: string; text: string; url: string; source: string }>();
      const searchQueries = [...new Set([queryToSearch, ...queries])].slice(0, 6);

      for (const query of searchQueries) {
        const found = await searchJamharaLive(query);
        if (!found?.found) continue;
        const key = found.url || `${found.title}::${found.text.slice(0, 120)}`;
        if (!collected.has(key)) collected.set(key, found);
      }

      const candidates = Array.from(collected.values()).map((row, index) => ({
        id: `term-${index}`,
        source: 'jamhara-terms',
        title: row.title,
        text: row.text,
        row
      }));

      const normQueryTerm = normalizeArabic(queryToSearch).replace(/^(?:ال|و)/, '').trim();
      const isMatchingTermCandidate = (c: { title: string; text: string }) => {
        const normCandTitle = normalizeArabic(c.title).replace(/^(?:ال|و)/, '').trim();
        return (
          normCandTitle === normQueryTerm ||
          normCandTitle.startsWith(normQueryTerm) ||
          normQueryTerm.startsWith(normCandTitle) ||
          normCandTitle.includes(normQueryTerm)
        );
      };

      const validCandidates = candidates.filter(c => isMatchingTermCandidate(c) && c.text && c.text.length >= 30);

      let selected = validCandidates[0];
      if (selected && aiEnabled && validCandidates.length > 1) {
        const ai = await rankCandidatesWithAI(
          'terminology',
          queryToSearch,
          validCandidates.map(({ id, source, title, text }) => ({ id, source, title, text }))
        );
        if (ai?.candidate_id && ai.confidence >= 0.55 && ai.relation !== 'none') {
          selected = validCandidates.find(c => c.id === ai.candidate_id) || selected;
          v.ai_match = {
            provider: 'groq',
            candidate_id: ai.candidate_id,
            relation: ai.relation,
            confidence: ai.confidence
          };
        }
      }

      if (selected) {
        v.status = 'NEEDS_REVIEW';
        v.status_label_ar = 'مادة مصدرية من الجمهرة — تحتاج مراجعة';
        v.status_label_en = 'Approved Jamhara Source Found — Review Required';
        v.reason = 'تم العثور على مادة في المصدر المعتمد. لا ينشئ النموذج تعريفًا أو حكمًا من معرفته الخاصة.';
        v.canonical_text = selected.row.text || selected.row.title;
        v.decision_level = 'B';
        v.citation = {
          source_id: 'jamhara-terms',
          source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
          authority: 'islamic-content.com',
          book: selected.row.title,
          url: selected.row.url
        };
      } else {
        // Dynamic fallback check to Dorar Aqeedah Encyclopedia for theological/creed terms
        try {
          const aqeedahQueries = [
            queryToSearch,
            `تعريف ${queryToSearch}`,
            `معنى ${queryToSearch}`
          ];
          let aqeedahFound: any = null;
          for (const aq of aqeedahQueries) {
            const found = await searchDorarAqeedahLive(aq);
            if (found?.found && found.text && found.text.length >= 30) {
              aqeedahFound = found;
              break;
            }
          }
          if (aqeedahFound?.found) {
            v.status = 'NEEDS_REVIEW';
            v.status_label_ar = 'مادة عقدية موثقة من الموسوعة العقدية (الدرر السنية)';
            v.status_label_en = 'Approved Aqeedah Source Found — Review Required';
            v.reason = `تم العثور على مادة مصدرية موثقة في الموسوعة العقدية بالدرر السنية («${aqeedahFound.title}»). يُعرض المحتوى نقلاً من المصدر المعتمد.`;
            v.canonical_text = aqeedahFound.text || aqeedahFound.title;
            v.decision_level = 'B';
            v.citation = {
              source_id: 'dorar-aqeedah',
              source_name: 'الموسوعة العقدية — الدرر السنية',
              authority: 'منصة الدرر السنية',
              book: aqeedahFound.title,
              url: aqeedahFound.url
            };
            delete r._needs_live_search;
            return;
          }
        } catch {}

        v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
        v.status_label_ar = 'لم يُعثر على المصطلح في مصدر الجمهرة المفحوص';
        v.status_label_en = 'Term Not Found in Checked Jamhara Source';
        v.reason = 'لم يُعثر على مادة مطابقة في البحث المباشر بالمصدر المعتمد. لا ينشئ النموذج تعريفًا بديلاً.';
        v.citation = {
          source_id: 'jamhara-terms',
          source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
          authority: 'islamic-content.com',
          url: buildJamharaSearchUrl(queryToSearch)
        };
      }
      delete r._needs_live_search;
      return;
    }


    if (isFiqhQuestion) {
      console.log('[BASEERA][FIQH][ENTER]', JSON.stringify({ requestId: (v as any)._requestId || null, query: queryToSearch, aiEnabled }));
      // ── FIQH PATH: Dorar Fiqh Encyclopedia (dorar.net/feqhia) ─────────────────
      const fiqhSearchUrl = r._fiqh_url || buildDorarFiqhUrl(queryToSearch);

      // Step 0: Dynamic Question Understanding via AI (extracts true subject and queries)
      const decomp = aiEnabled ? await understandQuestionWithAI(queryToSearch) : null;
      const coreSubject = decomp?.core_subject || queryToSearch.replace(/^(?:ما\s+(?:هو\s+)?حكم|هل\s+يجوز|ما\s+حكم|حكم)\s+/, '').trim();
      const rawTokens = [
        coreSubject,
        ...(decomp?.subject_tokens || []),
        ...(decomp?.qualifiers || [])
      ].filter(Boolean);
      const subjectTokens = rawTokens
        .map(t => normalizeArabic(t).replace(/^ال/, '').trim())
        .filter(t => t.length >= 2);

      const isUserClaim = Boolean(decomp?.is_claim) ||
        /(?:شخص\s+(?:كاتب|يقول|يدعي|زعم)|يزعم|يدعي|ادعاء|زعم|يقال|شبهة|كاتب\s+ان|كاتب\s+أن|يقول\s+ان|يقول\s+أن|أنه\s+يمكن|انه\s+يمكن|يمكن\s+.+\s+لمدة)/i.test(queryToSearch) ||
        /(?:حلال|حرام|جائز|واجب|مكروه|مستحب|لا\s+يجوز|لا\s+يصح|يجوز|يصح)\s+(?:إذا|اذا|لو|في|عند|لـ|لكن)/i.test(queryToSearch);

      // Extract distinct significant words for compound qualifier matching
      const fiqhStopWords = new Set([
        'ما', 'هو', 'هي', 'هل', 'في', 'من', 'على', 'عن', 'الى', 'إلى', 'مع', 'بعد', 'قبل',
        'ان', 'إن', 'أن', 'إذا', 'اذا', 'كان', 'كانت', 'شخص', 'كاتب', 'يقول', 'قال', 'حكم',
        'حلال', 'حرام', 'واجب', 'جائز', 'يجوز', 'يصح', 'يحرم', 'الشرع', 'الشرعي', 'الدين'
      ]);

      const extractSignificantWords = (tokens: string[]): string[] => {
        const words: string[] = [];
        for (const token of tokens) {
          const norm = normalizeArabic(token);
          const parts = norm.split(/\s+/).map(p => p.replace(/^ال/, '').trim());
          for (const p of parts) {
            if (p.length >= 3 && !fiqhStopWords.has(p) && !words.includes(p)) {
              words.push(p);
            }
          }
        }
        return words;
      };

      const significantSubjectWords = extractSignificantWords([
        ...rawTokens,
        coreSubject,
        ...(decomp?.qualifiers || [])
      ]);

      const qualifierWords = extractSignificantWords(decomp?.qualifiers || []);
      const qualifierPhrases = (decomp?.qualifiers || [])
        .map(q => normalizeArabic(q).replace(/[0-9٥-٩]/g, '').trim())
        .filter(q => q.length >= 3);

      const scoreCandidate = (row: { title?: string; text?: string; url?: string }) => {
        const normTitle = normalizeArabic(row.title || '');
        const normText = normalizeArabic(row.text || '');
        const leafSegment = normTitle.split(/[—–-]/).pop()?.trim() || normTitle;

        let qualifierMatches = 0;
        let score = 0;

        // 1. Phrase match for qualifiers (e.g. "مدة المسح", "عنب", "عطش")
        for (const qp of qualifierPhrases) {
          if (leafSegment.includes(qp)) {
            score += 500;
            qualifierMatches += 2;
          } else if (normTitle.includes(qp)) {
            score += 250;
            qualifierMatches += 1;
          }
        }

        // 2. Individual qualifier words in leaf vs full title
        for (const qw of qualifierWords) {
          if (leafSegment.includes(qw)) {
            score += 80;
            qualifierMatches++;
          } else if (normTitle.includes(qw)) {
            score += 40;
            qualifierMatches++;
          }
        }

        // 3. Subject words in leaf vs full title
        let titleMatches = 0;
        for (const w of significantSubjectWords) {
          if (leafSegment.includes(w)) {
            score += 30;
            titleMatches++;
          } else if (normTitle.includes(w)) {
            score += 15;
            titleMatches++;
          }
        }

        // 4. Text matches
        let textMatches = 0;
        for (const w of significantSubjectWords) {
          if (normText.includes(w)) {
            score += 5;
            textMatches++;
          }
        }

        // 5. Core subject full phrase
        const normCore = normalizeArabic(coreSubject).replace(/^حكم\s+/, '').trim();
        if (normCore.length >= 4 && normTitle.includes(normCore)) {
          score += 50;
        }

        // 5b. AI-extracted subject PHRASE coverage. When the subject is a multi-word
        // noun phrase (e.g. «مس المرأة») that appears verbatim in the article
        // title/branch, that is the strongest possible subject signal — it should
        // outrank an article that merely repeats one predicate word like «ينقض الوضوء».
        for (const tok of subjectTokens) {
          const normTok = normalizeArabic(tok).replace(/^ال/, '').trim();
          if (normTok.length >= 3 && normTok.includes(' ') && normTitle.includes(normTok)) {
            score += 400;
          }
        }

        // 5c. The SPECIFIC multi-word subject must be reflected in the article
        // title. A candidate that ignores it (e.g. a «الموالاة في الوضوء» page for a
        // «النوم اليسير» question) is pushed down so the article that actually
        // treats the subject wins the selection.
        const multiWordSubjects = subjectTokens.filter(t => t.trim().includes(' '));
        if (multiWordSubjects.length) {
          const titleStems = normTitle
            .split(/\s+/)
            .map(w => w.replace(/^(?:و|ف|ب|ل|ك)?ا?ل/, '').replace(/[اوي]/g, ''))
            .filter(w => w.length >= 2);
          const anyCovered = multiWordSubjects.some(tok => {
            const stems = normalizeArabic(tok)
              .split(/\s+/)
              .map(w => w.replace(/^(?:و|ف|ب|ل|ك)?ا?ل/, '').replace(/[اوي]/g, ''))
              .filter(w => w.length >= 2);
            return stems.some(st =>
              titleStems.some(ts => ts === st || (st.length >= 3 && (ts.startsWith(st) || st.startsWith(ts))))
            );
          });
          score += anyCovered ? 600 : -800;
        }

        // 6. Substantive leaf level bonus (المبحث / المطلب / الفرع / المسألة are direct ruling texts, higher than فصل / باب / كتاب index pages)
        if (/(?:المبحث|المطلب|الفرع|المسألة)/.test(row.title || '')) {
          score += 150;
        }

        // 7. Penalties for unasked leaf modifiers (e.g. انتهاء, بداية, ما يبطل)
        const qualString = normalizeArabic((decomp?.qualifiers || []).join(' '));
        const unaskedModifiers = ['انتهاء', 'بدايه', 'ابتداء', 'يبطل', 'مبطلات', 'مفسدات', 'شروط', 'تكرار', 'اسفل'];
        for (const mod of unaskedModifiers) {
          if (leafSegment.includes(mod) && !qualString.includes(mod)) {
            score -= 150;
          }
        }
        if (/يبطل|مبطل|نواقض/.test(normTitle) && !qualString.includes('يبطل') && !qualString.includes('مبطل')) {
          score -= 100;
        }

        return { qualifierMatches, titleMatches, textMatches, score };
      };

      const qualifierQueries: string[] = [];
      if (decomp?.qualifiers?.length) {
        for (const qual of decomp.qualifiers) {
          const cleanQual = qual.replace(/[0-9٥-٩]/g, '').trim();
          if (cleanQual.length >= 3) {
            qualifierQueries.push(cleanQual);
            qualifierQueries.push(`${coreSubject} ${cleanQual}`);
          }
        }
      }

      const generatedQueries = decomp?.search_queries?.length
        ? decomp.search_queries
        : (aiEnabled ? await generateFiqhSearchQueriesWithAI(queryToSearch) : []);
      const searchQueries = [...new Set([
        queryToSearch,
        ...qualifierQueries,
        ...(decomp?.search_queries || []),
        ...generatedQueries,
        `حكم ${coreSubject}`
      ])]
        .filter(q => q.length >= 2)
        .slice(0, 7);

      // Strict Topic Guard: ensures candidate title belongs to the requested subject
      // Subject matching is WORD-level and root-tolerant. It must not be a raw
      // substring test (which treats «المسح» as containing «مس», answering a
      // question about «مس المرأة» with a page about «المسح على الجبائر»), and it
      // must tolerate morphology so that «نقض» matches «نواقض»/«ينتقض».
      const rootish = (word: string): string =>
        normalizeArabic(word)
          .replace(/^(?:و|ف|ب|ل|ك)?ا?ل/, '')
          .replace(/[اوي]/g, '')
          .trim();
      const matchSubjectToken = (haystack: string, token: string): boolean => {
        const tokenWords = token.split(/\s+/).map(rootish).filter(w => w.length >= 2);
        if (!tokenWords.length) return false;
        const words = haystack.split(/\s+/).map(rootish).filter(w => w.length >= 2);
        return tokenWords.some(tw =>
          words.some(w =>
            w === tw ||
            (tw.length >= 3 && (w.startsWith(tw) || tw.startsWith(w))) ||
            ((tw === 'لمس' || tw === 'لامس') && (w === 'مس' || w === 'ملموس')) ||
            ((tw === 'مس' || tw === 'ملموس') && (w === 'لمس' || w === 'لامس'))
          )
        );
      };
      const isCandidateTopicMatch = (row: { title?: string; text?: string; url?: string }): boolean => {
        if (!row?.title) return false;
        const normTitle = ' ' + normalizeArabic(row.title);
        return subjectTokens.some(tok => matchSubjectToken(normTitle, tok));
      };

      // Step 1: Retrieve from approved Dorar Fiqh Encyclopedia with strict topic guard
      let fiqhResult: any = null;
      const collected = new Map<string, { title: string; text: string; url: string }>();

      const addResults = (result: any) => {
        if (!result?.found) return;
        for (const row of result.allResults || []) {
          if (row.answerable === false) continue;
          if (typeof row.score === 'number' && row.score < 50) continue;
          if (!isCandidateTopicMatch(row)) continue;
          const key = row.url || `${row.title}::${row.text?.slice(0, 160) || ''}`;
          if (!collected.has(key)) {
            collected.set(key, {
              title: row.title || result.title,
              text: row.text || '',
              url: row.url || result.url
            });
          }
        }
        if ((result.title || result.text) && (result.answerable !== false) && isCandidateTopicMatch(result)) {
          const key = result.url || `${result.title}::${result.text?.slice(0, 160) || ''}`;
          if (!collected.has(key)) {
            collected.set(key, {
              title: result.title,
              text: result.text || '',
              url: result.url
            });
          }
        }
      };

      const initialResult = await searchDorarFiqhLive(queryToSearch);
      addResults(initialResult);

      for (const aiQuery of searchQueries) {
        if (aiQuery === queryToSearch) continue;
        const candidateResult = await searchDorarFiqhLive(aiQuery);
        addResults(candidateResult);
      }

      const candidateRows = Array.from(collected.values()).slice(0, 16);
      console.log('[BASEERA][FIQH][CANDIDATES]', JSON.stringify({ query: queryToSearch, count: candidateRows.length, candidates: candidateRows.map(row => ({ title: row.title, url: row.url })) }));

      // Additional grounded passages from the approved MCP library corpus
      // (IslamHouse / Shamela-like). Best-effort: a failure never blocks the flow.
      try {
        const libResults = await searchIslamicContent({ query: queryToSearch, sources: ['library'], language: 'ar', limit: 4 });
        for (const r of libResults.slice(0, 3)) {
          const doc = await fetchIslamicContent(r.id).catch(() => null);
          const text = doc?.text || '';
          if (text.trim()) {
            fiqhPassages.push({
              source: 'مكتبة المحتوى الإسلامي المعتمدة',
              title: doc?.title || r.title,
              text,
              url: doc?.url || r.url
            });
          }
        }
      } catch (mcpErr: any) {
        console.warn('[BASEERA][FIQH][MCP_LIBRARY]', mcpErr?.message || String(mcpErr));
      }

      let isDirectTopicMatch = false;
      if (candidateRows.length > 0) {
        // Step 1.5: Evidence Alignment Engine (Claim–Evidence Alignment)
        // Dissects subject, action, ruling, and REQUIRED QUALIFIERS (e.g. "العنب" vs "عطش")
        const claimDecomp = {
          core_subject: coreSubject,
          action: isUserClaim ? 'حكم/ادعاء' : undefined,
          claimed_ruling: decomp?.claimed_ruling,
          is_claim: Boolean(decomp?.is_claim),
          required_qualifiers: decomp?.qualifiers || []
        };

        const alignedCandidates = alignClaimWithEvidence(claimDecomp, candidateRows);
        console.log('[BASEERA][FIQH][ALIGNMENT]', JSON.stringify({
          query: queryToSearch,
          alignments: alignedCandidates.slice(0, 4).map(a => ({
            url: a.candidate.url,
            title: a.candidate.title,
            alignment: a.alignment,
            score: a.alignment_score,
            explanation: a.explanation
          }))
        }));

        // Score and sort candidates by specificity, relevance, and alignment
        const scoredCandidates = alignedCandidates.map(a => {
          const baseScoring = scoreCandidate(a.candidate);
          return {
            ...a.candidate,
            ...baseScoring,
            score: a.alignment_score + baseScoring.score,
            alignment: a.alignment,
            alignmentExplanation: a.explanation,
            isUnderspecified: a.is_underspecified,
            ambiguityNote: a.ambiguity_note
          };
        });
        scoredCandidates.sort((a, b) => b.score - a.score);

        const effectiveCandidates = scoredCandidates.slice(0, 6);
        let selected = effectiveCandidates[0];

        // Semantic topic gate. Rather than brittle keyword coverage, the model
        // decides whether a retrieved article actually addresses THIS question's
        // subject (not a neighbouring topic in the same chapter). When the model
        // is unavailable the deterministic checks below remain the fallback.
        if (aiEnabled && effectiveCandidates.length > 0) {
          const judge = await judgeFiqhTopicRelevance(queryToSearch, effectiveCandidates).catch(() => null);
          if (judge) {
            if (judge.candidate_index >= 0 && judge.confidence >= 0.6 && effectiveCandidates[judge.candidate_index]) {
              selected = effectiveCandidates[judge.candidate_index];
              v.ai_match = {
                provider: 'groq',
                candidate_id: `fiqh-${judge.candidate_index}`,
                relation: 'exact',
                confidence: judge.confidence
              };
              (v as any).__fiqh_ai_verdict = 'relevant';
            } else {
              (v as any).__fiqh_ai_verdict = 'irrelevant';
            }
          }
        }

        if (aiEnabled && effectiveCandidates.length > 1 && !v.ai_match && (v as any).__fiqh_ai_verdict !== 'irrelevant') {
          try {
            const aiCandidates = effectiveCandidates.map((row, index) => ({
              id: `fiqh-${index}`,
              source: 'fiqh-madhahib-dorar',
              title: row.title,
              text: row.text || ''
            }));
            const ai = await rankCandidatesWithAI('fiqh', queryToSearch, aiCandidates, 6000, { coreSubject, qualifiers: decomp?.qualifiers });
            console.log('[BASEERA][FIQH][AI_RANK_RESULT]', JSON.stringify({ query: queryToSearch, ai }));
            if (ai?.candidate_id && ai.confidence >= 0.55 && ai.relation !== 'none') {
              const selectedIndex = Number(ai.candidate_id.replace('fiqh-', ''));
              const candidate = effectiveCandidates[selectedIndex];
              if (candidate && isCandidateTopicMatch(candidate)) {
                // Safety invariant: Never allow an AI suggestion to downgrade to a candidate with significantly lower score
                if (candidate.score >= selected.score * 0.85) {
                  selected = candidate;
                  v.ai_match = {
                    provider: 'groq',
                    candidate_id: ai.candidate_id,
                    relation: ai.relation,
                    confidence: ai.confidence
                  };
                } else {
                  console.warn('[BASEERA][FIQH][SPECIFICITY_GUARD]', `AI suggested candidate ${candidate.title} (score: ${candidate.score}) but top candidate ${selected.title} has higher score (${selected.score}). Preserving top candidate.`);
                }
              }
            }
          } catch (aiErr: any) {
            console.warn('[BASEERA][FIQH][AI_RANK_ERROR]', aiErr?.message);
          }
        }

        const fiqhJudgeRelevant = (v as any).__fiqh_ai_verdict === 'relevant';
        const fiqhJudgeIrrelevant = (v as any).__fiqh_ai_verdict === 'irrelevant';
        isDirectTopicMatch = Boolean(
          selected &&
          isCandidateTopicMatch(selected) &&
          !fiqhJudgeIrrelevant &&
          ((selected as any).alignment === 'DIRECT' || fiqhJudgeRelevant || isUserClaim)
        );

        if (selected && isCandidateTopicMatch(selected) && !fiqhJudgeIrrelevant) {
          let fullDetailedText: string | null = null;
          if (selected.url) {
            try {
              const res = await fetchDorarFiqhArticleDetailedLive(selected.url);
              if (res) {
                fullDetailedText = res.text;
                if (res.url && res.url !== selected.url) {
                  selected.url = res.url;
                }
              }
            } catch (e: any) {
              console.warn('fetchDorarFiqhArticleDetailedLive failed:', e?.message);
            }
          }

          fiqhResult = {
            found: true,
            title: selected.title,
            text: selected.text,
            detailedRuling: fullDetailedText || selected.text,
            url: selected.url,
            source: 'الموسوعة الفقهية المقارنة — الدرر السنية',
            evidenceAlignment: fiqhJudgeRelevant ? 'DIRECT' : ((selected as any).alignment || 'DIRECT'),
            alignmentExplanation: (selected as any).alignmentExplanation,
            isUnderspecified: (selected as any).isUnderspecified,
            ambiguityNote: (selected as any).ambiguityNote,
            allResults: candidateRows
          };

          fiqhPassages = [
            { source: 'الموسوعة الفقهية المقارنة — الدرر السنية', title: selected.title, text: fullDetailedText || selected.text || '', url: selected.url },
            ...effectiveCandidates.slice(0, 4).map(c => ({
              source: 'الموسوعة الفقهية المقارنة — الدرر السنية',
              title: c.title,
              text: c.text || '',
              url: c.url
            }))
          ].filter(p => p.text && p.text.trim().length > 0);
        }
      }

      // Cross-Source Sunnah Retrieval:
      // When Fiqh encyclopedia has no direct article for this question (e.g. general morals,
      // ethics, virtues, fundamental rulings like lying/injustice/truthfulness where Fiqh only
      // returned procedural clauses or nothing at all), retrieve direct prophetic evidence
      // from the authentic Sunnah (Dorar Hadith API).
      let topHadith: any = null;
      if (!isDirectTopicMatch) {
        console.log('[BASEERA][FIQH][CROSS_SOURCE_SUNNAH]', JSON.stringify({ query: queryToSearch, coreSubject, subjectTokens }));
        const hadithQueries = [...new Set([
          coreSubject,
          `تحريم ${coreSubject}`,
          `حكم ${coreSubject}`,
          ...searchQueries
        ])].filter(q => q && q.length >= 2).slice(0, 6);

        const authenticHadiths: any[] = [];
        for (const hq of hadithQueries) {
          const hadithRows = await searchDorarApiLive(hq).catch(() => []);
          const matching = hadithRows.filter(r => {
            const normH = normalizeArabic(r.text);
            const matchesSubject = subjectTokens.some(tok => matchSubjectToken(normH, tok));
            return matchesSubject && (r.gradeCategory === 'sahih' || r.gradeCategory === 'hasan');
          });
          for (const m of matching) {
            if (!authenticHadiths.some(a => a.text === m.text)) {
              authenticHadiths.push(m);
            }
          }
          if (authenticHadiths.some(a => classifySourceTier(a.book) === 'primary')) break;
        }

        if (authenticHadiths.length > 0) {
          authenticHadiths.sort((a, b) => {
            const tierA = classifySourceTier(a.book) === 'primary' ? 1 : 0;
            const tierB = classifySourceTier(b.book) === 'primary' ? 1 : 0;
            if (tierB !== tierA) return tierB - tierA;
            const gradeA = a.gradeCategory === 'sahih' ? 1 : 0;
            const gradeB = b.gradeCategory === 'sahih' ? 1 : 0;
            return gradeB - gradeA;
          });
          topHadith = authenticHadiths[0];

          for (const h of authenticHadiths.slice(0, 4)) {
            fiqhPassages.unshift({
              source: `الموسوعة الحديثية — الدرر السنية (${h.book})`,
              title: `دليل المسألة من السنة النبوية (${h.grade})`,
              text: h.text,
              url: h.url
            });
          }
        }
      }

      // Ensure full untruncated text for selected fiqh article
      if (fiqhResult?.found && fiqhResult?.url && (!fiqhResult.detailedRuling || fiqhResult.detailedRuling.length < 80)) {
        try {
          const articleRes = await fetchDorarFiqhArticleDetailedLive(fiqhResult.url);
          if (articleRes?.text) {
            fiqhResult.detailedRuling = articleRes.text;
            if (articleRes.url && articleRes.url !== fiqhResult.url) {
              fiqhResult.url = articleRes.url;
            }
          }
        } catch (err: any) {
          console.warn('Full article fetch fallback failed:', err?.message);
        }
      }

      console.log('[BASEERA][FIQH][FINAL_SOURCE_RESULT]', JSON.stringify({ query: queryToSearch, found: Boolean(fiqhResult?.found), title: fiqhResult?.title || null, url: fiqhResult?.url || null, resultCount: fiqhResult?.allResults?.length || 0 }));

      const claimsConsensus = /(?:إجماع|اجماع|أجمع|اجمع|مجمع عليه|لا خلاف|باتفاق|متفق عليه)/.test(queryToSearch);

      const sensitive = isSensitiveFiqhQuestion(queryToSearch);

      // High-consequence fiqh questions are referral-only
      if (sensitive) {
        v.status = 'REFER_TO_SPECIALIST';
        v.status_label_ar = 'إحالة إلى مختص — وُجد مصدر فقهي معتمد';
        v.status_label_en = 'Refer to Qualified Specialist — Approved Source Found';
        v.reason = `تم العثور على مادة ذات صلة في الموسوعة الفقهية المقارنة بالدرر السنية («${fiqhResult?.title || queryToSearch}»). بسبب حساسية المسألة، لا تعرض بصيرة نص الحكم ولا تصدر ترجيحًا أو فتوى؛ استخدم الرابط لمراجعة المصدر مع أهل العلم المؤهلين.`;
        delete v.canonical_text;
        delete v.school_positions;
        v.decision_level = 'D';
        v.citation = {
          source_id: 'fiqh-madhahib-dorar',
          source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية (بحث مباشر)',
          authority: 'المذاهب الأربعة — مؤسسة الدرر السنية',
          book: fiqhResult?.title || 'الموسوعة الفقهية المقارنة',
          url: fiqhResult?.url || fiqhSearchUrl
        };
      } else if (fiqhResult?.found) {
          const rulingDetails = fiqhResult.detailedRuling
            ? fiqhResult.detailedRuling
            : (fiqhResult.text ? `${fiqhResult.title} — ${fiqhResult.text}` : fiqhResult.title);

          const fullTextForDispute = (rulingDetails + ' ' + (fiqhResult.text || '') + ' ' + (fiqhResult.title || '')).toLowerCase();
          let hasConsensusInSource = /(?:أجمع العلماء|أجمع أهل العلم|اتفاق أهل العلم|اتفاق العلماء|باتفاق العلماء|باتفاق الأئمة|بالإجماع|الدليل من الإجماع|نقل الإجماع|نقل الاتفاق|حكاية الإجماع|لا خلاف بين العلماء|أجمع المسلمون|إجماع أهل العلم)/i.test(fullTextForDispute);
          let hasDisputeIndicators = /(?:خلاف|اختلف|واختلفوا|القول الأول|القول الثاني|مذهب الحنفية|مذهب الشافعية|مذهب المالكية|مذهب الحنابلة|جمهور|ورواية|وفي قول|طائفة من السلف)/.test(fullTextForDispute);

          if (/(?:القول الأول[\s\S]*?القول الثاني|اختلَفَ العُلَماءُ|اختلف العلماء)/i.test(fullTextForDispute)) {
            hasDisputeIndicators = true;
          }

          let aiParsedVerdict: any = null;
          try {
            const aiVerdict = await groqChat([
              {
                role: 'system',
                content: 'أنت باحث فقهي محقق في منصة بصيرة. أمامك نص مسترجع من الموسوعة الفقهية المقارنة بالدرر السنية، وسؤال أو ادعاء فقهي من المستخدم. مهمتك تحليل النص فقط دون أي اختلاق خارج النص:\n1. هل ينص المصدر على إجماع/اتفاق تام، أم يذكر خلافاً بين المذاهب؟\n2. استخرج خلاصة الحكم المباشر الصريح في جملة واضحة وموجزة من النص (مثال: "يَحرُمُ شُربُ الخَمرِ المتَّخَذةِ مِن العِنَبِ؛ قليلِها وكثيرِها بالإجماع"، أو "يَمسَحُ المقيمُ يومًا وليلة، والمسافرُ ثلاثةَ أيَّام بلياليهنَّ").\n3. إذا كان مدخل المستخدم ادعاءً أو نقلاً لحكم (مثل: الزعم بأن كذا حلال، أو الزعم بأنه يمكن المسح 5 أيام):\n   هل هذا الادعاء مناقض/مخالف لما قرره المصدر؟\n   - claim_contradicted: true إذا كان الادعاء يحلل ما حرمه المصدر، أو يجيز ما منعه، أو يخالف الشروط والمدد المحددة في المصدر (مثل ادعاء 5 أيام بينما المعتمد يوم للمقيم و3 أيام للمسافر).\n   - claim_contradicted: false إذا كان الادعاء موافقاً للنص أو إذا كان مجرد سؤال استفساري.\n4. اذكر في claim_explanation سبب المخالفة باختصار شديد استناداً إلى النص فقط.\nأجب بـ JSON فقط: {"has_consensus": boolean, "is_disputed": boolean, "direct_ruling": string, "claim_contradicted": boolean, "claim_explanation": string}'
              },
              {
                role: 'user',
                content: `المدخل: ${queryToSearch}\nعنوان المقال: ${fiqhResult.title}\nالنص:\n"""\n${fullTextForDispute.slice(0, 3000)}\n"""`
              }
            ], { json: true, temperature: 0.05, maxTokens: 512, timeoutMs: 8000 });

            aiParsedVerdict = JSON.parse(aiVerdict);
            if (aiParsedVerdict && typeof aiParsedVerdict.has_consensus === 'boolean') {
              if (aiParsedVerdict.has_consensus && !hasDisputeIndicators) {
                hasConsensusInSource = true;
              } else if (aiParsedVerdict.is_disputed) {
                hasDisputeIndicators = true;
                hasConsensusInSource = false;
              }
            }
            if (aiParsedVerdict?.direct_ruling && typeof aiParsedVerdict.direct_ruling === 'string' && aiParsedVerdict.direct_ruling.length > 10) {
              (fiqhResult as any).directRuling = aiParsedVerdict.direct_ruling.trim();
            }
          } catch (e: any) {
            console.warn('[BASEERA][FIQH][AI_VERDICT_FALLBACK]', e?.message);
          }

          // Deterministic Claim Contradiction Evaluation
          let isContradicted = false;
          let contradictionDetail = '';

          if (isUserClaim) {
            const normQ = normalizeArabic(queryToSearch);
            const normRulingText = normalizeArabic(fullTextForDispute);

            // Deterministic Rule 1: Claims halal/permissible while source text explicitly forbids
            const claimsPermissible = /(?:حلال|جائز|مباح|يجوز|يحل|يمكن)/.test(normQ);
            const textForbids = /(?:يحرم|حرام|لا يجوز|لا يحل|محرم|تحريم|باطل)/.test(normRulingText);
            const claimsForbidden = /(?:حرام|محرم|لا يجوز|ممنوع)/.test(normQ);
            const textPermits = /(?:مشروع|سنة|مستحب|واجب|مباح|جائز|يجوز)/.test(normRulingText) && !/(?:لا يجوز|يحرم)/.test(normRulingText);

            if (claimsPermissible && textForbids) {
              isContradicted = true;
              contradictionDetail = 'الادعاء ينسب الإباحة أو الجواز لما نص المصدر المعتمد على تحريمه أو بطلانه.';
            } else if (claimsForbidden && textPermits) {
              isContradicted = true;
              contradictionDetail = 'الادعاء ينسب التحريم لما نص المصدر المعتمد على مشروعيته أو جوازه.';
            }

            // Deterministic Rule 2: Explicit conditions / numerical durations (like wiping duration)
            if (/مسح.*خف|خفين/.test(normQ) && /(?:5|٥|خمس|خمسة|اربعه|أربعة|سبع|سبعة|اسبوع|أسبوع)\s*(?:ايام|أيام|يوم)/.test(normQ)) {
              if (/(?:يوم\s*وليل.*مسافر\s*ثلاث|ثلاث.*ايام.*مقيم\s*يوم)/.test(normRulingText)) {
                isContradicted = true;
                contradictionDetail = 'الادعاء يزعم مدة مسح لم ترد في المذاهب الأربعة؛ إذ حددت السنة والمذاهب الأربعة مدة المسح بيوم وليلة للمقيم، وثلاثة أيام ولياليهن للمسافر.';
              }
            }

            // Deterministic Rule 3: AI Verdict confirmation
            if (aiParsedVerdict?.claim_contradicted) {
              isContradicted = true;
              if (aiParsedVerdict.claim_explanation) {
                contradictionDetail = aiParsedVerdict.claim_explanation;
              }
            }
          }

          const sourceRuling = (fiqhResult as any).directRuling || undefined;
          v.status = 'NEEDS_REVIEW';
          v.canonical_text = rulingDetails;
          v.source_ruling = sourceRuling;
          v.direct_ruling = sourceRuling; // Backwards-compatible alias
          v.evidence_alignment = (fiqhResult as any).evidenceAlignment || 'DIRECT';
          v.ambiguity_note = (fiqhResult as any).ambiguityNote || undefined;
          v.is_question = !isUserClaim;

          v.decision_level = 'C';
          v.citation = {
            source_id: 'fiqh-madhahib-dorar',
            source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية (بحث مباشر في المذاهب الأربعة)',
            authority: 'المذاهب الأربعة (الحنفي، المالكي، الشافعي، الحنبلي) — مؤسسة الدرر السنية',
            book: fiqhResult.title,
            url: fiqhResult.url || fiqhSearchUrl
          };

          if (isUserClaim) {
            // Context A: User made a CLAIM / POST
            if (isContradicted) {
              v.finding_type = 'contradicted_claim';
              v.status_label_ar = 'غير مطابق للمصدر — دعوى باطلة تخالف المذاهب الأربعة';
              v.status_label_en = 'Contradicted by Source — Invalid Fiqh Claim';
              v.baseera_explanation = `المصدر الفقهي المعتمد («${fiqhResult.title}») يناقض صراحة الادعاء المذكور؛ ${contradictionDetail || 'إذ يقرر خلاف ما نُسب إليه.'}`;
              v.reason = v.baseera_explanation;
            } else if (claimsConsensus && hasDisputeIndicators) {
              v.finding_type = 'disputed_consensus';
              v.status_label_ar = 'دعوى إجماع غير صحيحة — المسألة خلافية بين المذاهب الأربعة';
              v.status_label_en = 'Incorrect Claim of Consensus — Disputed Across Four Madhhabs';
              v.baseera_explanation = `المصدر الفقهي يثبت وجود خلاف بين أئمة المذاهب الأربعة في المسألة، مما ينقض دعوى الإجماع المدعاة.`;
              v.reason = `${v.baseera_explanation} راجع نص المادة الفقهية والأدلة المعتمدة أدناه.`;
            } else if (claimsConsensus && hasConsensusInSource) {
              v.finding_type = 'documented_consensus';
              v.status_label_ar = 'إجماع موثق في الموسوعة الفقهية المقارنة';
              v.status_label_en = 'Documented Consensus in Fiqh Encyclopedia';
              v.baseera_explanation = `المصدر الفقهي يوثق ثبوت الإجماع والاتفاق في هذه المسألة استناداً إلى المنقول عن أهل العلم.`;
              v.reason = v.baseera_explanation;
            } else {
              v.finding_type = 'verified_claim';
              v.status_label_ar = 'مسألة فقهية موثقة في الموسوعة الفقهية (المذاهب الأربعة)';
              v.status_label_en = 'Documented Fiqh Matter — Four Madhhabs Encyclopedia';
              v.baseera_explanation = `المادة الفقهية من الموسوعة المقارنة تبين المعتمد في المسألة.`;
              v.reason = `عُثر على مادة المسألة في الموسوعة الفقهية المقارنة بالدرر السنية («${fiqhResult.title}»).`;
            }
          } else {
            // Context B: User asked a QUESTION.
            // The retrieved article is only "documented" when it DIRECTLY matches
            // the question's subject and qualifiers. A related or out-of-scope
            // article (e.g. a Hajj/هدي page returned for a fasting-Friday
            // question) must never be presented as the answer.
            const alignment = v.evidence_alignment;
            // The question's subject must appear in the article's TITLE/branch,
            // not merely somewhere in its body. A Hajj page may mention fasting
            // in passing; that must never be returned as the answer.
            const fiqhTitleNorm = ' ' + normalizeArabic(fiqhResult.title || '');
            const coreTokens = normalizeArabic(coreSubject || '')
              .split(/\s+/)
              .map(t => t.replace(/^ال/, ''))
              .filter(t => t.length >= 3 && !/^(?:حكم|ما|هل|الشرع|يجوز|يصح|صيام)$/.test(t));
            const coversToken = (token: string) => matchSubjectToken(fiqhTitleNorm, token);
            const coveredSubjectTokens = coreTokens.filter(coversToken);
            // Accept the article only when its title/branch actually covers the
            // question's subject (at least half of the significant subject words,
            // and at least one of them), or when the semantic matcher explicitly
            // confirmed an exact subject match. Otherwise the retrieved article is
            // out of scope and Baseera abstains instead of colouring a wrong answer.
            const aiConfirmedSubject = v.ai_match?.relation === 'exact' && v.ai_match.confidence >= 0.7;
            // Accept the article when its title/branch carries the question's
            // PRIMARY subject phrase, or ANY multi-word subject phrase (a strong
            // topical signal, e.g. «النوم اليسير» → «النوم الخفيف»). A single
            // generic word such as «الجمعة» is NOT sufficient — that is what stops
            // a «فضل الجمعة» page answering a Friday-fasting question.
            // The required subject is the MOST SPECIFIC one: if the AI extracted a
            // multi-word subject phrase (e.g. «النوم اليسير») it MUST be present in
            // the article title/branch. Only when no phrase exists do we fall back
            // to the single subject head. An umbrella word such as «الوضوء» alone is
            // NOT sufficient — that is what previously accepted an unrelated
            // «الموالاة في الوضوء» page for a light-sleep question.
            const multiWordTokens = subjectTokens.filter(tok => tok.trim().includes(' '));
            const requiredTokens = multiWordTokens.length
              ? multiWordTokens
              : [(subjectTokens[0] || coreTokens[0] || '').trim()].filter(Boolean);
            const requiredCovered = requiredTokens.some(coversToken);

            // The semantic verdict is used as an ADDITIONAL accept path only (the
            // available model is small and rejecting on it alone causes false
            // negatives). The deterministic subject check remains the primary gate.
            const aiVerdict = (v as any).__fiqh_ai_verdict as 'relevant' | 'irrelevant' | undefined;
            const titleSubjectMatch =
              aiVerdict === 'relevant' ||
              coreTokens.length === 0 ||
              aiConfirmedSubject ||
              requiredCovered;

            const isOutOfScope = (alignment === 'OUT_OF_SCOPE' && aiVerdict !== 'relevant');
            if (isOutOfScope || !titleSubjectMatch) {
              if (topHadith) {
                // Out of scope fiqh article, but direct prophetic evidence found in authentic Sunnah
                v.status = 'NEEDS_REVIEW';
                v.canonical_text = topHadith.text;
                v.decision_level = 'B';
                v.citation = {
                  source_id: 'dorar-hadith',
                  source_name: 'الموسوعة الحديثية — الدرر السنية (دليل المسألة الشرعية)',
                  authority: 'مؤسسة الدرر السنية للإشراف العلمي',
                  book: `${topHadith.book}${topHadith.numberOrPage ? ` (${topHadith.numberOrPage})` : ''}`,
                  grade: topHadith.grade,
                  url: topHadith.url || undefined
                };
                v.status_label_ar = 'حكم موثّق من المصادر المعتمدة — مستند إلى السنة الصحيحة';
                v.status_label_en = 'Documented Ruling from Approved Sources — Authentic Sunnah';
                v.reason = `المسألة مستندة إلى الدليل الصريح من السنة النبوية المطهرة في الموسوعة الحديثية: «${topHadith.text}». الراوي: ${topHadith.rawi || 'الصحابة الكرام'}، المحدث: ${topHadith.muhaddith || ''}، المصدر: ${topHadith.book} (${topHadith.numberOrPage})، خلاصة حكم المحدث: ${topHadith.grade}.`;
                v.baseera_explanation = v.reason;
                v.finding_type = 'documented_question';
                delete v.abstention_note;
              } else {
                v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
                v.finding_type = 'generic_review';
                v.status_label_ar = 'لم يُعثر على مسألة مطابقة في المرجع المعتمد';
                v.status_label_en = 'Not Found in Approved Source';
                v.reason = 'لم يُعثر في الموسوعة الفقهية المقارنة بالدرر السنية على مادة تتناول موضوع هذا السؤال بعينه. امتنعت «بصيرة» عن عرض أي مادة غير مطابقة بدل تلوين النتيجة بغير حق، ولا تُصدر فتوى من تلقاء نفسها.';
                v.baseera_explanation = v.reason;
                v.canonical_text = '';
                v.source_ruling = undefined;
                v.direct_ruling = undefined;
                if (v.citation) delete (v.citation as any).book;
                v.citation = { ...v.citation, url: undefined };
              }
            } else if ((fiqhResult as any).isUnderspecified || (alignment !== 'DIRECT' && aiVerdict !== 'relevant')) {
              v.finding_type = 'ambiguous_question';
              v.status_label_ar = 'عُثر على مادة فقهية مرتبطة بالسؤال (يحتاج إلى تحديد ومراجعة)';
              v.status_label_en = 'Related Fiqh Material Found — Question Needs Specification';
              v.ambiguity_note = (fiqhResult as any).ambiguityNote || `تنبيه دلالي: صيغة السؤال عامة أو غير مطابقة تماماً للمادة المسترجعة («${fiqhResult.title}»)؛ ينبغي تحديد المسألة والفرع المقصود بدقة للتحقق التام.`;
              v.baseera_explanation = v.ambiguity_note;
              v.reason = v.ambiguity_note;
            } else {
              v.finding_type = 'documented_question';
              v.status_label_ar = 'عُثر على المسألة في المصدر المعتمد';
              v.status_label_en = 'Fiqh Ruling Found in Approved Source';
              v.baseera_explanation = 'بحسب المادة الفقهية في المصدر المعتمد: المسألة مبيّنة بالأدلة وأقوال أئمة المذاهب المنقولة، ولا تصدر بصيرة فتوى مستقلة.';
              v.reason = `عُثر على المسألة موثقة في الموسوعة الفقهية المقارنة بالدرر السنية («${fiqhResult.title}»). النص المعروض مأخوذ مباشرة من المرجع المعتمد.`;
            }

            // Chatbot-style, source-grounded answer: a direct ruling synthesised
            // ONLY from the retrieved passages (Dorar fiqh + approved library),
            // with its evidence quoted. Never invents a ruling or a citation.
            const synthesis = aiEnabled
              ? await answerFiqhFromSources(queryToSearch, fiqhPassages).catch(() => null)
              : null;
            if (synthesis && synthesis.answer) {
              v.source_ruling = synthesis.answer;
              v.direct_ruling = synthesis.answer;
              v.status_label_ar = 'حكم موثّق من المصادر المعتمدة';
              const consensusLine = synthesis.consensus && synthesis.consensus !== 'غير مذكور'
                ? ` (${synthesis.consensus})`
                : '';
              const evidenceLine = synthesis.evidence.length
                ? ` الدليل من المصادر المعتمدة: ${synthesis.evidence.join(' — ')}`
                : '';
              v.baseera_explanation = `الخلاصة: ${synthesis.answer}${consensusLine}.${evidenceLine}`;
              v.reason = v.baseera_explanation;
            }
          }
        } else if (topHadith) {
          // Direct Authentic Sunnah Evidence found from primary collections (when fiqh encyclopedia has no entry)
          v.status = 'NEEDS_REVIEW';
          v.canonical_text = topHadith.text;
          v.decision_level = 'B';
          v.citation = {
            source_id: 'dorar-hadith',
            source_name: 'الموسوعة الحديثية — الدرر السنية (دليل المسألة الشرعية)',
            authority: 'مؤسسة الدرر السنية للإشراف العلمي',
            book: `${topHadith.book}${topHadith.numberOrPage ? ` (${topHadith.numberOrPage})` : ''}`,
            grade: topHadith.grade,
            url: topHadith.url || undefined
          };

          const synthesis = aiEnabled
            ? await answerFiqhFromSources(queryToSearch, fiqhPassages).catch(() => null)
            : null;

          if (synthesis && synthesis.answer) {
            v.source_ruling = synthesis.answer;
            v.direct_ruling = synthesis.answer;
            v.status_label_ar = 'حكم موثّق من المصادر المعتمدة — مستند إلى السنة الصحيحة';
            v.status_label_en = 'Documented Ruling from Approved Sources — Authentic Sunnah';
            const consensusLine = synthesis.consensus && synthesis.consensus !== 'غير مذكور'
              ? ` (${synthesis.consensus})`
              : '';
            const evidenceLine = synthesis.evidence.length
              ? ` الدليل من المصادر المعتمدة: ${synthesis.evidence.join(' — ')}`
              : '';
            v.baseera_explanation = `الخلاصة: ${synthesis.answer}${consensusLine}.${evidenceLine}`;
            v.reason = v.baseera_explanation;
            v.finding_type = 'documented_question';
            delete v.abstention_note;
          } else {
            v.status_label_ar = 'مسألة مستندة إلى الدليل الصريح من السنة (الدرر السنية)';
            v.status_label_en = 'Documented Islamic Ruling — Authentic Sunnah (Dorar.net)';
            v.reason = `المسألة مستندة إلى الدليل الصريح من السنة النبوية المطهرة في الموسوعة الحديثية: «${topHadith.text}». الراوي: ${topHadith.rawi || 'الصحابة الكرام'}، المحدث: ${topHadith.muhaddith || ''}، المصدر: ${topHadith.book} (${topHadith.numberOrPage})، خلاصة حكم المحدث: ${topHadith.grade}. راجع نص الحديث وتخريجه من المصدر المعتمد أدناه.`;
            v.baseera_explanation = v.reason;
            v.finding_type = 'documented_question';
            delete v.abstention_note;
          }
        } else {
        // Both Fiqh and Hadith yielded no candidate matching the subject -> Fail closed honestly
        v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
        v.status_label_ar = claimsConsensus
          ? 'لم يُعثر على توثيق للمسألة (امتناع شرعي عن إثبات الإجماع)'
          : 'لم يُعثر عليه في المراجع المفحوصة (امتناع شرعي)';
        v.status_label_en = claimsConsensus
          ? 'Not Found in Checked Sources (Abstention on Consensus)'
          : 'Not Found in Checked Sources (Abstention)';
        v.reason = claimsConsensus
          ? 'لم يُعثر على توثيق لهذه المسألة في الموسوعة الفقهية المقارنة بالدرر السنية؛ وتلتزم منظومة «بصيرة» بالامتناع الشرعي التام عن إثبات دعوى الإجماع أو نفيها أو الفتوى لعدم ورود نص موثق في المصادر المعتمدة.'
          : 'لم يُعثر على نص قطعي أو حديث صريح مطابق لهذه المسألة في المصادر المعتمدة المفحوصة بالدرر السنية (الموسوعة الفقهية والحديثية). تلتزم منظومة «بصيرة» بالامتناع الصارم عن إصدار أي حكم شرعي أو عزو مواد غير مطابقة منعاً للهلوسة والخطأ في دين الله. يمكنك البحث في الموسوعة الفقهية المقارنة بالدرر السنية عبر الرابط المرفق.';
        v.decision_level = 'C';
        v.citation = {
          source_id: 'fiqh-madhahib-dorar',
          source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية',
          authority: 'المذاهب الأربعة — مؤسسة الدرر السنية',
          book: 'الموسوعة الفقهية المقارنة',
        };
      }
    } else {
      // ── HADITH / CLAIM PATH: Dorar Hadith Encyclopedia (dorar.net) ───────────
      const hadithAIQueries = aiEnabled
        ? await generateSourceSearchQueriesWithAI('hadith', queryToSearch)
        : [];
      const smart = await searchDorarWithSmartQueries(queryToSearch, hadithAIQueries);

      // Preferred source: the approved HadeethEnc encyclopedia (via the
      // islamic-content-mcp server). It returns the canonical matn with grade,
      // attribution and a real permalink. Falls back to Dorar when unavailable.
      const heResult = await verifyHadithWithHadeethEnc(v.item).catch(() => null);
      if (heResult) {
        Object.assign(v, heResult);
      } else if (smart.topResult) {
        let top = smart.topResult;

        // Rerank retrieved Dorar candidates with AI. The model may choose only
        // among source-returned records; buildHadithDecision remains authoritative.
        if (smart.allResults.length > 1) {
          const hadithCandidates = smart.allResults.slice(0, 12).map((r, index) => ({
            id: `hadith-${index}`,
            source: 'dorar-hadith',
            title: `${r.book || 'الدرر السنية'} ${r.numberOrPage || ''}`.trim(),
            text: r.text
          }));

          const ai = await rankCandidatesWithAI('hadith', v.item.text, hadithCandidates);
          if (ai?.candidate_id && ai.confidence >= 0.55 && ai.relation !== 'none') {
            const selectedIndex = Number(ai.candidate_id.replace('hadith-', ''));
            if (Number.isInteger(selectedIndex) && smart.allResults[selectedIndex]) {
              top = smart.allResults[selectedIndex];
              v.ai_match = {
                provider: 'groq',
                candidate_id: ai.candidate_id,
                relation: ai.relation,
                confidence: ai.confidence
              };
            }
          }
        }

        const hadithDecision = buildHadithDecision(v.item, top);

        if (v.item.type === 'ayah') {
          // A hadith found after a Quran claim is evidence of misattribution only if
          // the user or context actually claimed the text as Quran.
          const explicitlyClaimedAsQuran = Boolean(
            v.item.claimed_surah ||
            /(?:قال\s+(?:الله\s+)?تعالى|سورة|آية|المصحف|في\s+القرآن)/i.test(v.item.context || v.item.text)
          );

          if (explicitlyClaimedAsQuran) {
            Object.assign(v, {
              ...hadithDecision,
              item: { ...v.item, type: 'ayah' },
              status: 'NEEDS_REVIEW',
              status_label_ar: 'خطأ في العزو — النص حديث/رواية وليس آية قرآنية',
              status_label_en: 'Misattributed as Quran — Hadith/Report Found',
              reason: `نُسب النص في المدخل إلى القرآن، لكن البحث في المصحف لم يثبت مطابقته، بينما عثر المصدر الحديثي المعتمد على رواية مطابقة/قريبة: ${hadithDecision.reason}`
            });
          } else {
            Object.assign(v, {
              ...hadithDecision,
              item: { ...v.item, type: 'hadith' }
            });
          }
        } else {
          Object.assign(v, hadithDecision);
        }
      } else {
        if (v.status !== 'REFER_TO_SPECIALIST') {
          v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
          v.status_label_ar = 'لم يُعثر عليه في المراجع المفحوصة';
          v.status_label_en = 'Not Found in Checked Sources';
          v.reason = 'لم يُعثر على تطابق موثوق لهذا النص في الموسوعة الحديثية بالدرر السنية. تلتزم المنظومة بالامتناع عن الجزم بصحة أي رواية غير مثبتة.';
          v.abstention_note = 'لا تُثبت النسبة إلى النبي ﷺ حتى توجد مطابقة صريحة في المصدر الحديثي المعتمد.';
          v.citation = {
            source_id: 'dorar-hadith',
            source_name: 'الموسوعة الحديثية — الدرر السنية',
            authority: 'المصادر المعتمدة في الحزمة العلمية'
            // No URL: an unmatched text has no source page to cite.
          };
        }

        // ── FALLBACK SYNTHESIS (chatbot-style) ────────────────────────────────
        // When no fiqh article was accepted, still ANSWER the question from the
        // passages actually retrieved (approved library via MCP + any source text),
        // strictly grounded: a direct ruling + consensus + quoted evidence. It never
        // invents a ruling, a citation, or evidence.
        if (aiEnabled && !v.source_ruling) {
          const fallbackPassages = [...fiqhPassages];
          if (v.canonical_text && String(v.canonical_text).trim()) {
            fallbackPassages.push({
              source: v.citation?.source_name || 'المصدر المعتمد',
              title: v.citation?.book || '',
              text: String(v.canonical_text)
            });
          }
          const synth = await answerFiqhFromSources(queryToSearch, fallbackPassages).catch(() => null);
          if (synth && synth.answer) {
            v.source_ruling = synth.answer;
            v.direct_ruling = synth.answer;
            v.status = 'NEEDS_REVIEW';
            v.status_label_ar = 'حكم موثّق من المصادر المعتمدة';
            v.status_label_en = 'Ruling Answered from Approved Sources';
            const consensusLine = synth.consensus && synth.consensus !== 'غير مذكور' ? ` (${synth.consensus})` : '';
            const evidenceLine = synth.evidence.length ? ` الدليل من المصادر المعتمدة: ${synth.evidence.join(' — ')}` : '';
            v.baseera_explanation = `الخلاصة: ${synth.answer}${consensusLine}.${evidenceLine}`;
            v.reason = v.baseera_explanation;
            v.finding_type = 'documented_question';
            delete v.abstention_note;
          }
        }
      }
    }
  } catch (err) {
    console.error('resolveVerificationWithLiveSearch error:', err);
  }

  delete r._needs_live_search;
}


// 2. Ingestion & Verification API (Text, URL, Image OCR, Audio STT)
// 1b. Dedicated Fetch URL Content API
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'يرجى إدخال رابط صالح يبدأ بـ http:// أو https://' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetchRemoteSafely(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(400).json({ error: 'الموقع المستهدف يمنع الجلب الآلي (رمز 403 / حماية Cloudflare). يمكنك نسخ نص المقال ولصقه مباشرة في خانة التحقق.' });
      }
      return res.status(400).json({ error: `فشل جلب الصفحة: رمز الاستجابة ${response.status} (${response.statusText})` });
    }

    const html = await readTextWithLimit(response);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Extract main text from article or body
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentHtml = articleMatch ? articleMatch[1] : (mainMatch ? mainMatch[1] : html);

    const cleanText = contentHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-zA-Z]+;/g, ' ')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText || cleanText.length < 10) {
      return res.status(400).json({ error: 'لم يتم العثور على محتوى نصي مقروء في الصفحة المحددة.' });
    }

    res.json({
      success: true,
      url,
      title,
      text: cleanText.slice(0, 5000),
      length: cleanText.length
    });
  } catch (err: any) {
    res.status(500).json({ error: `خطأ أثناء الاتصال بالرابط: ${err.message || 'انتهت مهلة الاتصال'}` });
  }
});

// 1c. Dedicated Audio Transcription API
app.post('/api/transcribe', async (req, res) => {
  try {
    const { mediaBase64, mediaMimeType = 'audio/mpeg' } = req.body;
    if (!mediaBase64 || !String(mediaMimeType).startsWith('audio/')) {
      return res.status(400).json({ error: 'يرجى توفير ملف صوتي صالح.' });
    }

    const raw = String(mediaBase64);
    const headerMatch = raw.match(/^data:([^;]+);base64,(.+)$/s);
    const cleanBase64 = headerMatch ? headerMatch[2] : raw;
    const estimatedBytes = Math.floor(cleanBase64.length * 0.75);
    if (estimatedBytes > 15_000_000) {
      return res.status(413).json({ error: 'حجم الملف الصوتي أكبر من الحد المسموح.' });
    }

    const text = await groqTranscribe(cleanBase64, mediaMimeType);
    if (!text) return res.status(400).json({ error: 'لم يتم استخراج نص من التسجيل.' });
    res.json({ success: true, text, method: 'groq-whisper', model: 'whisper-large-v3-turbo' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل تحويل الصوت إلى نص.' });
  }
});


app.post('/api/ocr', async (req, res) => {
  try {
    const { mediaBase64, mediaMimeType = 'image/jpeg' } = req.body;
    if (!mediaBase64) {
      return res.status(400).json({ error: 'لم يتم توفير بيانات الصورة.' });
    }

    let extractedText = '';
    let methodUsed = '';
    let tesseractText = '';

    if (aiEnabled) {
      try {
        extractedText = await groqVisionText(
          String(mediaBase64),
          mediaMimeType,
          'أنت نظام OCR لمشروع بصيرة. استخرج النص العربي المكتوب في الصورة حرفياً قدر الإمكان، دون تفسير أو تصحيح أو اختلاق. أعد النص المستخرج فقط.',
          15000
        );
        if (extractedText) methodUsed = 'groq-qwen3.8-27b';
      } catch (groqErr: any) {
        console.warn('Groq OCR error, falling back to local OCR:', groqErr.message);
      }
    }

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('ara');
      const fullDataUri = String(mediaBase64).startsWith('data:')
        ? String(mediaBase64)
        : `data:${mediaMimeType};base64,${mediaBase64}`;
      const ret = await worker.recognize(fullDataUri);
      await worker.terminate();
      const rawOcr = (ret.data?.text || '').trim();
      tesseractText = rawOcr
        .replace(/\b[A-Za-z]{1,5}\b/g, '')
        .replace(/[)\]}][0-9]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!extractedText && tesseractText) {
        extractedText = tesseractText;
        methodUsed = 'tesseract';
      } else if (extractedText && tesseractText) {
        const { normalizeArabicStrict } = await import('./src/lib/normalizer.ts');
        const consensus = normalizeArabicStrict(extractedText) === normalizeArabicStrict(tesseractText);
        return res.json({
          success: true,
          text: extractedText,
          method: 'groq+tesseract',
          consensus,
          alternateText: tesseractText
        });
      }
    } catch (tessErr: any) {
      console.warn('Tesseract OCR error:', tessErr);
    }

    if (!extractedText) {
      return res.status(400).json({
        error: 'لم يتمكن المحرك من قراءة نص واضح داخل الصورة. يرجى التأكد من وضوح الصورة ودقة الخط، أو كتابة النص يدوياً.'
      });
    }

    res.json({ success: true, text: extractedText, method: methodUsed, consensus: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشلت معالجة الصورة.' });
  }
});

// 2. Ingestion & Verification API (Text, URL, Image OCR, Audio STT)
app.post('/api/verify', async (req, res) => {
  const requestId = Math.random().toString(36).slice(2, 9);
  try {
    const { text, inputType = 'text', targetCategory = 'auto', mediaBase64, mediaMimeType, url } = req.body;
    let extractedText = (text || '').trim();
    console.log('[BASEERA][VERIFY][START]', JSON.stringify({ requestId, version: BASEERA_SERVER_VERSION, inputType, targetCategory, inputLength: extractedText.length, groqEnabled: aiEnabled, cwd: process.cwd() }));

    // Handle URL ingestion if text was not pre-fetched
    if (inputType === 'url' && url && !extractedText) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetchRemoteSafely(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Baseera/1.0', 'Accept': 'text/html,*/*' }
        });
        clearTimeout(timeout);

        if (response.ok) {
          const html = await readTextWithLimit(response);
          const cleanText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-zA-Z]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 5000);
          if (cleanText) extractedText = cleanText;
        }
      } catch (fetchErr) {
        console.warn('URL fetch failed:', fetchErr);
      }
    }

    // Handle Image OCR if text was not pre-extracted
    if (inputType === 'image' && mediaBase64 && !extractedText) {
      if (aiEnabled) {
        try {
          extractedText = await groqVisionText(
            String(mediaBase64),
            mediaMimeType || 'image/jpeg',
            'استخرج جميع النصوص العربية والإسلامية الموجودة في هذه الصورة بدقة وبنفس كلماتها وحروفها قدر الإمكان، دون اختلاق أو إضافة أو تفسير. أعد النص المكتوب فقط.',
            15000
          );
        } catch (groqErr: any) {
          console.warn('Groq image OCR failed, falling back to Tesseract:', groqErr.message);
        }
      }

      if (!extractedText) {
        try {
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('ara');
          const fullDataUri = String(mediaBase64).startsWith('data:')
            ? String(mediaBase64)
            : `data:${mediaMimeType || 'image/jpeg'};base64,${mediaBase64}`;
          const ret = await worker.recognize(fullDataUri);
          await worker.terminate();
          extractedText = (ret.data?.text || '')
            .replace(/\s+/g, ' ')
            .trim();
        } catch (tessErr) {
          console.warn('Tesseract fallback error:', tessErr);
        }
      }
    }

    // STRICT VALIDATION: If still no text, return explicit error, NEVER fall back to dummy/preset text
    if (!extractedText || extractedText.startsWith('[ملف تم تحميله')) {
      if (inputType === 'image') {
        return res.status(400).json({ error: 'لم يتم التعرف على أي نص داخل الصورة المرفوعة. يرجى كتابة النص يدوياً أو رفع صورة أوضح.' });
      }
      if (inputType === 'url') {
        return res.status(400).json({ error: 'تعذر جلب محتوى من الرابط المحدد. يرجى الضغط على زر «جلب محتوى الرابط» أولاً أو إدخال النص يدوياً.' });
      }
      return res.status(400).json({ error: 'لم يتم توفير نص أو محتوى صالح للفحص.' });
    }

    // AI Extraction Layer with strict structured schema
    let extractedItems: ExtractedItem[] = [];

    // Helper with timeout
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI extraction timeout')), timeoutMs))
      ]);
    };

    if (aiEnabled && extractedText.length > 10 && (!targetCategory || targetCategory === 'auto')) {
      try {
        const aiRaw = await groqChat(
          [{
            role: 'user',
            content: `أنت طبقة الاستخراج في منظومة «بصيرة» للتحقق من المحتوى الإسلامي وسياقه.

مهمتك استخراج العناصر الدينية فقط، لا إصدار حكم شرعي ولا إثبات صحة شيء.
استخرج الآيات، الأحاديث، المصطلحات الحساسة، الأسئلة الفقهية، والادعاءات الدينية، وأي عزو/سياق ذي صلة.

قواعد تحديد النوع (type):
- fiqh_question: المسائل الفقهية، الفتاوى، الأحكام الشرعية، أو أي ادعاء أو مسألة تتعلق بالحل والحرمة والجواز والعبادات والطهارة (مثل: أحكام المسح على الخفين، ادعاء أن شرب الخمر حلال، الصلاة، الزكاة، البيوع).
- ayah: الآيات القرآنية الكريمة أو ما يزعم صراحة أنه قرآن. لا تصنف أي متن نبوي أو حديث مشهور كـ ayah.
- hadith: الأحاديث النبوية الشريفة ومتون الروايات والآثار (مثل: «إنما الأعمال بالنيات»، «طلب العلم فريضة»، «المسلم من سلم المسلمون من لسانه ويده»). إذا كان النص متناً نبوياً حتى دون ذكر السند أو «قال رسول الله»، فهو hadith قطعي وليس ayah ولا term.
- tafsir_question: معاني الآيات وتفاسير القرآن وسوره.
- aqeedah_question: مسائل العقيدة وأصول الإيمان وأسماء الله وصفاته والتوحيد.
- term: المصطلحات والمفاهيم الشرعية.
- claim: الادعاءات التاريخية أو العامة الأخرى.

مهم جداً: انقل النص الفعلي كما هو تماماً في حقل text، ولا تكتب أي نص بديل أو أمثلة أو علامات تنصيص زائدة.

المدخل:
"""
${extractedText}
"""

أعد JSON صالح بهذا الشكل فقط (مع استبدال القيم بالنص الفعلي من المدخل):
{
  "items": [
    {
      "type": "fiqh_question",
      "text": "النص الحرفي المأخوذ من المدخل",
      "context": "",
      "language": "ar",
      "claimed_source": ""
    }
  ]
}`
          }],
          {
            model: GROQ_TEXT_MODEL,
            temperature: 0,
            maxTokens: 4096,
            json: true,
            reasoningEffort: 'none',
            timeoutMs: 12000
          }
        );

        const parsed = JSON.parse(aiRaw);
        const candidates = Array.isArray(parsed?.items) ? parsed.items : [];
        extractedItems = candidates
          .map((p: any) => {
            const extracted = String(p?.text || '').trim();
            if (!extracted || !isGroundedInInput(extracted, extractedText)) return null;

            let itemType = p?.type || 'claim';
            // Safety guard: questions explicitly asking about Quranic verses or tafsir cannot be fiqh questions
            if (/(?:^|\s)(?:تفسير|ما\s*تفسير|معنى\s*الآية|معنى\s*قوله\s*تعالى|تأويل|بيان\s*الآية|ما\s+(?:هي\s+)?(?:الآية|الاية)|أين\s+(?:ورد|وردت|ذكرت)\s+(?:في\s+القرآن)?)(?:\s|$)/i.test(extracted)) {
              itemType = 'tafsir_question';
            } else if (/^(?:إنما|انما|طلب العلم|لا يؤمن|المسلم من|من غش)/i.test(extracted) && itemType !== 'hadith') {
              itemType = 'hadith';
            }

            const claimedSource = p?.claimed_source && isGroundedInInput(String(p.claimed_source), extractedText)
              ? String(p.claimed_source)
              : undefined;

            return {
              type: itemType,
              text: extracted,
              context: p?.context && isGroundedInInput(String(p.context), extractedText) ? String(p.context) : '',
              language: p?.language || 'ar',
              claimed_source: claimedSource,
              confidence: 0.95
            } as ExtractedItem;
          })
          .filter((x: ExtractedItem | null): x is ExtractedItem => Boolean(x));
      } catch (aiErr: any) {
        console.warn('Groq AI extraction failed, falling back to rule-based engine:', aiErr.message);
      }
    }


    // Always run rule-based extraction as well to ensure complete coverage of narratives and verses
    const ruleBasedItems = extractItemsRuleBased(extractedText);
    if (extractedItems.length === 0) {
      extractedItems = ruleBasedItems;
    } else {
      // Merge rule-based items with smart deduplication
      for (const rItem of ruleBasedItems) {
        const existingIdx = extractedItems.findIndex(
          it => normalizeArabic(it.text) === normalizeArabic(rItem.text) ||
            (it.text.length >= 10 && (normalizeArabic(it.text).includes(normalizeArabic(rItem.text)) || normalizeArabic(rItem.text).includes(normalizeArabic(it.text))))
        );

        if (existingIdx !== -1) {
          // If deterministic rule identified an Ayah, Hadith, or Tafsir question, upgrade generic or misclassified AI guess
          if (['ayah', 'hadith', 'tafsir_question', 'aqeedah_question'].includes(rItem.type)) {
            extractedItems[existingIdx].type = rItem.type;
            extractedItems[existingIdx].text = rItem.text;
            delete (extractedItems[existingIdx] as any).ai_match_hint;
          }
        } else {
          extractedItems.push(rItem);
        }
      }
    }

    // If user explicitly chose a target category (Quran, Hadith, Fiqh, Term),
    // align extracted items directly with their selection for maximum precision.
    if (targetCategory && targetCategory !== 'auto') {
      const normalizedCat = targetCategory === 'fiqh' ? 'fiqh_question' : targetCategory;
      const validTypes: Array<ExtractedItem['type']> = [
        'ayah',
        'hadith',
        'fiqh_question',
        'term'
      ];
      if (validTypes.includes(normalizedCat as any)) {
        const selectedType = normalizedCat as ExtractedItem['type'];
        const scope = selectedType === 'ayah'
          ? 'quran'
          : selectedType === 'hadith'
            ? 'hadith'
            : selectedType === 'tafsir_question'
              ? 'tafsir'
              : selectedType === 'aqeedah_question'
                ? 'aqeedah'
                : selectedType === 'term'
                  ? 'term'
                  : 'fiqh';

        // The user's explicit choice means this entire submitted payload is
        // one verification item against one approved source.
        extractedItems = [{
          type: selectedType,
          text: extractedText,
          context: extractedText,
          language: /[a-zA-Z]/.test(extractedText) ? 'en' : 'ar',
          confidence: 0.99,
          verification_scope: scope
        } as ExtractedItem & { verification_scope: string }];
      }
    }

    // Prioritize specific religious questions and primary evidence first
    const typePriority: Record<string, number> = {
      ayah: 1,
      hadith: 2,
      fiqh_question: 3,
      tafsir_question: 4,
      aqeedah_question: 5,
      term: 6,
      claim: 7
    };
    extractedItems.sort((a, b) => (typePriority[a.type] || 99) - (typePriority[b.type] || 99));

    // AI semantic matching is advisory: it can propose the most likely source
    // candidate, but the canonical verifier below remains the final authority.
    if (aiEnabled && (!targetCategory || targetCategory === 'auto')) {
      await applyAISemanticMatching(extractedItems);
    }

    // Run the deterministic/source-first verifier after AI candidate selection.
    const report = verifyExtractedItems(extractedItems, extractedText, inputType);

    // AI provenance remains available on verification.ai_match for progressive disclosure.


    // ── UNIFIED APPROVED SOURCES LIVE SEARCH ──────────────────────────────
    for (const v of report.verifications) {
      await resolveVerificationWithLiveSearch(v, extractedText);

      // Final deterministic policy gate: a MATCHED result must have actual
      // source-returned evidence and a valid, source-specific citation.
      const policy = enforceDecisionPolicy({
        result: v,
        sourceEvidenceValidated: Boolean(
          v.canonical_text?.trim() &&
          v.citation?.url &&
          isApprovedCitation(v.citation)
        )
      });

      if (policy.status !== v.status) {
        v.status = policy.status;
        if (policy.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
          v.status_label_ar = 'لم يُثبت في المصدر المعتمد — امتناع';
          v.status_label_en = 'Not Proven in Approved Source — Abstention';
          v.reason = 'منعت سياسة القرار النتيجة لأن الدليل المصدرّي المطلوب أو التتبع الكامل غير مكتمل.';
          delete v.canonical_text;
          delete v.verified_translation;
          delete v.school_positions;
          delete v.diff;
        }
      }
    }

    // ── RECALCULATE OVERALL STATUS & STATISTICS ────────────────────────────
    let matchedCount = 0;
    let needsReviewCount = 0;
    let notFoundCount = 0;
    let referralCount = 0;

    for (const v of report.verifications) {
      if (v.status === 'MATCHED') matchedCount++;
      else if (v.status === 'NEEDS_REVIEW') needsReviewCount++;
      else if (v.status === 'NOT_FOUND_IN_CHECKED_SOURCES') notFoundCount++;
      else if (v.status === 'REFER_TO_SPECIALIST') referralCount++;
    }

    report.verifier_stats = {
      matched_count: matchedCount,
      needs_review_count: needsReviewCount,
      not_found_count: notFoundCount,
      referral_count: referralCount
    };

    const alteredQuranCount = report.verifications.filter((v: any) => v.finding_type === 'altered_quran_text').length;

    if (referralCount > 0) {
      report.overall_status = 'REFER_TO_SPECIALIST';
      report.summary_ar = `إحالة شرعية: يتضمن المحتوى مسائل فقهية أو حالات شخصية تتطلب استشارة أهل الاختصاص والهيئات الإفتائية المعتمدة.`;
      report.summary_en = `Specialist Referral: Input contains legal/personal queries that require direct qualified religious consultation.`;
    } else if (alteredQuranCount > 0) {
      report.overall_status = 'NEEDS_REVIEW';
      report.summary_ar = `تم رصد تحريف في ${alteredQuranCount} نص قرآني: النص لا يطابق المصحف المعتمد، ولا يجوز عرضه على أنه آية مطابقة.`;
      report.summary_en = `Altered Quranic wording detected in ${alteredQuranCount} item(s): the text does not match the approved Quranic corpus.`;
    } else if (needsReviewCount > 0) {
      report.overall_status = 'NEEDS_REVIEW';
      report.summary_ar = `تنبيه: يتضمن المحتوى عناصر تحتاج لمراجعة ودقة في النقل (${needsReviewCount} عناصر) لتجنب الخلط أو الخطأ في العزو.`;
      report.summary_en = `Alert: Input contains items requiring review (${needsReviewCount} items) to prevent misattribution or textual drift.`;
    } else if (notFoundCount > 0 && matchedCount === 0) {
      report.overall_status = 'NOT_FOUND_IN_CHECKED_SOURCES';
      report.summary_ar = `امتناع: لم يتم العثور على النصوص المدخلة في نطاق المراجع المفحوصة (القرآن، السنة، الجمهرة).`;
      report.summary_en = `Abstention: Text not found within checked reference corpora.`;
    } else if (matchedCount > 0 && notFoundCount === 0) {
      report.overall_status = 'MATCHED';
      report.summary_ar = `تم التحقق بنجاح: جميع العناصر (${matchedCount}) موثقة ومطابقة للمصادر المعتمدة في السنة والقرآن والدرر السنية.`;
      report.summary_en = `Verified successfully: all (${matchedCount}) items match approved sources.`;
    } else {
      report.overall_status = 'NEEDS_REVIEW';
    }
    // ────────────────────────────────────────────────────────────────────────

    enforceApprovedCitations(report);
    // Image/audio capture is not itself proof that the transcription is exact.
    // Keep any source-backed result visible, but require review unless capture was explicitly verified.
    const inputCaptureVerified = false;
    if (inputType === 'image' || inputType === 'audio') {
      for (const verification of report.verifications) {
        if (verification.status === 'MATCHED') {
          verification.status = 'NEEDS_REVIEW';
          verification.status_label_ar = 'النص المستخرج مطابق للمصدر، لكن التحقق من دقة التفريغ يحتاج مراجعة بشرية';
          verification.status_label_en = 'Source match found; capture/transcription still requires human review';
          verification.reason = `${verification.reason} دقة التفريغ من الصورة/الصوت ليست دليلاً مصدرّياً كافياً لإصدار مطابقة نهائية؛ لذلك تتطلب مراجعة بشرية.`;
        }
      }
      if (report.verifications.some((v: any) => v.status === 'NEEDS_REVIEW')) {
        report.overall_status = 'NEEDS_REVIEW';
      }
    }

    res.json({ success: true, report });
  } catch (error: any) {
    console.error('[BASEERA][VERIFY][ERROR]', JSON.stringify({ requestId, message: error?.message || String(error), stack: error?.stack }));
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء فحص المحتوى.' });
  }
});

// 2a. Live source readiness check for judging/demo environments.
app.get('/api/source-smoke', async (_req, res) => {
  const checks = await Promise.all([
    (async () => {
      try {
        const rows = await searchDorarApiLive('إنما الأعمال بالنيات');
        return { source_id: 'dorar-hadith', ok: rows.length > 0, detail: 'results=' + rows.length };
      } catch (e: any) {
        return { source_id: 'dorar-hadith', ok: false, detail: e.message || 'error' };
      }
    })(),
    (async () => {
      try {
        const row = await searchDorarFiqhLive('نقض الوضوء بلمس المرأة');
        return { source_id: 'fiqh-madhahib-dorar', ok: Boolean(row?.found), detail: 'found=' + Boolean(row?.found) };
      } catch (e: any) {
        return { source_id: 'fiqh-madhahib-dorar', ok: false, detail: e.message || 'error' };
      }
    })(),
    (async () => {
      try {
        const row = await searchDorarTafsirLive('تفسير سورة الفاتحة');
        return { source_id: 'quran-tafsir-salaf', ok: Boolean(row?.found), detail: 'found=' + Boolean(row?.found) };
      } catch (e: any) {
        return { source_id: 'quran-tafsir-salaf', ok: false, detail: e.message || 'error' };
      }
    })(),
    (async () => {
      try {
        const row = await searchDorarAqeedahLive('التوحيد');
        return { source_id: 'dorar-aqeedah', ok: Boolean(row?.found), detail: 'found=' + Boolean(row?.found) };
      } catch (e: any) {
        return { source_id: 'dorar-aqeedah', ok: false, detail: e.message || 'error' };
      }
    })(),
    (async () => {
      try {
        const row = await searchJamharaLive('التوحيد');
        return { source_id: 'jamhara-terms', ok: Boolean(row?.found), detail: 'found=' + Boolean(row?.found) };
      } catch (e: any) {
        return { source_id: 'jamhara-terms', ok: false, detail: e.message || 'error' };
      }
    })(),
    (async () => {
      try {
        const langs = await getAvailableTranslationLanguages(1, 1);
        return { source_id: 'quran-translations', ok: Array.isArray(langs) && langs.length > 0, detail: 'languages=' + (Array.isArray(langs) ? langs.length : 0) };
      } catch (e: any) {
        return { source_id: 'quran-translations', ok: false, detail: e.message || 'error' };
      }
    })()
  ]);

  res.json({
    success: true,
    checked_at: new Date().toISOString(),
    all_ok: checks.every(x => x.ok),
    checks
  });
});

// 2b. Direct Dorar.net Live Search API Endpoint
app.get('/api/dorar/search', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'يرجى تقديم استعلام للبحث.' });
    }
    const results = await searchDorarApiLive(q);
    res.json({
      success: true,
      query: q,
      count: results.length,
      source: 'الموسوعة الحديثية — الدرر السنية (dorar.net)',
      results
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل البحث في الدرر السنية.' });
  }
});

// 2c. Live approved source APIs: Quranpedia translations + Dorar tafsir/aqeedah
app.get('/api/quran/translations', async (req, res) => {
  try {
    const surah = Number(req.query.surah);
    const ayah = Number(req.query.ayah);
    const language = typeof req.query.language === 'string' ? req.query.language.trim() : undefined;
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
      return res.status(400).json({ error: 'يرجى تقديم رقم السورة والآية بشكل صحيح.' });
    }

    const data = await getAyahTranslations(surah, ayah, language);
    const languages = language ? [] : await getAvailableTranslationLanguages(surah, ayah);
    res.json({
      success: true,
      source: 'Quranpedia — quranpedia.net',
      surah,
      ayah,
      language: language || null,
      available_languages: languages,
      translations: data
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'تعذر الوصول إلى خدمة ترجمات القرآن المعتمدة.' });
  }
});

app.get('/api/dorar/aqeedah', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'يرجى تقديم سؤال أو موضوع عقدي.' });
    const result = await searchDorarAqeedahLive(q);
    res.json({
      success: true,
      source_id: 'dorar-aqeedah',
      source: 'الموسوعة العقدية — الدرر السنية',
      found: Boolean(result?.found),
      title: result?.title || '',
      text: result?.text || '',
      url: result?.url || buildDorarAqeedahUrl(q)
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'تعذر البحث في الموسوعة العقدية.' });
  }
});

app.get('/api/dorar/tafseer', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'يرجى تقديم سؤال أو موضوع تفسيري.' });
    const result = await searchDorarTafsirLive(q);
    res.json({
      success: true,
      source_id: 'quran-tafsir-salaf',
      source: 'موسوعة التفسير — الدرر السنية',
      found: Boolean(result?.found),
      title: result?.title || '',
      text: result?.text || '',
      url: result?.url || buildDorarTafsirUrl(q)
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'تعذر البحث في موسوعة التفسير.' });
  }
});

// 2c. Dorar.net Fiqh Encyclopedia (feqhia) Search API Endpoint
// Separate from /api/dorar/search (Hadith) — Fiqh questions require the Fiqh Encyclopedia
app.get('/api/dorar/feqhia', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'يرجى تقديم استعلام للبحث في الموسوعة الفقهية.' });
    }
    const result = await searchDorarFiqhLive(q);
    const fiqhUrl = buildDorarFiqhUrl(q);
    if (result) {
      res.json({
        success: true,
        query: q,
        source: 'الموسوعة الفقهية المقارنة — الدرر السنية (dorar.net/feqhia)',
        found: result.found,
        text: result.text,
        url: result.url || fiqhUrl
      });
    } else {
      // API blocked by Cloudflare — return the correct search URL so user can visit directly
      res.json({
        success: true,
        query: q,
        source: 'الموسوعة الفقهية المقارنة — الدرر السنية (dorar.net/feqhia)',
        found: false,
        text: '',
        url: fiqhUrl,
        note: 'API محجوب — ابحث مباشرةً في الرابط المرفق'
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل البحث في الموسوعة الفقهية.' });
  }
});


async function performExtensionLookup(text: string, context: string = ''): Promise<{
  report: any;
  overall_status: string;
  summary: string;
}> {
  let items = extractItemsRuleBased(text);
  if (items.length === 0 && context) {
    items = extractItemsRuleBased(context);
  }

  if (items.length === 0) {
    items = [{
      type: 'claim',
      text: text.trim(),
      context: context || text,
      language: /[a-zA-Z]/.test(text) ? 'en' : 'ar',
      confidence: 0.8
    }];
  } else if (context) {
    items = items.map(it => ({
      ...it,
      context: `${it.context || ''} ${context}`.trim()
    }));
  }

  const report = verifyExtractedItems(items, context || text, 'text');

  // Live source retrieval + deterministic final decision policy.
  for (const v of report.verifications) {
    await resolveVerificationWithLiveSearch(v, context || text);

    const policy = enforceDecisionPolicy({
      result: v,
      sourceEvidenceValidated: Boolean(
        v.canonical_text?.trim() &&
        v.citation?.url &&
        isApprovedCitation(v.citation)
      )
    });

    if (policy.status !== v.status) {
      v.status = policy.status;
      if (policy.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
        v.status_label_ar = 'لم يُثبت في المصدر المعتمد — امتناع';
        v.status_label_en = 'Not Proven in Approved Source — Abstention';
        v.reason = 'منعت سياسة القرار النتيجة لأن الدليل المصدرّي المطلوب أو التتبع الكامل غير مكتمل.';
        delete v.canonical_text;
        delete v.school_positions;
        delete v.diff;
      }
    }
  }

  // Recalculate overall status & summary
  let matchedCount = 0;
  let needsReviewCount = 0;
  let notFoundCount = 0;
  let referralCount = 0;

  for (const v of report.verifications) {
    if (v.status === 'MATCHED') matchedCount++;
    else if (v.status === 'NEEDS_REVIEW') needsReviewCount++;
    else if (v.status === 'NOT_FOUND_IN_CHECKED_SOURCES') notFoundCount++;
    else if (v.status === 'REFER_TO_SPECIALIST') referralCount++;
  }

  if (referralCount > 0) {
    report.overall_status = 'REFER_TO_SPECIALIST';
    report.summary_ar = 'إحالة شرعية: يتطلب المحتوى مراجعة أهل الاختصاص والهيئات الإفتائية المعتمدة.';
  } else if (needsReviewCount > 0) {
    report.overall_status = 'NEEDS_REVIEW';
    report.summary_ar = `تنبيه: يتضمن المحتوى عناصر تحتاج لمراجعة ودقة في النقل (${needsReviewCount} عناصر).`;
  } else if (notFoundCount > 0 && matchedCount === 0) {
    report.overall_status = 'NOT_FOUND_IN_CHECKED_SOURCES';
    report.summary_ar = 'امتناع: لم يتم العثور على النصوص المدخلة في نطاق المراجع المفحوصة.';
  } else if (matchedCount > 0 && notFoundCount === 0) {
    report.overall_status = 'MATCHED';
    report.summary_ar = 'تم التحقق بنجاح: النص مطابق وموثق في المصادر المعتمدة.';
  }

  return {
    report: report.verifications[0] || null,
    overall_status: report.overall_status,
    summary: report.summary_ar
  };
}

app.post('/api/extension-lookup', async (req, res) => {
  const { text, context = '' } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  const lookupResult = await performExtensionLookup(text, context);
  res.json({
    success: true,
    term: text,
    report: lookupResult.report,
    overall_status: lookupResult.overall_status,
    summary: lookupResult.summary
  });
});

// Image lookup via OCR + Dorar Verification
app.post('/api/extension-lookup-image', async (req, res) => {
  try {
    const { imageUrl, imageBase64, mediaMimeType = 'image/jpeg' } = req.body;
    let base64 = imageBase64;
    let mimeType = mediaMimeType;

    // 1. Fetch image from URL if base64 not provided directly
    if (!base64 && imageUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const imgRes = await fetchRemoteSafely(imageUrl, { signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        });
        clearTimeout(timeout);
        if (imgRes.ok) {
          const imageBuffer = await readBytesWithLimit(imgRes, 10_000_000);
          base64 = imageBuffer.toString('base64');
          mimeType = imgRes.headers.get('content-type') || mimeType;
        }
      } catch (fetchErr) {
        console.warn('Failed to fetch image directly by URL:', fetchErr);
      }
    }

    if (!base64) {
      return res.status(400).json({ error: 'لم يتم توفير رابط الصورة أو بياناتها (Base64).' });
    }

    // 2. Perform OCR (Groq Qwen Vision, fallback to Tesseract.js)
    let extractedText = '';
    if (aiEnabled) {
      try {
        extractedText = await groqVisionText(
          base64,
          mimeType,
          'أنت نظام OCR متقدم لمشروع بصيرة. استخرج كل النصوص العربية المكتوبة في هذه الصورة حرفياً قدر الإمكان دون اختلاق أو زيادة أو تفسير. أعد النص المكتوب فقط.',
          15000
        );
      } catch (groqErr: any) {
        console.warn('Groq OCR error for image extension:', groqErr.message);
      }
    }

    if (!extractedText) {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('ara');
        const fullDataUri = base64.startsWith('data:')
          ? base64
          : `data:${mimeType};base64,${base64}`;
        const ret = await worker.recognize(fullDataUri);
        await worker.terminate();
        const rawOcr = (ret.data?.text || '').trim();
        extractedText = rawOcr
          .replace(/\b[A-Za-z]{1,5}\b/g, '')
          .replace(/[)\]}][0-9]\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      } catch (tessErr) {
        console.warn('Tesseract OCR error:', tessErr);
      }
    }

    if (!extractedText) {
      return res.status(400).json({
        error: 'لم يتمكن المحرك من استخراج نص عربي مقروء من الصورة. يرجى التأكد من وضوح الصورة ودقة الخط.'
      });
    }

    // 3. Run verification on extracted text
    const lookupResult = await performExtensionLookup(extractedText);
    if (lookupResult.report && lookupResult.report.status === 'MATCHED') {
      lookupResult.report.status = 'NEEDS_REVIEW';
      lookupResult.report.status_label_ar = 'النص المستخرج من الصورة مطابق للمصدر، لكن دقة OCR تحتاج مراجعة بشرية';
      lookupResult.report.status_label_en = 'Image text matches source, but OCR still requires human review';
      lookupResult.report.reason = `${lookupResult.report.reason} لم يُعتبر استخراج الصورة دليلاً آلياً بنسبة 100%.`;
      lookupResult.overall_status = 'NEEDS_REVIEW';
      lookupResult.summary = 'تنبيه: وُجد تطابق في المصدر، لكن دقة استخراج النص من الصورة تحتاج مراجعة بشرية.';
    }
    enforceApprovedCitations({ verifications: lookupResult.report ? [lookupResult.report] : [] });
    res.json({
      success: true,
      extractedText,
      report: lookupResult.report,
      overall_status: lookupResult.overall_status,
      summary: lookupResult.summary
    });
  } catch (err: any) {
    console.error('Extension image lookup error:', err);
    res.status(500).json({ error: err.message || 'فشلت معالجة صورة الحديث.' });
  }
});

// 4. Benchmark API (Returns frozen benchmark run & 4-system comparative analysis)
let cachedComparativeBenchmark: any = null;

app.get('/api/benchmark', (_req, res) => {
  try {
    if (!cachedComparativeBenchmark) {
      cachedComparativeBenchmark = getComparativeBenchmarkResults();
    }
    res.json({
      success: true,
      data: cachedComparativeBenchmark
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4b. Approved Islamic Content MCP (islamic-content-mcp) — live client.
// Endpoint: https://mcp.islamiccontent.org/mcp (Streamable HTTP, read-only).
// Exposes source retrieval only; it never issues fatwas or authors content.
let cachedMcpStatus: any = null;
let cachedMcpStatusAt = 0;

app.get('/api/mcp/islamic-content/status', async (_req, res) => {
  try {
    const now = Date.now();
    if (!cachedMcpStatus || now - cachedMcpStatusAt > 5 * 60 * 1000) {
      cachedMcpStatus = await getIslamicContentMcpStatus();
      cachedMcpStatusAt = now;
    }
    res.json({ success: true, ...cachedMcpStatus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/mcp/islamic-content/call', async (req, res) => {
  try {
    const { tool, arguments: toolArgs } = req.body || {};
    if (!tool || typeof tool !== 'string') {
      return res.status(400).json({ success: false, error: 'اسم الأداة (tool) مطلوب.' });
    }
    const result = await callIslamicContentTool(tool, toolArgs || {});
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// 5. Dawah Content & Friday Khutbah Studio API (صانع المحتوى الدعوي والخطب)
// Adheres strictly to the Scientific Package:
// Generates draft strictly from verified sources (dawa.center, King Fahd Quran, Dorar Hadith, Jamhara)
// and runs internal Baseera verification on the draft before final delivery.
app.post('/api/dawah/generate', async (req, res) => {
  try {
    const requestData: DawahContentRequest = req.body;
    if (!requestData || !requestData.topic || !requestData.topic.trim()) {
      return res.status(400).json({ error: 'يرجى تحديد موضوع الخطبة أو المقال الدعوي.' });
    }

    // Step 1: Generate structured Dawah Content from verified sources
    const content = await generateDawahContent(requestData);

    // Step 2: Verify the generated draft through the same live resolution layer
    // used by the main verifier. Generation never bypasses source policy.
    const fullArabicDraft = content.sections.map(s => `${s.section_label_ar}\n${s.content_ar}`).join('\n\n');
    const extractedItems = extractItemsRuleBased(fullArabicDraft);
    const verificationReport = verifyExtractedItems(extractedItems, fullArabicDraft, 'text');

    for (const verification of verificationReport.verifications) {
      await resolveVerificationWithLiveSearch(verification, fullArabicDraft);
    }
    enforceApprovedCitations(verificationReport);

    let draftMatched = 0;
    let draftReview = 0;
    let draftNotFound = 0;
    let draftReferral = 0;
    for (const verification of verificationReport.verifications) {
      if (verification.status === 'MATCHED') draftMatched++;
      else if (verification.status === 'NEEDS_REVIEW') draftReview++;
      else if (verification.status === 'NOT_FOUND_IN_CHECKED_SOURCES') draftNotFound++;
      else if (verification.status === 'REFER_TO_SPECIALIST') draftReferral++;
    }

    verificationReport.verifier_stats = {
      matched_count: draftMatched,
      needs_review_count: draftReview,
      not_found_count: draftNotFound,
      referral_count: draftReferral
    };

    if (draftReferral > 0) {
      verificationReport.overall_status = 'REFER_TO_SPECIALIST';
    } else if (draftReview > 0) {
      verificationReport.overall_status = 'NEEDS_REVIEW';
    } else if (draftNotFound > 0 && draftMatched === 0) {
      verificationReport.overall_status = 'NOT_FOUND_IN_CHECKED_SOURCES';
    } else {
      verificationReport.overall_status = draftMatched > 0 ? 'MATCHED' : 'NOT_FOUND_IN_CHECKED_SOURCES';
    }

    // Step 3: Fail closed if any generated citation violates source policy.
    if (content.all_citations.some(citation => !isApprovedCitation({
      source_id: citation.source_id,
      url: citation.source_url
    }))) {
      return res.status(500).json({
        error: 'توقفت المنظومة: توجد إحالة في المحتوى الدعوي لا تطابق سياسة المصادر المعتمدة.'
      });
    }

    // Step 4: Format plain text and generate high-res SVG infographic card
    const formattedText = formatContentAsText(content);
    const infographicSvg = generateInfographicSvg(content);

    res.json({
      success: true,
      content,
      formatted_text: formattedText,
      infographic_svg: infographicSvg,
      verification_report: verificationReport
    });
  } catch (err: any) {
    console.error('Dawah Studio generation error:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ أثناء إعداد وتوثيق المحتوى الدعوي.' });
  }
});

// 5b. Infographic SVG Direct Export API
app.post('/api/dawah/svg', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'بيانات المحتوى مطلوبة لتوليد البطاقة.' });
    }
    const svg = generateInfographicSvg(content);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `inline; filename="baseera-dawah-${encodeURIComponent(content.topic || 'card')}.svg"`);
    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل توليد البطاقة الدعوية بصيغة SVG.' });
  }
});

// Start dev server with Vite middlewares
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Baseera] Backend and Dev server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
