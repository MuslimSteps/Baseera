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
import quranData from './sources/quran.json' with { type: 'json' };
import termData from './sources/terminology.json' with { type: 'json' };
import fiqhData from './sources/fiqh.json' with { type: 'json' };

import { extractItemsRuleBased } from './src/lib/extractor.ts';
import { verifyExtractedItems } from './src/lib/decisionEngine.ts';
import { isSensitiveFiqhQuestion } from './src/lib/fiqhEngine.ts';
import { enforceApprovedCitations, isApprovedCitation } from './src/lib/sourcePolicy.ts';
import { isGroundedInInput } from './src/lib/inputGrounding.ts';
import { getAvailableTranslationLanguages, getAyahTranslations } from './src/lib/quranpediaClient.ts';
import { searchDorarAqeedahLive, searchDorarTafsirLive } from './src/lib/dorarEncyclopediaClient.ts';
import { buildDorarAqeedahUrl, buildDorarTafsirUrl } from './src/lib/dorarQueryUtils.ts';
import { buildJamharaSearchUrl, searchJamharaLive } from './src/lib/jamharaClient.ts';
import { buildHadithDecision } from './src/lib/hadithVerifier.ts';
import { normalizeArabic, normalizeArabicStrict } from './src/lib/normalizer.ts';
import { getComparativeBenchmarkResults } from './src/lib/benchmarkRunner.ts';
import { searchDorarApiLive, searchDorarWithSmartQueries, searchDorarFiqhLive, buildDorarFiqhUrl, cleanSearchQuery, generateFiqhSearchKeywords } from './src/lib/dorarClient.ts';
import { generateDawahContent, formatContentAsText, generateInfographicSvg, DawahContentRequest } from './src/lib/dawahGenerator.ts';
import { ExtractedItem } from './src/types/baseera.ts';
import { fetchRemoteSafely, readTextWithLimit, readBytesWithLimit } from './src/lib/safeRemoteFetch.ts';
import { getQuranCandidatesForAI } from './src/lib/quranVerifier.ts';
import { rankCandidatesWithAI } from './src/lib/aiMatcher.ts';
import { groqChat, groqVisionText, groqTranscribe, GROQ_TEXT_MODEL, GROQ_VISION_MODEL } from './src/lib/groqClient.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Groq AI is configured server-side. Secrets are never accepted from request bodies.
const aiEnabled = Boolean(process.env.GROQ_API_KEY?.trim());

// 1. Source Registry API
app.get('/api/sources', (_req, res) => {
  res.json({
    registry: sourceRegistry,
    stats: {
      quran_verses_indexed: quranData.verses.length,
      hadith_verification_mode: 'live_dorar_only',
      terms_indexed: termData.terms.length,
      fiqh_topics_indexed: fiqhData.topics.length,
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
      coverage_note: 'الترجمات المحلية الإنجليزية فقط، مع استعلام حي للغات المتاحة في Quranpedia لكل آية؛ التفسير والعقيدة لهما مسارات مصدرية حية؛ الشاملة ما زالت مرجعاً مسجلاً بلا موصل مستقل.'
    }
  });
});

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
  try {
    const { text, inputType = 'text', mediaBase64, mediaMimeType, url } = req.body;
    let extractedText = (text || '').trim();

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

    if (aiEnabled && extractedText.length > 10) {
      try {
        const aiRaw = await groqChat(
          [{
            role: 'user',
            content: `أنت طبقة الاستخراج في منظومة «بصيرة» للتحقق من المحتوى الإسلامي وسياقه.

مهمتك استخراج العناصر الدينية فقط، لا إصدار حكم شرعي ولا إثبات صحة شيء.
استخرج الآيات، الأحاديث، المصطلحات الحساسة، الأسئلة الفقهية، وأي عزو/سياق ذي صلة.
إذا لم تكن متأكداً من النوع، استخدم claim.
لا تضف نصاً غير موجود في المدخل.

المدخل:
"""
${extractedText}
"""

أعد JSON بهذا الشكل فقط:
{
  "items": [
    {
      "type": "ayah | hadith | term | fiqh_question | claim",
      "text": "النص المستخرج حرفياً من المدخل",
      "context": "السياق الحرفي الموجود في المدخل",
      "language": "ar | en | fr",
      "claimed_source": "العزو المذكور في المدخل إن وجد"
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

            const claimedSource = p?.claimed_source && isGroundedInInput(String(p.claimed_source), extractedText)
              ? String(p.claimed_source)
              : undefined;

            return {
              type: p?.type || 'claim',
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
      // Merge any rule-based items that weren't captured by AI
      for (const rItem of ruleBasedItems) {
        const alreadyCaptured = extractedItems.some(
          it => it.type === rItem.type && (it.text.includes(rItem.text.slice(0, 25)) || rItem.text.includes(it.text.slice(0, 25)))
        );
        if (!alreadyCaptured) {
          extractedItems.push(rItem);
        }
      }
    }

    // Prioritize hadith / primary narrative first
    extractedItems.sort((a, b) => {
      if (a.type === 'hadith' && b.type === 'ayah') return -1;
      if (a.type === 'ayah' && b.type === 'hadith') return 1;
      return 0;
    });

    // AI semantic matching is advisory: it can propose the most likely source
    // candidate, but the canonical verifier below remains the final authority.
    if (aiEnabled) {
      await applyAISemanticMatching(extractedItems);
    }

    // Run the deterministic/source-first verifier after AI candidate selection.
    const report = verifyExtractedItems(extractedItems, extractedText, inputType);

    // Preserve AI provenance without treating its confidence as proof.
    for (const verification of report.verifications) {
      const hint = (verification.item as any).ai_match_hint;
      if (hint?.candidate_id) {
        verification.ai_match = {
          provider: 'groq',
          candidate_id: hint.candidate_id,
          relation: hint.relation,
          confidence: hint.confidence
        };
        verification.reason = `اقتراح المطابقة الدلالية بالذكاء الاصطناعي: ${hint.candidate_id} (ثقة النموذج ${Math.round(hint.confidence * 100)}٪). النتيجة النهائية أدناه حُسمت من المصدر المرجعي لا من النموذج.${verification.reason ? ' ' + verification.reason : ''}`;
      }
    }

    // ── UNIFIED APPROVED SOURCES LIVE SEARCH ──────────────────────────────
    for (const v of report.verifications) {
      await resolveVerificationWithLiveSearch(v, extractedText);
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
    console.error('Verification error:', error);
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

  // Dorar live fallback — routes to CORRECT canonical source per item type
  for (const v of report.verifications) {
    await resolveVerificationWithLiveSearch(v, context || text);
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
