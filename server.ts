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
import { getComparativeBenchmarkResults } from './src/lib/benchmarkRunner.ts';
import { searchDorarApiLive } from './src/lib/dorarClient.ts';
import { ExtractedItem } from './src/types/baseera.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
app.post('/api/verify', async (req, res) => {
  try {
    const { text, inputType = 'text', mediaBase64, mediaMimeType, url } = req.body;
    let extractedText = (text || '').trim();

    // Handle URL ingestion — fetch real content from the URL
    if (inputType === 'url' && url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Baseera-Verifier/1.0', 'Accept': 'text/html,text/plain,*/*' }
        });
        clearTimeout(timeout);

        if (response.ok) {
          const html = await response.text();
          // Strip HTML tags, scripts, styles and extract clean text
          const cleanText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-zA-Z]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 5000); // Limit to 5000 chars for processing
          extractedText = cleanText || text || '';
        } else {
          extractedText = text || '';
        }
      } catch (fetchErr) {
        console.warn('URL fetch failed, using provided text:', fetchErr);
        extractedText = text || '';
      }
    }

    // Handle Image OCR ingestion
    if (inputType === 'image' && mediaBase64 && aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
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
                  text: 'أنت طبقة استخراج نصوص (OCR) لمشروع بصيرة. استخرج جميع النصوص العربية والإسلامية الموجودة في هذه الصورة بدقة وبلا أي تأليف أو تغيير. أعد النص المستخرج فقط.'
                }
              ]
            }
          ]
        });
        const ocrResult = response.text?.trim();
        if (ocrResult) {
          extractedText = ocrResult;
        }
      } catch (err) {
        console.error('Image OCR error:', err);
      }
    }

    // Handle Audio STT ingestion
    if (inputType === 'audio' && mediaBase64 && aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: mediaBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ''),
                    mimeType: mediaMimeType || 'audio/mp3'
                  }
                },
                {
                  text: 'أنت طبقة تفريغ صوتي (STT) لمشروع بصيرة. فرغ الكلام الصوتي المرفق إلى نص عربي دقيق دون أي تعليق.'
                }
              ]
            }
          ]
        });
        const sttResult = response.text?.trim();
        if (sttResult) {
          extractedText = sttResult;
        }
      } catch (err) {
        console.error('Audio STT error:', err);
      }
    }

    // Fallback if empty text
    if (!extractedText) {
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

    // If AI extraction returned no items or wasn't available, use rule-based extractor
    if (extractedItems.length === 0) {
      extractedItems = extractItemsRuleBased(extractedText);
    }

    // Now run strict verifier layer (The AI CANNOT alter or touch this output)
    const report = verifyExtractedItems(extractedItems, extractedText, inputType);

    // ── DORAR LIVE FALLBACK ──────────────────────────────────────────────────
    // For hadiths not found in local corpus, search Dorar.net live API
    // This extends coverage to the full Dorar corpus (~40,000+ hadiths)
    for (const v of report.verifications) {
      const r = v as typeof v & { _needs_live_search?: boolean };
      if (r._needs_live_search && v.item.type === 'hadith') {
        const liveResults = await searchDorarApiLive(v.item.text);
        if (liveResults.length > 0) {
          const top = liveResults[0];
          const gradeCategory = top.gradeCategory;

          if (gradeCategory === 'fabricated' || gradeCategory === 'weak') {
            v.status = 'NEEDS_REVIEW';
            v.status_label_ar = `يحتاج مراجعة (${top.grade || gradeCategory})`;
            v.status_label_en = `Needs Review (${top.grade || gradeCategory})`;
            v.reason = `وُجد النص في منصة الدرر السنية بالحكم التالي: "${top.grade}". الراوي: ${top.rawi || 'غير محدد'}، المحدث: ${top.muhaddith || 'غير محدد'}، المصدر: ${top.book} (${top.numberOrPage}).`;
          } else if (gradeCategory === 'sahih' || gradeCategory === 'hasan') {
            v.status = 'MATCHED';
            v.status_label_ar = 'مطابق (موثق في الدرر السنية)';
            v.status_label_en = 'Matched (Verified in Dorar.net)';
            v.reason = `مطابق للرواية الثابتة في الدرر السنية. الراوي: ${top.rawi}، المحدث: ${top.muhaddith}، المصدر: ${top.book} (${top.numberOrPage})، الحكم: ${top.grade}.`;
          } else {
            v.status = 'NEEDS_REVIEW';
            v.status_label_ar = 'يحتاج مراجعة (تحقق من تخريج الدرر)';
            v.reason = `وُجد في منصة الدرر السنية — حُكم المحدث: "${top.grade}". المصدر: ${top.book}. يُرجى مراجعة تفاصيل التخريج.`;
          }
          v.citation = {
            source_id: 'dorar-hadith-live',
            source_name: 'الموسوعة الحديثية — الدرر السنية (بحث مباشر)',
            authority: 'مؤسسة الدرر السنية للإشراف العلمي',
            book: `${top.book} (${top.numberOrPage})`,
            url: `https://dorar.net/hadith/search?q=${encodeURIComponent(v.item.text)}`
          };
          if (top.text) v.canonical_text = top.text;
        }
        delete r._needs_live_search;
      }
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

// 3. Browser Extension Lookup API (Single term or quote instant verification)
app.post('/api/extension-lookup', (req, res) => {
  const { text, context = '', language = 'ar' } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  let items = extractItemsRuleBased(text);
  if (items.length === 0 && context) {
    // Try extracting with context
    items = extractItemsRuleBased(context);
  }

  if (items.length === 0) {
    items = [{
      type: 'term',
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

  res.json({
    success: true,
    term: text,
    report: report.verifications[0] || null,
    overall_status: report.overall_status,
    summary: report.summary_ar
  });
});

// 4. Benchmark API (Returns frozen benchmark run & 4-system comparative analysis)
app.get('/api/benchmark', (_req, res) => {
  try {
    const comparative = getComparativeBenchmarkResults();
    res.json({
      success: true,
      data: comparative
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
