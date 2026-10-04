/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Baseera MCP Server (Model Context Protocol)
 * Enables any AI model (Claude, Cursor, Gemini, etc.) to query:
 * 1. Dorar.net Live Hadith API (approved source retrieval + grading)
 * 2. King Fahd Complex Quran Database (6,236 indexed verses)
 * 3. Jamhara Islamic Terminology Dictionary
 * 4. Four Madhahib Fiqh Consensus & Fatwa Guardrails
 */

import readline from 'readline';
import { searchDorarWithSmartQueries } from './src/lib/dorarClient.ts';
import { buildHadithDecision } from './src/lib/hadithVerifier.ts';
import { verifyQuranAyah } from './src/lib/quranVerifier.ts';
import { verifyIslamicTerm } from './src/lib/terminologyEngine.ts';
import { verifyFiqhQuestion } from './src/lib/fiqhEngine.ts';
import quranData from './sources/quran.json' with { type: 'json' };
import translationData from './sources/quran_translations.json' with { type: 'json' };
import termData from './sources/terminology.json' with { type: 'json' };
import fiqhData from './sources/fiqh.json' with { type: 'json' };

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
      const query = String(args.query || '').trim();
      const limit = Math.max(1, Math.min(Number(args.limit || 5), 20));
      const searched = await searchDorarWithSmartQueries(query);
      const results = searched.allResults.slice(0, limit);

      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `لم يُعثر على تطابق موثوق لهذا النص في الموسوعة الحديثية بالدرر السنية. لا تُثبت النسبة إلى النبي ﷺ دون مطابقة مصدرية.`
          }]
        };
      }

      const formatted = results.map((h, i) =>
        `[${i + 1}] المتن: ${h.text}\n` +
        `• الراوي: ${h.rawi || 'غير محدد'}\n` +
        `• المحدث: ${h.muhaddith || 'غير محدد'}\n` +
        `• المصدر: ${h.book} (${h.numberOrPage})\n` +
        `• الحكم: ${h.grade || 'غير محدد'} [${h.gradeCategory}]\n` +
        `• جودة المطابقة: ${h.matchQuality || 'غير محددة'}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `نتائج بحث المصدر المعتمد في الدرر السنية:\n\n${formatted}`
        }]
      };
    }

    case 'verify_quran_verse': {
      const input = String(args.text || '').trim();
      if (!input) throw new Error('text is required');

      const result = verifyQuranAyah({
        type: 'ayah',
        text: input,
        context: input,
        language: 'ar',
        confidence: 1,
        claimed_surah: args.surah ? String(args.surah) : undefined,
        claimed_ayah: args.ayah_number ? Number(args.ayah_number) : undefined
      });

      return {
        content: [{
          type: 'text',
          text:
            `حالة التحقق: ${result.status_label_ar}\n` +
            `السبب: ${result.reason}\n` +
            (result.canonical_surah ? `السورة: ${result.canonical_surah}\n` : '') +
            (result.canonical_ayah_number ? `رقم الآية: ${result.canonical_ayah_number}\n` : '') +
            (result.canonical_text ? `النص المرجعي: ${result.canonical_text}\n` : '') +
            `المصدر: ${result.citation.source_name}`
        }]
      };
    }

    case 'lookup_jamhara_term': {
      const term = String(args.term || '').trim();
      if (!term) throw new Error('term is required');

      const result = verifyIslamicTerm({
        type: 'term',
        text: term,
        context: String(args.context || term),
        language: /[a-zA-Z]/.test(term) ? 'en' : 'ar',
        confidence: 1
      });

      return {
        content: [{
          type: 'text',
          text:
            `حالة التحقق: ${result.status_label_ar}\n` +
            `السبب: ${result.reason}\n` +
            (result.jamhara_definition ? `التعريف المعتمد: ${result.jamhara_definition}\n` : '') +
            (result.verified_translation ? `المقابل المعتمد: ${result.verified_translation}\n` : '') +
            `المصدر: ${result.citation.source_name}`
        }]
      };
    }

    case 'check_fiqh_ruling': {
      const question = String(args.question || '').trim();
      if (!question) throw new Error('question is required');

      const result = verifyFiqhQuestion({
        type: 'fiqh_question',
        text: question,
        context: question,
        language: /[a-zA-Z]/.test(question) ? 'en' : 'ar',
        confidence: 1
      });

      return {
        content: [{
          type: 'text',
          text:
            `حالة المنهج: ${result.status_label_ar}\n` +
            `المستوى: ${result.decision_level || 'غير محدد'}\n` +
            `السبب: ${result.reason}\n` +
            `المصدر/الإحالة: ${result.citation.url || result.citation.source_name}`
        }]
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
