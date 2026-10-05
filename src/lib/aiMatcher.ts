import { groqChat, GROQ_TEXT_MODEL } from './groqClient.ts';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI semantic candidate matcher.
 *
 * Groq is used only to rank/reject candidates already retrieved from
 * approved source data. It never creates source text, citation, or ruling.
 * The deterministic source verifier remains the final authority.
 */


export type AICandidate = {
  id: string;
  source: string;
  title?: string;
  text: string;
};

export type AIMatchResult = {
  candidate_id: string | null;
  relation: 'exact' | 'altered' | 'partial' | 'related' | 'none';
  confidence: number;
};

function getGroqKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}


export type SearchDomain = 'quran' | 'hadith' | 'fiqh' | 'terminology';

export async function generateSourceSearchQueriesWithAI(
  domain: SearchDomain,
  question: string
): Promise<string[]> {
  if (!question.trim()) return [];

  const instructions = {
    quran: 'تحليل النص للبحث في المصدر القرآني المعتمد فقط. استخرج عبارات قصيرة مميزة من النص أو المعنى المطلوب، دون تحديد سورة أو آية من معرفتك ودون إنشاء نص قرآني.',
    hadith: 'تحليل النص للبحث في الموسوعة الحديثية المعتمدة فقط. استخرج عبارات قصيرة مميزة من المتن أو المعنى، دون إنشاء حديث أو تخريج أو حكم.',
    fiqh: 'تحليل السؤال لاستخراج صلب موضوع المسألة الفقهية وعبارات بحث دقيقة للبحث في الموسوعة الفقهية. اكتب فقط أسماء الأبواب أو المسائل الشرعية المباشرة دون حشو (مثل: "حكم الكذب"، "تحريم الكذب"، "شهادة الزور"، "الكذب في اليمين"). ممنوع منعاً باتاً استخدام كلمات الحشو مثل "حول" أو "الآراء" أو "التبعات" أو "في الفقه".',
    terminology: 'تحليل المصطلح وسياقه لتحسين البحث في مصدر المصطلحات المعتمد فقط. استخرج صيغ بحث قصيرة محتملة دون إنشاء تعريف.'
  }[domain];

  const raw = await groqChat(
    [{
      role: 'user',
      content: `أنت طبقة فهم واستعلام في «بصيرة».
مهمتك الوحيدة: تحسين استعلام البحث في المصدر المحدد، ولا تُجب عن المستخدم.

المجال: ${domain}
التعليمات: ${instructions}

ممنوع:
- إصدار حكم شرعي أو فتوى.
- اختراع نص ديني أو مصدر أو رابط.
- الاعتماد على معرفتك السابقة كدليل.
- إعطاء نتيجة التحقق.

المدخل:
<<<
${question}
>>>

أعد JSON فقط:
{"queries":["عبارة بحث 1","عبارة بحث 2","عبارة بحث 3","عبارة بحث 4","عبارة بحث 5"]}

اجعل العبارات قصيرة ومحددة ومختلفة في الصياغة، ومقتصرة على صلب الموضوع، ولا تكرر المدخل حرفيًا إذا كانت صياغة أوضح أنسب للبحث.`
    }],
    {
      model: GROQ_TEXT_MODEL,
      temperature: 0.2,
      maxTokens: 512,
      json: true,
      timeoutMs: 8000
    }
  );

  try {
    const parsed = JSON.parse(String(raw)) as { queries?: unknown };
    if (!Array.isArray(parsed.queries)) return [];
    return [...new Set(
      parsed.queries
        .filter((q): q is string => typeof q === 'string')
        .map(q => q.replace(/[«»"“؟?.,!؛،]/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(q => q.length >= 2)
        .filter(q => !/\b(?:حول|الآراء|التبعات|الآثار المترتبة)\b/.test(q))
    )].slice(0, 5);
  } catch {
    return [];
  }
}

export async function generateQuranReferenceCandidatesWithAI(
  text: string
): Promise<Array<{ surah: number; ayah: number }>> {
  if (!text.trim()) return [];

  const raw = await groqChat(
    [{
      role: 'user',
      content: `أنت طبقة بحث مساعدة في «بصيرة». حلّل النص التالي لتحديد مواضع قرآنية محتملة فقط، كي يجلبها النظام لاحقًا من المصدر القرآني الحي.

ممنوع:
- اعتبار إجابتك دليلًا.
- إنشاء نص قرآني أو نسبته إلى القرآن.
- إصدار حكم أو تفسير.
- إعادة أي موضع غير واثق منه بلا فحص المصدر.

قد يكون النص ترجمة إنجليزية/فرنسية أو اقتباسًا عربيًا ناقصًا.

أعد JSON فقط:
{"references":[{"surah":1,"ayah":1},{"surah":2,"ayah":255}]}

أقصى عدد 8 مواضع.`
    }],
    {
      model: GROQ_TEXT_MODEL,
      temperature: 0,
      maxTokens: 512,
      json: true,
      timeoutMs: 8000
    }
  );

  try {
    const parsed = JSON.parse(String(raw)) as { references?: unknown };
    if (!Array.isArray(parsed.references)) return [];
    return parsed.references
      .map((r: any) => ({
        surah: Number(r?.surah),
        ayah: Number(r?.ayah)
      }))
      .filter(r =>
        Number.isInteger(r.surah) && r.surah >= 1 && r.surah <= 114 &&
        Number.isInteger(r.ayah) && r.ayah >= 1
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function generateFiqhSearchQueriesWithAI(question: string): Promise<string[]> {
  return generateSourceSearchQueriesWithAI('fiqh', question);
}

export interface QuestionDecomposition {
  core_subject: string;
  subject_tokens: string[];
  intent: 'ruling' | 'definition' | 'conditions' | 'consensus' | 'evidence' | 'general';
  search_queries: string[];
}

export async function understandQuestionWithAI(
  question: string
): Promise<QuestionDecomposition | null> {
  const apiKey = getGroqKey();
  if (!apiKey || !question.trim()) return null;

  try {
    const raw = await groqChat(
      [{
        role: 'user',
        content: `أنت محلل أسئلة شرعية في منصة «بصيرة».
حلل السؤال التالي لاستخراج الموضوع الفقهي/الشرعي بدقة بالغة وبناء استعلامات بحث نقية ومباشرة لموسوعة الدرر السنية.

القواعد الإلزامية:
1. استخرج الموضوع الرئيسي المجرد (مثل: "الكذب"، "اللغو"، "الختان"، "صلاة الاستسقاء").
2. استخرج جذور/كلمات الموضوع الأساسية بدون أل التعريف وبدون حشو.
3. حدد القصد (حكم شرعي: ruling، إجماع: consensus، تعريف: definition، شروط: conditions).
4. اكتب 3-5 استعلامات بحث قصيرة ونقية جداً للبحث في الدرر السنية. ممنوع منعاً باتاً كلمات الحشو مثل (حول، الآراء، التبعات، في الفقه، أقوال العلماء).

السؤال:
<<<
${question}
>>>

أعد JSON فقط بهذا الشكل:
{
  "core_subject": "الموضوع المجرد",
  "subject_tokens": ["جذر1", "جذر2"],
  "intent": "ruling",
  "search_queries": ["حكم كذا", "تحريم كذا", "كذا"]
}`
      }],
      {
        model: GROQ_TEXT_MODEL,
        temperature: 0.1,
        maxTokens: 512,
        json: true,
        timeoutMs: 6000
      }
    );

    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed.core_subject === 'string') {
      const rawTokens = parsed.subject_tokens || parsed.tokens || [parsed.core_subject];
      const subjectTokens = Array.isArray(rawTokens)
        ? rawTokens.filter((t: any): t is string => typeof t === 'string' && t.length >= 2)
        : [];

      const rawQueries = parsed.search_queries || parsed.search_quests || parsed.queries || [];
      const queries = Array.isArray(rawQueries)
        ? rawQueries.filter((q: any): q is string => typeof q === 'string' && q.length >= 2)
        : [];

      return {
        core_subject: parsed.core_subject.trim(),
        subject_tokens: subjectTokens.length > 0 ? subjectTokens : [parsed.core_subject.trim()],
        intent: parsed.intent || 'ruling',
        search_queries: queries.length > 0 ? queries : [parsed.core_subject.trim()]
      };
    }
  } catch (err: any) {
    console.warn('[BASEERA][AI][UNDERSTAND_QUESTION][ERROR]', err?.message);
  }

  return null;
}

export async function rankCandidatesWithAI(
  kind: 'quran' | 'hadith' | 'fiqh' | 'terminology',
  inputText: string,
  candidates: AICandidate[],
  timeoutMs = 6000
): Promise<AIMatchResult | null> {
  const apiKey = getGroqKey();
  if (!apiKey || !inputText.trim() || candidates.length === 0) {
    console.warn('[BASEERA][AI][RANK][SKIP]', JSON.stringify({ kind, hasKey: Boolean(apiKey), inputLength: inputText.length, candidateCount: candidates.length }));
    return null;
  }

  const compactCandidates = candidates.slice(0, 8).map(c => ({
    id: c.id,
    source: c.source,
    title: c.title || '',
    text: c.text.slice(0, 900)
  }));

  const prompt = `أنت طبقة مضاهاة دلالية في منظومة «بصيرة».
مهمتك اختيار أفضل مرشح من قائمة مصادر أرسلها لك، أو رفض جميع المرشحين.

قواعد إلزامية:
1) لا تنشئ نصاً دينياً من عندك.
2) لا تنشئ مصدراً أو رقم آية أو حديثاً أو حكماً.
3) لا تعتبر معرفتك السابقة دليلاً مستقلاً.
4) لا تختر مرشحاً إلا من القائمة المرسلة حرفياً بالمعرّف id.
5) في القرآن: تعامل مع اختلاف التشكيل، أخطاء OCR، حذف/تبديل كلمة، أو اقتباس جزء من الآية؛ المطلوب اكتشاف الآية المرجعية المحتملة فقط.
7) في الفقه: اختر المرشح الذي يعالج المسألة الفقهية المستفتى عنها كـ«موضوع رئيسي ومباشر» (مثلاً: السؤال عن حكم اللغو يتناول لغو اليمين وصوره وحكمه، وليس حكمة زكاة الفطر أو الحج أو النكاح لمجرد ورود لفظ عارض).
8) إذا كانت المرشحات تتناول موضوعاً آخر مختلفاً عن المسألة (مثل صلاة الاستسقاء أو زكاة الفطر أو شروط اللعان لسؤال عن الكذب)، أعد candidate_id = null فوراً. ممنوع منعاً باتاً اختيار أي مرشح لا يتطابق موضوعه مع صلب السؤال.
9) «altered» تعني أن المرشح يبدو الأصل المرجعي للنص المدخل مع وجود تغيير/استبدال في اللفظ.
10) «partial» تعني أن المدخل اقتباس من جزء المرشح.
11) نتيجة الذكاء الاصطناعي ليست حكماً نهائياً؛ سيجري التحقق آلياً من النص المصدر بعد ذلك.

نوع المادة: ${kind}

النص المدخل:
<<<
${inputText}
>>>

المرشحون من المصدر المعتمد:
${JSON.stringify(compactCandidates, null, 2)}

أعد JSON فقط:
{
  "candidate_id": "id من القائمة أو null",
  "relation": "exact | altered | partial | related | none",
  "confidence": 0.0
}`;

  try {
    const response = await Promise.race([
      groqChat(
        [{ role: 'user', content: prompt }],
        {
          model: GROQ_TEXT_MODEL,
          temperature: 0,
          maxTokens: 768,
          json: true,
          timeoutMs: Math.max(timeoutMs, 10000)
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI semantic match timeout')), Math.max(timeoutMs, 10000))
      )
    ]);

    const raw = String(response).trim();
    console.log('[BASEERA][AI][RANK][RAW]', JSON.stringify({ kind, candidateCount: compactCandidates.length, length: raw.length, preview: raw.slice(0, 500) }));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AIMatchResult>;
    const allowed = new Set(compactCandidates.map(c => c.id));

    const candidateId =
      typeof parsed.candidate_id === 'string' && allowed.has(parsed.candidate_id)
        ? parsed.candidate_id
        : null;

    const relation =
      parsed.relation === 'exact' ||
      parsed.relation === 'altered' ||
      parsed.relation === 'partial' ||
      parsed.relation === 'related'
        ? parsed.relation
        : 'none';

    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;

    if (!candidateId) return { candidate_id: null, relation: 'none', confidence };
    return { candidate_id: candidateId, relation, confidence };
  } catch (err) {
    console.warn('Groq semantic matching failed:', err);
    return null;
  }
}
