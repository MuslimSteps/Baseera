/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Baseera MCP Server (Model Context Protocol)
 * Enables any AI model (Claude, Cursor, Gemini, etc.) to query:
 * 1. Dorar.net Live Hadith API (40,000+ hadiths with narrators & rulings)
 * 2. King Fahd Complex Quran Database (6,236 verses)
 * 3. Jamhara Islamic Terminology Dictionary
 * 4. Four Madhahib Fiqh Consensus & Fatwa Guardrails
 */

import readline from 'readline';
import { searchDorarApiLive } from './src/lib/dorarClient.ts';
import quranData from './sources/quran.json' with { type: 'json' };
import translationData from './sources/quran_translations.json' with { type: 'json' };
import termData from './sources/terminology.json' with { type: 'json' };
import fiqhData from './sources/fiqh.json' with { type: 'json' };
import { normalizeArabic, computeWordDiff } from './src/lib/normalizer.ts';

const SERVER_NAME = 'baseera-islamic-mcp';
const SERVER_VERSION = '1.0.0';

// Tools definition compliant with MCP schema
const TOOLS = [
  {
    name: 'search_dorar_hadith',
    description: 'البحث المباشر في منصة الدرر السنية للأحاديث النبوية (المصدر المعتمد في المسابقة). يعيد نص الحديث، الراوي، المحدث، كتاب التخريج، ورتبة الحديث (صحيح، ضعيف، موضوع).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'نص الحديث أو جزء منه للبحث في الموسوعة الحديثية بالدرر السنية'
        },
        limit: {
          type: 'number',
          description: 'الحد الأقصى لعدد النتائج (افتراضياً 5)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'verify_quran_verse',
    description: 'التحقق من صحة النص القرآني ومطابقته لمصحف مجمع الملك فهد لطباعة المصحف الشريف بالرسم العثماني المعتمد.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'نص الآية الكريمة المراد فحصها'
        },
        surah: {
          type: 'string',
          description: 'اسم السورة إن كان مذكوراً (اختياري)'
        },
        ayah_number: {
          type: 'number',
          description: 'رقم الآية إن كان مذكوراً (اختياري)'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'lookup_jamhara_term',
    description: 'البحث في موسوعة الجمهرة لمفردات المحتوى الإسلامي (المرجع المعتمد للمصطلحات الحساسة والترجمة). يكشف الاستخدام المختزل للمصطلح ويوفر التعريف والترجمة المعتمدة.',
    inputSchema: {
      type: 'object',
      properties: {
        term: {
          type: 'string',
          description: 'المصطلح الإسلامي بالعربية أو الإنجليزية (مثل: Tawhid, Sharia, Jihad, Worship, الدعوة)'
        },
        context: {
          type: 'string',
          description: 'السياق الذي ورد فيه المصطلح لفحص ما إذا كان هناك اختزال أو تحريف'
        }
      },
      required: ['term']
    }
  },
  {
    name: 'check_fiqh_ruling',
    description: 'فحص المسألة الفقهية وتحديد مستواها (مجمع عليه، خلافي بين المذاهب الأربعة، أو نازلة/حالة شخصية تتطلب الإحالة الصارمة لجهة إفتاء مؤهلة).',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'السؤال أو المسألة الفقهية'
        }
      },
      required: ['question']
    }
  }
];

// Tool handlers
async function handleToolCall(name: string, args: Record<string, any>) {
  switch (name) {
    case 'search_dorar_hadith': {
      const query = args.query;
      const limit = args.limit || 5;
      const results = await searchDorarApiLive(query);
      const sliced = results.slice(0, limit);

      if (sliced.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `لم يُعثر على الحديث في منصة الدرر السنية للبحث: "${query}".\nتلتزم المنظومة بالامتناع عن إصدار حكم جازم بالاختلاق ما لم يُصرّح به المرجع.`
            }
          ]
        };
      }

      const formatted = sliced.map((h, i) => (
        `[${i + 1}] المتن: ${h.text}\n` +
        `• الراوي: ${h.rawi || 'غير محدد'}\n` +
        `• المحدث: ${h.muhaddith || 'غير محدد'}\n` +
        `• المصدر: ${h.book} (${h.numberOrPage})\n` +
        `• خلاصة الحكم: ${h.grade || 'غير محدد'} [تصنيف: ${h.gradeCategory}]`
      )).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `نتائج البحث المباشر في منصة الدرر السنية (dorar.net):\n\n${formatted}`
          }
        ]
      };
    }

    case 'verify_quran_verse': {
      const input = args.text;
      const normInput = normalizeArabic(input);
      let bestMatch: any = null;
      let highestScore = 0;

      for (const v of quranData.verses) {
        const normClean = normalizeArabic(v.text_clean);
        if (normClean.includes(normInput) || normInput.includes(normClean)) {
          const diff = computeWordDiff(input, v.text_clean);
          const score = diff.similarityScore;
          if (score > highestScore) {
            highestScore = score;
            bestMatch = { verse: v, diff };
          }
        }
      }

      if (!bestMatch) {
        return {
          content: [
            {
              type: 'text',
              text: `لم يتطابق النص مع المصحف الشريف بالرسم العثماني المعتمد (مجمع الملك فهد). النص المفحوص: "${input}"`
            }
          ]
        };
      }

      const v = bestMatch.verse;
      const diff = bestMatch.diff;
      const status = diff.hasDiscrepancy ? 'يحتاج مراجعة (يوجد اختلاف في الألفاظ)' : 'مطابق تماماً';

      return {
        content: [
          {
            type: 'text',
            text: `حالة التحقق: ${status}\n` +
                  `السورة: ${v.surah_name_ar} (رقم السورة: ${v.surah_number})\n` +
                  `رقم الآية: ${v.ayah_number}\n` +
                  `النص المعتمد: ${v.text_uthmani}\n` +
                  `المصدر: مجمع الملك فهد لطباعة المصحف الشريف`
          }
        ]
      };
    }

    case 'lookup_jamhara_term': {
      const termInput = args.term.toLowerCase();
      const context = (args.context || '').toLowerCase();

      const matched = termData.terms.find(t => 
        t.term_ar.includes(termInput) || 
        t.term_en.toLowerCase().includes(termInput)
      );

      if (!matched) {
        return {
          content: [
            {
              type: 'text',
              text: `لم يُعثر على المصطلح في موسوعة الجمهرة المعتمدة: "${args.term}"`
            }
          ]
        };
      }

      let warning = '';
      if (context && matched.reductionist_cues) {
        for (const cue of matched.reductionist_cues) {
          if (context.includes(cue.toLowerCase())) {
            warning = `⚠️ تنبيه: تم رصد مؤشر اختزال للمصطلح (${cue}).\n${matched.warning_ar}`;
            break;
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `المصطلح: ${matched.term_ar} (${matched.term_en})\n` +
                  `المقابل المعتمد: ${matched.approved_translation}\n` +
                  `التعريف المعتمد: ${matched.definition_ar}\n` +
                  `المصدر: موسوعة الجمهرة لمفردات المحتوى الإسلامي\n` +
                  (warning ? `\n${warning}` : '\n✅ الاستخدام سليم وضمن المعنى الشرعي المعتمد.')
          }
        ]
      };
    }

    case 'check_fiqh_ruling': {
      const q = args.question;
      const normQ = normalizeArabic(q);

      const matched = fiqhData.topics.find(t => 
        normQ.includes(normalizeArabic(t.topic)) ||
        (t.topic.includes('طلاق') && (normQ.includes('طلاق') || normQ.includes('زوجتي')))
      );

      if (matched?.level === 'D' || normQ.includes('زوجتي') || normQ.includes('طلقت')) {
        return {
          content: [
            {
              type: 'text',
              text: `المستوى: D (حالة أو فتوى شخصية خاصة)\n` +
                    `الحكم المنهجي: الامتناع الصارم عن الفتوى الآلية.\n` +
                    `التوجيه: يلزم إحالة السائل إلى دار الإفتاء الرسمية أو المحكمة الشرعية المختصة.`
            }
          ]
        };
      }

      if (matched?.level === 'C') {
        return {
          content: [
            {
              type: 'text',
              text: `المستوى: C (مسألة خلافية معتبرة بين أئمة الفقه)\n` +
                    `المسألة: ${matched.topic}\n` +
                    `المنهج: عرض أقوال المذاهب الأربعة باعتدال وتجرد دون ترجيح آلي بين الأئمة.`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `المسألة الفقهية معروضة على أصول المذاهب الأربعة (dorar.net/feqhia). عند عدم كفاية الدليل المعتمد، تُحال المسألة لمختص.`
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// JSON-RPC stdio protocol loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    switch (method) {
      case 'initialize': {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION
            }
          }
        };
        console.log(JSON.stringify(response));
        break;
      }

      case 'notifications/initialized': {
        // Notification, no response required
        break;
      }

      case 'tools/list': {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        };
        console.log(JSON.stringify(response));
        break;
      }

      case 'tools/call': {
        const { name, arguments: args } = params;
        try {
          const result = await handleToolCall(name, args || {});
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result
          }));
        } catch (err: any) {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: err.message || 'Internal tool error'
            }
          }));
        }
        break;
      }

      default: {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        }));
      }
    }
  } catch (parseErr) {
    // Malformed JSON
  }
});
