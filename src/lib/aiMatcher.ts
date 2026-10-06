import { groqChat, GROQ_TEXT_MODEL } from './groqClient.ts';
import { normalizeArabic } from './normalizer.ts';

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

  try {
    const raw = await groqChat(
      [{
        role: 'user',
        content: `أنت طبقة بحث مساعدة في «بصيرة». حلّل النص التالي لتحديد مواضع قرآنية وثيقة الصلة بموضوعه أو ألفاظه، كي يجلبها النظام لاحقًا من المصدر القرآني الحي.

ممنوع:
- اعتبار إجابتك دليلًا.
- إنشاء نص قرآني أو نسبته إلى القرآن.
- إصدار حكم أو تفسير.
- إعادة أي موضع غير واثق منه بلا فحص المصدر.

قد يكون النص موضوعًا دعويًا، أو ترجمة أجنبية، أو اقتباسًا عربيًا.

النص المطلوب تحليله:
"""
${text}
"""

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
  qualifiers?: string[];
  is_claim?: boolean;
  claimed_ruling?: string;
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
        content: `أنت محلل أسئلة وادعاءات شرعية في منصة «بصيرة».
حلل النص التالي لاستخراج الموضوع الفقهي/الشرعي والقيود بدقة بالغة وبناء استعلامات بحث نقية ومباشرة لموسوعة الدرر السنية.

القواعد الإلزامية:
1. استخرج الموضوع الرئيسي المجرد (مثل: "المسح على الخفين"، "شرب الخمر"، "الكذب"، "الختان").
2. استخرج القيود أو الأوصاف المخصصة إن وجدت (مثل: "مدة المسح"، "5 أيام"، "متخذة من العنب").
3. حدد ما إذا كان النص ادعاءً ينقل حكماً أو شائعة (is_claim: true إذا كان مثل "شخص كاتب أن كذا حلال" أو "يمكن المسح 5 أيام"، وfalse إذا كان سؤالاً عادياً مثل "ما حكم...؟").
4. استخرج الحكم المدعى إن وجد (مثل: "حلال"، "جواز المسح 5 أيام").
5. اكتب 3-5 استعلامات بحث نقية ومباشرة جداً للدرر السنية تجمع بين الموضوع والقيود المخصصة (مثل: ["مدة المسح على الخفين", "المسح على الخفين"]، أو ["حكم الخمر المتخذة من العنب", "شرب الخمر من العنب"]). ممنوع كلمات الحشو مثل (حول، الآراء، التبعات، في الفقه).

النص:
<<<
${question}
>>>

أعد JSON فقط بهذا الشكل:
{
  "core_subject": "الموضوع المجرد",
  "subject_tokens": ["جذر1", "جذر2"],
  "qualifiers": ["قيد1"],
  "is_claim": false,
  "claimed_ruling": "",
  "intent": "ruling",
  "search_queries": ["حكم كذا", "تحريم كذا", "كذا"]
}`
      }],
      {
        model: GROQ_TEXT_MODEL,
        temperature: 0.1,
        maxTokens: 2048,
        json: true,
        reasoningEffort: 'none',
        timeoutMs: 8000
      }
    );

    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed.core_subject === 'string') {
      const rawTokens = parsed.subject_tokens || parsed.tokens || [parsed.core_subject];
      const subjectTokens = Array.isArray(rawTokens)
        ? rawTokens.filter((t: any): t is string => typeof t === 'string' && t.length >= 2)
        : [];

      const rawQualifiers = parsed.qualifiers || [];
      const qualifiers = Array.isArray(rawQualifiers)
        ? rawQualifiers.filter((q: any): q is string => typeof q === 'string' && q.trim().length >= 2)
        : [];

      const rawQueries = parsed.search_queries || parsed.search_quests || parsed.queries || [];
      const queries = Array.isArray(rawQueries)
        ? rawQueries.filter((q: any): q is string => typeof q === 'string' && q.length >= 2)
        : [];

      return {
        core_subject: parsed.core_subject.trim(),
        subject_tokens: subjectTokens.length > 0 ? subjectTokens : [parsed.core_subject.trim()],
        qualifiers,
        is_claim: Boolean(parsed.is_claim),
        claimed_ruling: typeof parsed.claimed_ruling === 'string' ? parsed.claimed_ruling.trim() : '',
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
  timeoutMs = 6000,
  contextOptions?: { coreSubject?: string; keyTokens?: string[]; qualifiers?: string[] }
): Promise<AIMatchResult | null> {
  const apiKey = getGroqKey();
  if (!apiKey || !inputText.trim() || candidates.length === 0) {
    console.warn('[BASEERA][AI][RANK][SKIP]', JSON.stringify({ kind, hasKey: Boolean(apiKey), inputLength: inputText.length, candidateCount: candidates.length }));
    return null;
  }

  const compactCandidates = candidates.slice(0, 6).map(c => ({
    id: c.id,
    source: c.source,
    title: c.title || '',
    text: c.text.slice(0, 500)
  }));

  const coreSubjectLine = contextOptions?.coreSubject
    ? `\nالموضوع المستخلص: ${contextOptions.coreSubject}`
    : '';

  const qualifiersLine = contextOptions?.qualifiers?.length
    ? `\nالقيود والأوصاف المحددة في المسألة: ${contextOptions.qualifiers.join('، ')}\nتنبيه فقهي صارم: يجب إعطاء الأولوية القصوى للمرشح الذي يتناول هذه القيود المحددة (مثل: مدة المسح، نوع المادة كالعنب، الحالة أو الشرط) بدلاً من المرشح العام.`
    : '';

  const prompt = `أنت طبقة مضاهاة دلالية في منظومة «بصيرة».${coreSubjectLine}${qualifiersLine}
مهمتك اختيار أفضل وأدق مرشح من قائمة مصادر معتمدة أرسلها لك، أو رفض جميع المرشحين.

قواعد إلزامية:
1) لا تنشئ نصاً دينياً من عندك ولا تختر إلا من المعرفات id المذكورة في القائمة المرسلة حرفياً.
2) لا تعتبر معرفتك السابقة دليلاً مستقلاً؛ اعتمد فقط على ما ورد في القائمة.
3) في القرآن: تعامل مع اختلاف التشكيل، أخطاء OCR، حذف/تبديل كلمة، أو اقتباس جزء من الآية؛ المطلوب اكتشاف الآية المرجعية المحتملة فقط.
4) في الفقه والادعاءات الدينية:
   - اختر المرشح الذي يعالج المسألة المستفتى عنها أو موضوع الادعاء كـ«موضوع رئيسي ومباشر».
   - إذا تضمن النص قيداً أو مادة أو حالاً خاصاً (مثل: «من العنب»، «في السفر»، «للمريض»، «لغو اليمين»)، فيجب إلزاماً اختيار المرشح الذي يتطابق مع هذا القيد الخاص تحديداً (مثل: «الخمر المتخذة من العنب» وليس «من غير العنب» ولا قيوداً فرعية أخرى كالعطش أو الغصة أو الإكراه).
   - الادعاءات الفقهية (مثل الزعم بأن محرماً حلال أو العكس) تطابق مع المادة الفقهية الأصلية التي تبين حكم هذا الفعل بعينه.
5) إذا كانت المرشحات تتناول موضوعاً آخر مختلفاً عن صلب المسألة (مثل صلاة الاستسقاء لسؤال عن الكذب، أو زكاة الفطر لمجرد ورود لفظ عارض)، أعد candidate_id = null فوراً.
6) «altered» تعني أن المرشح يبدو الأصل المرجعي للنص المدخل مع وجود تحريف أو تغيير أو تبديل في الحكم أو اللفظ.
7) «exact» تعني تطابقاً تاماً في المسألة أو النص.
8) «partial» تعني اقتباساً من جزء المرشح.
9) «related» تعني صلة وثيقة بالمسألة نفسها.

نوع المادة: ${kind}${coreSubjectLine}

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

/**
 * Synthesises a direct, source-grounded ruling answer (chatbot style).
 *
 * The model receives ONLY the passages retrieved from the approved sources
 * (Dorar fiqh encyclopedia, the IslamHouse/Shamela-like library via MCP, …) and
 * must answer STRICTLY from them: a concise ruling, whether it is consensus or
 * disputed, and the evidence quoted from the passages. It must never add a
 * ruling or evidence from its own knowledge; if the passages do not answer the
 * question it returns supported=false.
 */
export interface FiqhAnswer {
  supported: boolean;
  answer: string;
  evidence: string[];
  consensus: string;
  confidence: number;
}

export async function answerFiqhFromSources(
  question: string,
  passages: Array<{ source: string; title: string; text: string; url?: string }>
): Promise<FiqhAnswer | null> {
  const apiKey = getGroqKey();
  if (!apiKey || !question.trim() || passages.length === 0) return null;

  const compact = passages
    .filter(p => p.text && p.text.trim().length > 0)
    .slice(0, 6)
    .map(p => ({ source: p.source, title: (p.title || '').slice(0, 200), text: p.text.slice(0, 1400) }));
  if (!compact.length) return null;

  const raw = await groqChat(
    [{
      role: 'user',
      content: `أنت مساعد فقهي في منصة «بصيرة». مهمتك صياغة *إجابة مباشرة وواضحة* على سؤال المستخدم اعتمادًا حصريًا على المقاطع المسترجعة من المصادر المعتمدة أدناه (لا معرفة خارجية).

قواعد صارمة:
1) لا تُضِف أي حكم أو دليل من خارج المقاطع. إن لم تُجب المقاطع السؤال، اجعل "supported": false.
2) اذكر الخلاصة صريحة وموجزة (مثل: «الكذب حرام» أو «يجوز كذا بشرط كذا»).
3) بيّن هل المسألة «إجماع» أم «خلاف» أم «غير مذكور» بحسب المقاطع.
4) انقل الأدلة نصًّا من المقاطع (اقتباس) دون اختلاق مصدر أو رقم.
5) لا تُصدر فتوى من نفسك، ولا تنسب للمصادر ما ليس فيها.

السؤال:
<<<${question}>>>

المقاطع المسترجعة من المصادر المعتمدة:
${JSON.stringify(compact)}

أعد JSON فقط:
{"supported": true, "answer": "الخلاصة المباشرة", "consensus": "إجماع|خلاف|غير مذكور", "evidence": ["اقتباس دليل 1", "اقتباس دليل 2"], "confidence": 0.0}`
    }],
    {
      model: GROQ_TEXT_MODEL,
      temperature: 0,
      maxTokens: 900,
      json: true,
      timeoutMs: 15000
    }
  );

  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed.answer !== 'string' || !parsed.answer.trim()) return null;

    const answer = String(parsed.answer).trim();
    const rawEvidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((e: unknown): e is string => typeof e === 'string').map((e: string) => e.trim())
      : [];

    // GROUNDING GUARD: every piece of evidence must actually occur in the
    // retrieved passages. This rejects invented placeholders such as
    // «دليل 1 — دليل 2» or any quote that is not in the sources.
    const passageTokens = new Set(
      normalizeArabic(compact.map(p => p.text).join(' \n ')).split(/\s+/).filter(Boolean)
    );
    const isGrounded = (s: string): boolean => {
      if (s.length < 15 || !/[\u0621-\u064A]/.test(s)) return false;
      const words = normalizeArabic(s).split(/\s+/).filter(w => w.length >= 3);
      if (words.length < 3) return false;
      const hits = words.filter(w => passageTokens.has(w)).length;
      return hits / words.length >= 0.6;
    };
    const evidence = rawEvidence.filter(isGrounded);
    const answerGrounded = isGrounded(answer) || evidence.length > 0;

    // If nothing is grounded in the retrieved passages, do not answer at all.
    if (!answerGrounded) return null;

    return {
      supported: Boolean(parsed.supported),
      answer,
      consensus: typeof parsed.consensus === 'string' ? parsed.consensus.trim() : '',
      evidence: evidence.slice(0, 4),
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0
    };
  } catch {
    return null;
  }
}

/**
 * Semantic topic judgement for Fiqh retrieval.
 *
 * Given the user's question and the retrieved encyclopedia entries (title +
 * excerpt), the model decides whether any entry actually addresses THIS
 * question's subject — not merely a neighbouring topic in the same chapter.
 * Returns the chosen candidate index (or -1 when none is on-topic), or null when
 * the model is unavailable (caller falls back to deterministic checks).
 */
export async function judgeFiqhTopicRelevance(
  question: string,
  candidates: Array<{ title?: string; text?: string }>
): Promise<{ candidate_index: number; confidence: number } | null> {
  const apiKey = getGroqKey();
  if (!apiKey || !question.trim() || candidates.length === 0) return null;

  const compact = candidates.slice(0, 6).map((c, index) => ({
    index,
    title: (c.title || '').slice(0, 200),
    excerpt: (c.text || '').slice(0, 500)
  }));

  const raw = await groqChat(
    [{
      role: 'user',
      content: `أنت محقق فقهي في منصة «بصيرة». أمامك سؤال المستخدم وقائمة مواد مسترجعة من «الموسوعة الفقهية المقارنة بالدرر السنية».
مهمتك الوحيدة: تحديد أي مادة تتناول *صلب مسألة السؤال بعينها* (نفس الموضوع والفعل المقصود بالاستفتاء)، لا مادة عن بابٍ آخر مختلف ولا شرطاً إجرائياً في فرع بعيد.
قواعد حاسمة:
1) إذا كان السؤال عن حكم خلق أو فعل عام (مثل حكم الكذب، الظلم، الغيبة، الصدق) وكانت المادة المسترجعة مجرد شرط إجرائي أو فرعي في باب قضائي أو تعاقدي (مثل ألا يكذب المقر له المقر في باب الإقرار، أو شرط في البيوع)، فهذه ليست نفس مسألة السؤال؛ أعد candidate_index = -1 فوراً.
2) إذا كانت المادة لا تجيب عن السؤال مباشرة كأصل في المسألة، أعد candidate_index = -1.
3) لا تعتمد على معرفتك الخارجية، ولا تُصدر فتوى، واختر فقط من المواد المرسلة إن كانت مطابقة لصلب المسألة.

السؤال:
<<<${question}>>>

المواد:
${JSON.stringify(compact)}

أعد JSON فقط:
{"candidate_index": <رقم المادة المطابقة أو -1>، "confidence": 0.0، "reason": "سبب موجز جدًا"}`
    }],
    {
      model: GROQ_TEXT_MODEL,
      temperature: 0,
      maxTokens: 512,
      json: true,
      reasoningEffort: 'none',
      timeoutMs: 9000
    }
  );

  try {
    const parsed = JSON.parse(String(raw));
    const idx = Number(parsed?.candidate_index);
    const confidence = typeof parsed?.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;
    if (!Number.isInteger(idx)) return { candidate_index: -1, confidence: 0 };
    const clamped = Math.max(-1, Math.min(compact.length - 1, idx));
    return { candidate_index: clamped, confidence };
  } catch {
    return null;
  }
}
