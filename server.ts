/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

import sourceRegistry from './sources/source-registry.json' with { type: 'json' };
import quranData from './sources/quran.json' with { type: 'json' };
import hadithData from './sources/hadith.json' with { type: 'json' };
import termData from './sources/terminology.json' with { type: 'json' };
import fiqhData from './sources/fiqh.json' with { type: 'json' };

import { extractItemsRuleBased } from './src/lib/extractor.ts';
import { verifyExtractedItems } from './src/lib/decisionEngine.ts';
import { buildHadithDecision } from './src/lib/hadithVerifier.ts';
import { getComparativeBenchmarkResults } from './src/lib/benchmarkRunner.ts';
import { searchDorarApiLive, searchDorarWithSmartQueries, searchDorarFiqhLive, buildDorarFiqhUrl, cleanSearchQuery, generateFiqhSearchKeywords } from './src/lib/dorarClient.ts';
import { generateDawahContent, formatContentAsText, generateInfographicSvg, DawahContentRequest } from './src/lib/dawahGenerator.ts';
import { ExtractedItem } from './src/types/baseera.ts';
import { fetchRemoteSafely, readTextWithLimit, readBytesWithLimit } from './src/lib/safeRemoteFetch.ts';

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

// Initialize Google Gen AI
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI();
  } catch (err) {
    console.warn('GoogleGenAI initialization warning:', err);
  }
}

// 1. Source Registry API
app.get('/api/sources', (_req, res) => {
  res.json({
    registry: sourceRegistry,
    stats: {
      quran_verses_indexed: quranData.verses.length,
      hadiths_indexed: hadithData.hadiths.length,
      terms_indexed: termData.terms.length,
      fiqh_topics_indexed: fiqhData.topics.length
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

// 1c. Dedicated Image OCR API (Supports Gemini Vision + Tesseract.js local fallback)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { mediaBase64, mediaMimeType = 'audio/mpeg', apiKey } = req.body;
    if (!mediaBase64 || !String(mediaMimeType).startsWith('audio/')) {
      return res.status(400).json({ error: 'يرجى توفير ملف صوتي صالح.' });
    }
    const activeKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeKey || activeKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({ error: 'ميزة تحويل الصوت تحتاج مفتاح Gemini على الخادم أو مفتاحاً محلياً صالحاً.' });
    }
    const raw = String(mediaBase64);
    const headerMatch = raw.match(/^data:([^;]+);base64,(.+)$/s);
    const cleanBase64 = headerMatch ? headerMatch[2] : raw;
    const estimatedBytes = Math.floor(cleanBase64.length * 0.75);
    if (estimatedBytes > 15_000_000) {
      return res.status(413).json({ error: 'حجم الملف الصوتي أكبر من الحد المسموح.' });
    }
    const client = new GoogleGenAI({ apiKey: activeKey });
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [
        { inlineData: { data: cleanBase64, mimeType: mediaMimeType } },
        { text: 'حوّل هذا التسجيل الصوتي إلى نص حرفي قدر الإمكان، مع الحفاظ على العربية والأسماء والآيات والأحاديث دون إضافة أو تفسير. أعد النص فقط.' }
      ] }]
    });
    const text = response.text?.trim() || '';
    if (!text) return res.status(400).json({ error: 'لم يتم استخراج نص من التسجيل الصوتي.' });
    res.json({ success: true, text, method: 'gemini-audio' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل تحويل الصوت إلى نص.' });
  }
});

app.post('/api/ocr', async (req, res) => {
  try {
    const { mediaBase64, mediaMimeType = 'image/jpeg', apiKey } = req.body;
    if (!mediaBase64) {
      return res.status(400).json({ error: 'لم يتم توفير بيانات الصورة.' });
    }

    const activeKey = apiKey || process.env.GEMINI_API_KEY;
    let extractedText = '';
    let methodUsed = '';

    // 1. Try Gemini Vision if key available
    if (activeKey && activeKey !== 'MY_GEMINI_API_KEY') {
      try {
        const client = new GoogleGenAI({ apiKey: activeKey });
        const cleanBase64 = mediaBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
        const resp = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mediaMimeType
                  }
                },
                {
                  text: 'أنت نظام OCR متقدم لمشروع بصيرة. استخرج كل النصوص العربية المكتوبة في هذه الصورة بدقة وبنفس كلماتها وحروفها بالضبط دون أي اختلاق أو زيادة. أعد النص المكتوب فقط.'
                }
              ]
            }
          ]
        });
        extractedText = (resp.text || '').trim();
        if (extractedText) methodUsed = 'gemini';
      } catch (geminiErr: any) {
        console.warn('Gemini OCR error, falling back to local OCR:', geminiErr.message);
      }
    }

    // 2. Fallback to Tesseract.js (Local, zero API key required - Arabic optimized)
    if (!extractedText) {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('ara');
        const fullDataUri = mediaBase64.startsWith('data:')
          ? mediaBase64
          : `data:${mediaMimeType};base64,${mediaBase64}`;
        const ret = await worker.recognize(fullDataUri);
        await worker.terminate();
        const rawOcr = (ret.data?.text || '').trim();
        // Clean OCR artifacts: strip isolated English gibberish words and broken punctuation
        extractedText = rawOcr
          .replace(/\b[A-Za-z]{1,5}\b/g, '')
          .replace(/[)\]}][0-9]\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (extractedText) methodUsed = 'tesseract';
      } catch (tessErr: any) {
        console.warn('Tesseract OCR error:', tessErr);
      }
    }

    if (!extractedText) {
      return res.status(400).json({
        error: 'لم يتمكن المحرك من قراءة نص واضح داخل الصورة. يرجى التأكد من وضوح الصورة ودقة الخط، أو كتابة النص يدوياً.'
      });
    }

    res.json({
      success: true,
      text: extractedText,
      method: methodUsed
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشلت معالجة الصورة.' });
  }
});

/**
 * Master Verification Resolver with Live Dorar Encyclopedia Search
 * Unified across both Web Application (/api/verify) and Browser Extension (/api/extension-lookup)
 */
async function resolveVerificationWithLiveSearch(v: any, fullContext: string = ''): Promise<void> {
  const r = v as typeof v & { _needs_live_search?: boolean; _content_words?: string[]; _fiqh_url?: string };
  if (!r._needs_live_search) return;

  const queryToSearch = v.item.text.trim();
  const isFiqhQuestion = v.item.type === 'fiqh_question';

  try {
    if (isFiqhQuestion) {
      // ── FIQH PATH: Dorar Fiqh Encyclopedia (dorar.net/feqhia) ─────────────────
      const fiqhSearchUrl = r._fiqh_url || buildDorarFiqhUrl(queryToSearch);
      const contentWords: string[] = r._content_words || generateFiqhSearchKeywords(queryToSearch);
      
      // Step 1: Query Dorar Fiqh Encyclopedia (dorar.net/feqhia)
      const fiqhResult = await searchDorarFiqhLive(queryToSearch);

      if (fiqhResult?.found) {
        // ✅ Got live verified ruling from Dorar Fiqhia
        const rulingDetails = fiqhResult.detailedRuling
          ? fiqhResult.detailedRuling
          : (fiqhResult.text ? `${fiqhResult.title} — ${fiqhResult.text}` : fiqhResult.title);

        v.status = 'NEEDS_REVIEW';
        v.status_label_ar = 'مسألة فقهية موثقة المصدر — تحتاج مراجعة ولا تمثل فتوى آلية';
        v.status_label_en = 'Documented Ruling from Comparative Fiqh Encyclopedia (Dorar.net)';
        v.reason = `المسألة مفصلة وموثقة في الموسوعة الفقهية المقارنة بالدرر السنية وفق المذاهب الأربعة:\n«${fiqhResult.title}»\n\nنص الحكم الشرعي المعتمد والدليل من الموسوعة الفقهية:\n${rulingDetails}`;
        v.canonical_text = rulingDetails;
        v.decision_level = 'C';
        v.citation = {
          source_id: 'dorar-feqhia-live',
          source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية (بحث مباشر في المذاهب الأربعة)',
          authority: 'المذاهب الأربعة (الحنفي، المالكي، الشافعي، الحنبلي) — مؤسسة الدرر السنية',
          book: fiqhResult.title,
          url: fiqhResult.url || fiqhSearchUrl
        };
      } else {
        // Step 2: Feqhia has no direct article -> check Dorar Hadith API for supporting evidence
        const wordsForSearch = contentWords.length > 0
          ? contentWords.slice(0, 3).join(' ')
          : cleanSearchQuery(queryToSearch);

        const hadithSearch = await searchDorarWithSmartQueries(wordsForSearch || queryToSearch);

        if (hadithSearch.topResult) {
          const top = hadithSearch.topResult;
          const normH = (top.text || '')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/[إأآا]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه');

          // Strict match: Hadith MUST contain the primary content word
          const hasConfirmedWordMatch = contentWords.some(w => {
            const cleanW = w.replace(/^ال/, '').replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
            return cleanW.length >= 3 && normH.includes(cleanW);
          });

          if (hasConfirmedWordMatch) {
            if (top.isDisputed || top.gradeCategory === 'disputed') {
              v.status = 'NEEDS_REVIEW';
              v.status_label_ar = 'مسألة فقهية خلافية — الحديث الوارد فيها مختلف في صحته بين الأئمة';
              v.status_label_en = 'Disputed Fiqh Matter — Supporting Hadith is Disputed';
              v.reason = `المسألة محل اختلاف فقهي بين أئمة المذاهب؛ لاستنادها إلى حديث «${top.text}». ${top.disputeDetails || 'والحديث مختلف في ثبوته وصحته بين أئمة الحديث: صححه بعضهم واستنكره آخرون'}. المصدر: ${top.book} (${top.numberOrPage}).`;
              v.canonical_text = top.text;
              v.decision_level = 'C';
              v.citation = {
                source_id: 'dorar-hadith-fiqh',
                source_name: 'الموسوعة الحديثية — الدرر السنية (دليل المسألة الفقهية)',
                authority: 'مؤسسة الدرر السنية للإشراف العلمي',
                book: `${top.book} (${top.numberOrPage})`,
                grade: top.grade,
                url: `https://dorar.net/hadith/search?q=${encodeURIComponent(hadithSearch.queryUsed)}`
              };
            } else if (top.gradeCategory === 'sahih' || top.gradeCategory === 'hasan') {
              v.status = 'NEEDS_REVIEW';
              v.status_label_ar = 'مسألة فقهية لها دليل حديثي موثق — لا ترجيح آلي';
              v.status_label_en = 'Fiqh Ruling — Established by Authentic Sunnah (Dorar.net)';
              v.reason = `المسألة مستندة إلى الدليل الصريح من السنة النبوية المطهرة في الموسوعة الحديثية: «${top.text}». الراوي: ${top.rawi || 'الصحابة الكرام'}، المحدث: ${top.muhaddith || ''}، المصدر: ${top.book} (${top.numberOrPage})، خلاصة حكم المحدث: ${top.grade}.`;
              v.canonical_text = top.text;
              v.decision_level = 'B';
              v.citation = {
                source_id: 'dorar-hadith-fiqh',
                source_name: 'الموسوعة الحديثية — الدرر السنية (دليل المسألة الفقهية)',
                authority: 'مؤسسة الدرر السنية للإشراف العلمي',
                book: `${top.book} (${top.numberOrPage})`,
                grade: top.grade,
                url: `https://dorar.net/hadith/search?q=${encodeURIComponent(hadithSearch.queryUsed)}`
              };
            } else {
              v.status = 'NEEDS_REVIEW';
              v.status_label_ar = 'مسألة فقهية — الحديث الوارد في الموضوع ضعيف أو لا يصح';
              v.status_label_en = 'Fiqh Question — Supporting Hadith is Weak';
              v.reason = `وُجد حديث متعلق بالمسألة في الموسوعة الحديثية لكنه ${top.grade}، ولا يصح الاحتجاج به مستقلاً. الراوي: ${top.rawi || ''}، المصدر: ${top.book}.`;
              v.canonical_text = top.text;
              v.decision_level = 'C';
              v.citation = {
                source_id: 'dorar-hadith-fiqh',
                source_name: 'الموسوعة الحديثية — الدرر السنية',
                authority: 'مؤسسة الدرر السنية للإشراف العلمي',
                book: `${top.book} (${top.numberOrPage})`,
                grade: top.grade,
                url: `https://dorar.net/hadith/search?q=${encodeURIComponent(hadithSearch.queryUsed)}`
              };
            }
          } else {
            // Abstain honestly without irrelevant hadiths
            v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
            v.status_label_ar = 'لم يُعثر عليه في المراجع المفحوصة (امتناع شرعي)';
            v.status_label_en = 'Not Found in Checked Sources (Abstention)';
            v.reason = 'لم يُعثر على نص قطعي أو حديث صريح مطابق لهذه المسألة في المصادر المعتمدة المفحوصة (الموسوعة الفقهية والحديثية). تلتزم منظومة «بصيرة» بالامتناع الصارم عن إصدار أي حكم شرعي أو عزو أحاديث غير مطابقة منعاً للهلوسة والخطأ في دين الله. يمكنك البحث في الموسوعة الفقهية المقارنة بالدرر السنية عبر الرابط المرفق.';
            v.decision_level = 'C';
            v.citation = {
              source_id: 'dorar-feqhia',
              source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية',
              authority: 'المذاهب الأربعة — مؤسسة الدرر السنية',
              book: 'الموسوعة الفقهية المقارنة',
              url: fiqhSearchUrl
            };
          }
        } else {
          // Both failed
          v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
          v.status_label_ar = 'لم يُعثر عليه في المراجع المفحوصة (امتناع شرعي)';
          v.status_label_en = 'Not Found in Checked Sources (Abstention)';
          v.reason = 'لم يُعثر على هذه المسألة في المراجع المفحوصة (الموسوعة الفقهية والحديثية بالدرر السنية). تلتزم المنظومة بالامتناع القطعي عن إصدار أي حكم فقهي غير موثق من المصادر المعتمدة.';
          v.decision_level = 'C';
          v.citation = {
            source_id: 'dorar-feqhia',
            source_name: 'الموسوعة الفقهية المقارنة — الدرر السنية',
            authority: 'المذاهب الأربعة — مؤسسة الدرر السنية',
            book: 'الموسوعة الفقهية المقارنة',
            url: fiqhSearchUrl
          };
        }
      }
    } else {
      // ── HADITH / CLAIM PATH: Dorar Hadith Encyclopedia (dorar.net) ───────────
      const smart = await searchDorarWithSmartQueries(queryToSearch);

      if (smart.topResult) {
        const top = smart.topResult;
        const queryUsed = smart.queryUsed;
        const gradeCategory = top.gradeCategory;
        const hadithDecision = buildHadithDecision(v.item, top);

        if (hadithDecision.status === 'NEEDS_REVIEW' || hadithDecision.status === 'MATCHED') {
          Object.assign(v, hadithDecision);
        } else {
          Object.assign(v, hadithDecision);
        }
      } else {
        if (v.status !== 'REFER_TO_SPECIALIST') {
          v.status = 'NOT_FOUND_IN_CHECKED_SOURCES';
          v.status_label_ar = 'لم يُعثر عليه في المراجع المفحوصة';
          v.status_label_en = 'Not Found in Checked Sources';
          v.reason = 'لم يُعثر على تطابق موثوق لهذا النص في الموسوعة الحديثية بالدرر السنية. تلتزم المنظومة بالامتناع عن الجزم بصحة أي رواية غير مثبتة.';
          v.citation = {
            source_id: 'dorar-hadith',
            source_name: 'الموسوعة الحديثية — الدرر السنية',
            authority: 'المصادر المعتمدة في الحزمة العلمية',
            url: `https://dorar.net/hadith/search?q=${encodeURIComponent(cleanSearchQuery(v.item.text))}`
          };
        }
      }
    }
  } catch (err) {
    console.error('resolveVerificationWithLiveSearch error:', err);
  }

  delete r._needs_live_search;
}

// 2. Ingestion & Verification API (Text, URL, Image OCR, Audio STT)
app.post('/api/verify', async (req, res) => {
  try {
    const { text, inputType = 'text', mediaBase64, mediaMimeType, url, apiKey } = req.body;
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
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (activeKey && activeKey !== 'MY_GEMINI_API_KEY') {
        try {
          const client = new GoogleGenAI({ apiKey: activeKey });
          const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: mediaBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ''),
                      mimeType: mediaMimeType || 'image/jpeg'
                    }
                  },
                  {
                    text: 'استخرج جميع النصوص العربية والإسلامية الموجودة في هذه الصورة بدقة وبلا أي تأليف أو تغيير. أعد النص المستخرج فقط.'
                  }
                ]
              }
            ]
          });
          const ocrResult = response.text?.trim();
          if (ocrResult) extractedText = ocrResult;
        } catch (err) {
          console.warn('Image OCR error:', err);
        }
      }

      // Local Tesseract fallback
      if (!extractedText) {
        try {
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('ara');
          const fullDataUri = mediaBase64.startsWith('data:')
            ? mediaBase64
            : `data:${mediaMimeType || 'image/jpeg'};base64,${mediaBase64}`;
          const ret = await worker.recognize(fullDataUri);
          await worker.terminate();
          const raw = (ret.data?.text || '').trim();
          extractedText = raw
            .replace(/\b[A-Za-z]{1,5}\b/g, '')
            .replace(/[)\]}][0-9]\s*/g, '')
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

    if (aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && extractedText.length > 10) {
      try {
        const aiResponse = await withTimeout(
          aiClient.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `أنت طبقة الاستخراج في منظومة "بصيرة" للتحقق من المحتوى الإسلامي وسياقه.
قواعد صارمة:
1. النموذج اللغوي لا يصدر الحكم الشرعي ولا يختلق المصدر.
2. مهمتك فقط استخراج العناصر الدينية (آيات، أحاديث، مصطلحات حساسة، استفسارات فقهية) على شكل JSON Array دون الإفتاء أو الحكم بصحة شيء.
3. إذا لم تكن متأكداً من النوع، صنفه claim ولا تخمن.

المدخل المراد تحليله:
"""
${extractedText}
"""

أعد فقط JSON صالح بالصيغة التالية:
[
  {
    "type": "ayah" | "hadith" | "term" | "fiqh_question" | "claim",
    "text": "النص المستخرج بدقة",
    "context": "سياق الكلام حوله",
    "language": "ar" | "en" | "fr",
    "claimed_source": "المصدر المزعوم في النص إن وجد (مثل: البخاري، سورة البقرة...)"
  }
]`
                  }
                ]
              }
            ],
            config: {
              responseMimeType: 'application/json'
            }
          }),
          3500
        );

        const jsonStr = aiResponse.text?.trim();
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            extractedItems = parsed.map(p => ({
              type: p.type || 'claim',
              text: p.text || '',
              context: p.context || '',
              language: p.language || 'ar',
              claimed_source: p.claimed_source,
              confidence: 0.95
            }));
          }
        }
      } catch (aiErr) {
        console.warn('AI Extraction failed, falling back to rule-based engine:', aiErr);
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

    // Now run strict verifier layer (The AI CANNOT alter or touch this output)
    const report = verifyExtractedItems(extractedItems, extractedText, inputType);

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

    if (referralCount > 0) {
      report.overall_status = 'REFER_TO_SPECIALIST';
      report.summary_ar = `إحالة شرعية: يتضمن المحتوى مسائل فقهية أو حالات شخصية تتطلب استشارة أهل الاختصاص والهيئات الإفتائية المعتمدة.`;
      report.summary_en = `Specialist Referral: Input contains legal/personal queries that require direct qualified religious consultation.`;
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

    res.json({
      success: true,
      report
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء فحص المحتوى.' });
  }
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

    // 2. Perform OCR (Gemini Vision Flash, fallback to Tesseract.js)
    let extractedText = '';
    const activeKey = process.env.GEMINI_API_KEY;
    if (activeKey && activeKey !== 'MY_GEMINI_API_KEY') {
      try {
        const client = new GoogleGenAI({ apiKey: activeKey });
        const cleanBase64 = base64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
        const resp = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType
                  }
                },
                {
                  text: 'أنت نظام OCR متقدم لمشروع بصيرة. استخرج كل النصوص العربية المكتوبة في هذه الصورة بدقة وبنفس كلماتها وحروفها بالضبط (سواء كانت حديثاً نبوياً أو آية قرآنية أو مقولة) دون أي اختلاق أو زيادة. أعد النص المكتوب فقط.'
                }
              ]
            }
          ]
        });
        extractedText = (resp.text || '').trim();
      } catch (geminiErr: any) {
        console.warn('Gemini OCR error for image extension:', geminiErr.message);
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

    // Step 2: Internal Baseera Verification Check on the generated Arabic draft
    const fullArabicDraft = content.sections.map(s => `${s.section_label_ar}\n${s.content_ar}`).join('\n\n');
    const extractedItems = extractItemsRuleBased(fullArabicDraft);
    const verificationReport = verifyExtractedItems(extractedItems, fullArabicDraft, 'text');

    // Step 3: Format plain text and generate high-res SVG Infographic card
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
