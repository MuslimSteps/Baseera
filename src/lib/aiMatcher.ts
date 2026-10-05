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


export async function generateFiqhSearchQueriesWithAI(question: string): Promise<string[]> {
  if (!question.trim()) return [];

  const raw = await groqChat(
    [{
      role: 'user',
      content: `أنت طبقة فهم واستعلام في «بصيرة». حلّل السؤال الفقهي التالي لتحسين البحث في موسوعة الدرر السنية فقط.

ممنوع:
- إصدار الحكم الشرعي.
- ترجيح قول فقهي.
- اختراع مصدر أو نص.
- الإجابة عن السؤال.

مهمتك الوحيدة: استخراج المفهوم الفقهي المقصود وإنتاج عبارات بحث قصيرة يمكن أن تكون عناوين/موضوعات في الموسوعة الفقهية.

السؤال:
<<<
${question}
>>>

أعد JSON فقط:
{
  "queries": ["عبارة بحث 1", "عبارة بحث 2", "عبارة بحث 3", "عبارة بحث 4"]
}

اجعل العبارات محددة، ولا تكرر السؤال حرفياً إذا كانت صياغة أقصر وأوضح أنسب للبحث.`
    }],
    {
      model: GROQ_TEXT_MODEL,
      temperature: 0.2,
      maxTokens: 512,
      json: true,
      reasoningEffort: 'medium',
      timeoutMs: 8000
    }
  );

  try {
    const parsed = JSON.parse(raw) as { queries?: unknown };
    if (!Array.isArray(parsed.queries)) return [];
    return parsed.queries
      .filter((q): q is string => typeof q === 'string')
      .map(q => q.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function rankCandidatesWithAI(
  kind: 'quran' | 'hadith' | 'fiqh',
  inputText: string,
  candidates: AICandidate[],
  timeoutMs = 3500
): Promise<AIMatchResult | null> {
  const apiKey = getGroqKey();
  if (!apiKey || !inputText.trim() || candidates.length === 0) return null;

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
6) في الحديث: تعامل مع اختلاف الصياغة أو الاقتباس الجزئي؛ اختر المرشح فقط إذا كان معناه/لفظه قريباً فعلاً.
7) إذا كانت المرشحات غير مرتبطة بالنص، أعد candidate_id = null.
8) «altered» تعني أن المرشح يبدو الأصل المرجعي للنص المدخل مع وجود تغيير/استبدال في اللفظ.
9) «partial» تعني أن المدخل اقتباس من جزء المرشح.
10) نتيجة الذكاء الاصطناعي ليست حكماً نهائياً؛ سيجري التحقق آلياً من النص المصدر بعد ذلك.

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
          reasoningEffort: 'medium',
          timeoutMs
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI semantic match timeout')), timeoutMs)
      )
    ]);

    const raw = String(response).trim();
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
