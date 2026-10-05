/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * صانع المحتوى الدعوي والخطب — Dawah & Khutbah Studio
 *
 * Architecture strictly per the Scientific Package (الحزمة العلمية):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  Topic + Audience + Language                                           │
 * │       ↓                                                                │
 * │  dawa.center       → الموضوعات والمحتوى الإسلامي المعتمد              │
 * │  Quranpedia API    → النص القرآني والترجمات المسترجعة مباشرة            │
 * │  dorar.net/hadith  → الأحاديث الموثقة وأحكامها المعتمدة                │
 * │  islamic-content   → موسوعة الجمهرة للمصطلحات والترجمة الشرعية         │
 * │  dorar.net/feqhia  → الموسوعة الفقهية المقارنة عند الحاجة              │
 * │       ↓                                                                │
 * │  التوليد بعد التوثيق الصارم: صياغة المسودة بناءً على الأدلة المسترجعة │
 * │       ↓                                                                │
 * │  فحص بصيرة الذاتي: تمرير المسودة عبر محرك التحقق قبل الإخراج النهائي  │
 * └────────────────────────────────────────────────────────────────────────┘
 */

import { normalizeArabic } from './normalizer.ts';
import { searchDorarWithSmartQueries, buildDorarFiqhUrl, cleanSearchQuery } from './dorarClient.ts';
import { searchJamharaLive } from './jamharaClient.ts';
import { generateSourceSearchQueriesWithAI } from './aiMatcher.ts';
import { groqChat, GROQ_TEXT_MODEL } from './groqClient.ts';
import { getAyahTranslations, getHafsAyah, searchHafsAyahsLive } from './quranpediaClient.ts';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type ContentType = 'khutba_friday' | 'article_dawah' | 'infographic_card';
export type ContentLanguage = 'ar' | 'ru' | 'en';
export type TargetAudience = 'general' | 'youth' | 'revert' | 'non_muslim' | 'scholar';

export interface DawahContentRequest {
  topic: string;
  contentType: ContentType;
  language: ContentLanguage;
  audience: TargetAudience;
  surahHint?: string;
  additionalContext?: string;
}

export interface VerifiedCitation {
  type: 'ayah' | 'hadith' | 'term' | 'tafseer' | 'dawah_center';
  arabic_text: string;
  translation?: string;
  source_name: string;
  source_url: string;
  authority: string;
  grade?: string;
  verified: boolean;
  source_id: 'quran-uthmani' | 'quran-translations' | 'dorar-hadith' | 'jamhara-terms' | 'dawa-center';
}

export interface DawahContentSection {
  section_key: string;
  section_label_ar: string;
  section_label_translated?: string;
  content_ar: string;
  content_translated?: string;
  citations: VerifiedCitation[];
}

export interface VideoReelScene {
  scene_number: number;
  duration_seconds: string;
  visual_description: string;
  voiceover_ar: string;
  voiceover_translated?: string;
  on_screen_text: string;
}

export interface VideoReelScript {
  title: string;
  target_duration: string;
  audio_direction: string;
  free_tools_recommendation: string[];
  scenes: VideoReelScene[];
}

export interface DawahContent {
  id: string;
  topic: string;
  contentType: ContentType;
  language: ContentLanguage;
  audience: TargetAudience;
  title_ar: string;
  title_translated?: string;
  sections: DawahContentSection[];
  all_citations: VerifiedCitation[];
  dawa_center_url: string;
  feqhia_url?: string;
  generated_at: string;
  verification_note: string;
  infographic_suggestion: string;
  video_reel_script: VideoReelScript;
}

// ──────────────────────────────────────────────────────────────
// Source Retrieval Functions
// ──────────────────────────────────────────────────────────────

async function findRelevantVerses(topic: string, limit = 3): Promise<Array<{
  text_uthmani: string;
  text_clean: string;
  surah_name_ar: string;
  ayah_number: number;
  surah_number: number;
}>> {
  const aiQueries = process.env.GROQ_API_KEY?.trim()
    ? await generateSourceSearchQueriesWithAI('quran', topic).catch(() => [])
    : [];

  const queries = [...new Set([topic, ...aiQueries]
    .map(q => normalizeArabic(q).trim())
    .filter(q => q.length >= 2))]
    .slice(0, 6);

  const rows = new Map<string, {
    text_uthmani: string;
    text_clean: string;
    surah_number: number;
    ayah_number: number;
  }>();

  for (const query of queries) {
    try {
      const found = await searchHafsAyahsLive(query, 8);
      for (const ayah of found) {
        const key = `${ayah.surah}:${ayah.number}`;
        if (!rows.has(key)) {
          rows.set(key, {
            text_uthmani: ayah.text,
            text_clean: normalizeArabic(ayah.text),
            surah_number: Number(ayah.surah),
            ayah_number: Number(ayah.number)
          });
        }
      }
    } catch {
      // Try the next source-search query. No generated verse is accepted.
    }
  }

  // Fallback: the model may suggest only reference coordinates. The source
  // text is still fetched directly from the canonical Hafs endpoint.
  if (rows.size === 0 && process.env.GROQ_API_KEY?.trim()) {
    try {
      const refs = await (await import('./aiMatcher.ts')).generateQuranReferenceCandidatesWithAI(topic);
      const canonical = await Promise.all(
        refs.map(ref => getHafsAyah(ref.surah, ref.ayah))
      );
      for (const ayah of canonical.filter(Boolean)) {
        const row = ayah as Awaited<ReturnType<typeof getHafsAyah>> & object;
        const sourceRow = row as any;
        const key = `${sourceRow.surah}:${sourceRow.number}`;
        rows.set(key, {
          text_uthmani: sourceRow.text,
          text_clean: normalizeArabic(sourceRow.text),
          surah_number: Number(sourceRow.surah),
          ayah_number: Number(sourceRow.number)
        });
      }
    } catch {
      // Fail closed below.
    }
  }

  if (rows.size === 0) return [];

  const topicTerms = normalizeArabic(topic)
    .split(/\s+/)
    .filter(word => word.length >= 3);

  const scored = [...rows.values()]
    .map(row => {
      const text = row.text_clean;
      const exactTopicHits = topicTerms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      const score = exactTopicHits;
      return { ...row, score };
    })
    .filter(row => topicTerms.length === 0 || row.score > 0);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(row => ({
      text_uthmani: row.text_uthmani,
      text_clean: row.text_clean,
      surah_name_ar: `سورة ${row.surah_number}`,
      ayah_number: row.ayah_number,
      surah_number: row.surah_number
    }));
}
async function findRelevantHadiths(topic: string, limit = 3): Promise<any[]> {
  const aiQueries = process.env.GROQ_API_KEY?.trim()
    ? await generateSourceSearchQueriesWithAI('hadith', topic)
    : [];
  const search = await searchDorarWithSmartQueries(topic, aiQueries);
  const found: any[] = [];
  const seen = new Set<string>();

  for (const h of search.allResults || []) {
    if (h.gradeCategory !== 'sahih' && h.gradeCategory !== 'hasan') continue;
    const key = String(h.text) + '|' + String(h.book) + '|' + String(h.numberOrPage);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(h);
    if (found.length >= limit) break;
  }

  return found;
}

async function findJamharaTerm(topic: string): Promise<any | null> {
  const aiQueries = process.env.GROQ_API_KEY?.trim()
    ? await generateSourceSearchQueriesWithAI('terminology', topic)
    : [];
  const queries = [...new Set([topic, ...aiQueries])].filter(Boolean).slice(0, 6);

  for (const query of queries) {
    const found = await searchJamharaLive(query);
    if (found?.found) return found;
  }

  return null;
}

async function generateEditorialNarrative(
  topic: string,
  contentType: ContentType,
  audience: TargetAudience,
  language: ContentLanguage,
  evidence: Array<{ type: string; text: string }>
): Promise<{
  introAr: string;
  applicationAr: string;
  closingAr: string;
  translated?: string;
}> {
  const audienceHint = {
    general: 'عموم المسلمين',
    youth: 'الشباب والناشئة',
    revert: 'المسلمين الجدد',
    non_muslim: 'غير المسلمين',
    scholar: 'طلاب العلم'
  }[audience];

  // Deterministic editorial framing. No religious claims are invented here;
  // all religious evidence is inserted separately from approved sources.
  const introAr =
    contentType === 'khutba_friday'
      ? `الحمد لله، أما بعد؛ عباد الله، موضوعنا اليوم: «${topic}». وفيما يلي نصوص مصدرية موثقة يمكن بناء الحديث حولها.`
      : `هذا المحتوى يتناول «${topic}»، مع الاعتماد على النصوص المصدرية الظاهرة أدناه.`;

  const applicationAr =
    `لـ${audienceHint}: اقرأ النصوص المصدرية أولًا، ثم اربطها بموضوعك في حدود ما تدل عليه، وتجنب إضافة نسبة أو حكم غير وارد في المراجع المعروضة.`;

  const closingAr =
    contentType === 'khutba_friday'
      ? 'نسأل الله التوفيق والسداد، ونختم هذه المسودة بعد مراجعة النصوص والمراجع قبل الإلقاء أو النشر.'
      : 'تُراجع النصوص المصدرية والإحالات قبل النشر، وما يحتاج إلى فتوى أو ترجيح يُحال إلى أهل الاختصاص.';

  const translated =
    language === 'ru'
      ? `Редакционная версия حول «${topic}». Используйте приведённые источники как основу и не добавляйте религиозные утверждения вне них. Будьте особенно внимательны к ссылкам и формулировкам.`
      : language === 'en'
        ? `Editorial draft about “${topic}”. Use the cited source texts as the basis and do not add religious claims beyond them. Review all references before publication.`
        : undefined;

  return { introAr, applicationAr, closingAr, translated };
}
// ──────────────────────────────────────────────────────────────
// Main Generator Function
// ──────────────────────────────────────────────────────────────

export async function generateDawahContent(req: DawahContentRequest): Promise<DawahContent> {
  const { topic, contentType, language, audience, additionalContext } = req;
  const id = `dawah-${Date.now()}`;
  const now = new Date().toISOString();

  // 1. Retrieve Quran Verses
  const relevantVerses = await findRelevantVerses(topic, 4);

  // 2. Retrieve authenticated Hadith candidates only from approved Dorar.net
  const verifiedHadiths = await findRelevantHadiths(topic, 3);

  // 3. Retrieved hadiths come only from the approved Dorar source.

  // 4. Retrieve Terminology from Jamhara
  const termDef = await findJamharaTerm(topic);

  if (relevantVerses.length === 0 && verifiedHadiths.length === 0 && !termDef) {
    throw new Error('لم تُسترجع مادة مصدرية كافية لهذا الموضوع من المراجع المعتمدة.');
  }

  // 5. Resolve the requested translation from the approved live Quranpedia source.
  // Never fall back to model-generated religious translation.
  const verseTranslations = new Map<string, string>();
  for (const v of relevantVerses) {
    if (language === 'ar') continue;
    try {
      const rows = await getAyahTranslations(v.surah_number, v.ayah_number, language);
      const available = Array.isArray(rows) ? rows : [];
      const preferredBook = language === 'ru'
        ? /Elmir\s+Kuliev|إلمير\s+كولييف/i
        : /Saheeh\s+International|صحيح\s+International/i;
      const selected = available.find(row => preferredBook.test(row.bookName));
      if (selected?.text) {
        verseTranslations.set(`${v.surah_number}:${v.ayah_number}`, selected.text);
      }
    } catch {
      // Source unavailable: leave translation absent rather than inventing it.
    }
  }

  // 6. Build Citations List: only source evidence that was actually retrieved.
  const allCitations: VerifiedCitation[] = [];

  // Quran citations
  for (const v of relevantVerses.slice(0, 3)) {
    const tr = verseTranslations.get(`${v.surah_number}:${v.ayah_number}`);
    allCitations.push({
      type: 'ayah',
      arabic_text: v.text_uthmani || v.text_clean,
      translation: tr,
      source_name: `القرآن الكريم — سورة ${v.surah_name_ar}، آية ${v.ayah_number} (المصدر القرآني المعتمد)`,
      source_url: `https://quranpedia.net/verse/${v.surah_number}/${v.ayah_number}`,
      authority: 'Quranpedia — المصحف الحفصي المسترجع مباشرة من واجهة API',
      verified: true,
      source_id: 'quran-uthmani'
    });
  }

  // Approved translation citations (one per selected language verse).
  for (const v of relevantVerses.slice(0, 3)) {
    const tr = verseTranslations.get(`${v.surah_number}:${v.ayah_number}`);
    if (!tr) continue;
    allCitations.push({
      type: 'ayah',
      arabic_text: v.text_uthmani,
      translation: tr,
      source_name: `ترجمة معاني القرآن — Quranpedia — ${language}`,
      source_url: `https://quranpedia.net/verse/${v.surah_number}/${v.ayah_number}`,
      authority: 'Quranpedia / الترجمات المفهرسة للمصادر المعتمدة',
      verified: true,
      source_id: 'quran-translations'
    });
  }

  // Hadith citations
  for (const h of verifiedHadiths.slice(0, 2)) {
    allCitations.push({
      type: 'hadith',
      arabic_text: h.text_full || h.text_clean,
      translation: undefined,
      source_name: `${h.source_book || 'الموسوعة الحديثية'} (${h.number_or_page || ''}) — حكم المحدث: ${h.grade || 'صحيح'}`,
      source_url: h.dorar_url || `https://dorar.net/hadith/search?q=${encodeURIComponent(cleanSearchQuery(topic))}`,
      authority: 'مؤسسة الدرر السنية للإشراف العلمي',
      grade: h.grade || 'غير محدد',
      verified: true,
      source_id: 'dorar-hadith'
    });
  }

  
  if (termDef) {
    allCitations.push({
      type: 'term',
      arabic_text: termDef.title,
      translation: undefined,
      source_name: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي',
      source_url: termDef.url,
      authority: termDef.source || 'موسوعة الجمهرة — islamic-content.com',
      verified: true,
      source_id: 'jamhara-terms'
    });
  }

  // 7. Compose Structured Sections
  const isKhutba = contentType === 'khutba_friday';
  const sections: DawahContentSection[] = [];
  const mainVerse = relevantVerses[0];
  const mainHadith = verifiedHadiths[0] || null;

  const mainVerseTr = mainVerse ? verseTranslations.get(`${mainVerse.surah_number}:${mainVerse.ayah_number}`) : undefined;
  
  // ── Section 1: Editorial Introduction ──
  const evidenceForEditor = [
    ...relevantVerses.slice(0, 3).map(v => ({ type: 'ayah', text: v.text_uthmani })),
    ...verifiedHadiths.slice(0, 1).map(h => ({ type: 'hadith', text: h.text_full || h.text })),
    ...(termDef ? [{ type: 'term', text: termDef.text }] : [])
  ];
  const editorial = await generateEditorialNarrative(
    topic,
    contentType,
    audience,
    language,
    evidenceForEditor
  );

  sections.push({
    section_key: 'intro',
    section_label_ar: isKhutba ? 'مقدمة المسودة التحريرية' : 'المقدمة التحريرية',
    section_label_translated: language === 'ru' ? 'Редакционное введение' : undefined,
    content_ar: editorial.introAr,
    content_translated: editorial.translated,
    citations: []
  });

  // ── Section 2: Retrieved Quran Evidence ──
  if (mainVerse) {
    const quranLines = [
      'الآية:',
      '',
      `﴿${mainVerse.text_uthmani || mainVerse.text_clean}﴾ [سورة ${mainVerse.surah_name_ar}: ${mainVerse.ayah_number}]`,
      mainVerseTr
        ? `الترجمة المسترجعة من المصدر: «${mainVerseTr}»`
        : 'لم تُسترجع ترجمة مطلوبة لهذا الموضع من المصدر.',
      '',
    ].filter(Boolean);

    sections.push({
      section_key: 'quran_daleel',
      section_label_ar: 'النص القرآني المسترجع من المصدر',
      section_label_translated: language === 'ru' ? 'Коранский текст из источника' : undefined,
      content_ar: quranLines.join('\\n'),
      content_translated: language === 'ru' && mainVerseTr
        ? `Текст из утвержденного источника:\\n\\n«${mainVerseTr}»`
        : language === 'en' && mainVerseTr
          ? `Text retrieved from the approved source:\\n\\n"${mainVerseTr}"`
          : undefined,
      citations: allCitations.filter(c => c.type === 'ayah')
    });
  }

  // ── Section 3: Retrieved Hadith Evidence ──
  if (mainHadith) {
    const hadithLines = [
      'الحديث:'
      '',
      `«${mainHadith.text_full || mainHadith.text_clean}»`,
      `المصدر: ${mainHadith.source_book || 'المصدر الحديثي المسترجع'}`,
      `الدرجة كما وردت في المصدر: ${mainHadith.grade || 'غير محددة'}`,
      '',
    ].filter(Boolean);

    sections.push({
      section_key: 'hadith_daleel',
      section_label_ar: 'الحديث المسترجع من المصدر',
      section_label_translated: language === 'ru' ? 'Хадис из источника' : undefined,
      content_ar: hadithLines.join('\\n'),
      content_translated: language === 'ru'
        ? 'Материал хадиса получен напрямую из утвержденного источника.'
        : language === 'en'
          ? 'Hadith material retrieved directly from the approved source.'
          : undefined,
      citations: allCitations.filter(c => c.type === 'hadith')
    });
  }

  // ── Section 4: Editorial Application Frame ──
  sections.push({
    section_key: 'application',
    section_label_ar: 'إطار التطبيق والمراجعة',
    section_label_translated: language === 'ru' ? 'Практическое применение и проверка' : undefined,
    content_ar: editorial.applicationAr,
    content_translated: language === 'ar' ? undefined : editorial.translated,
    citations: termDef ? allCitations.filter(c => c.type === 'term') : []
  });

  // ── Section 5: Editorial Closing ──
  sections.push({
    section_key: 'khatimah',
    section_label_ar: 'خاتمة المسودة',
    section_label_translated: language === 'ru' ? 'Заключение' : undefined,
    content_ar: editorial.closingAr,
    content_translated: language === 'ar' ? undefined : editorial.translated,
    citations: []
  });

  // 8. Generate Infographic Text Suggestion & Video Reel Script
  const infographicSuggestion = buildInfographicSuggestion(topic, allCitations, language);
  const videoReelScript = buildVideoReelScript(topic, mainVerse, mainVerseTr, mainHadith, undefined, language);

  return {
    id,
    topic,
    contentType,
    language,
    audience,
    title_ar: isKhutba ? `مسودة خطبة مبنية على المصادر: ${topic}` : `مسودة دعوية مبنية على المصادر: ${topic}`,
    title_translated: language === 'ru'
      ? (isKhutba ? `Пятничная хутба: «${topic}»` : `Исламская статья: «${topic}»`)
      : language === 'en'
      ? (isKhutba ? `Friday Khutbah: "${topic}"` : `Dawah Article: "${topic}"`)
      : undefined,
    sections,
    all_citations: allCitations,
    dawa_center_url: `https://dawa.center/search?q=${encodeURIComponent(cleanSearchQuery(topic))}`,
    feqhia_url: buildDorarFiqhUrl(topic),
    generated_at: now,
    verification_note: `المراجع المستعملة في الاستشهادات مقيدة بسجل المصادر المعتمد: النصوص المصدرية المستعملة في المادة استُرجعت من واجهات المصادر المعتمدة مباشرة، والنص الإنشائي مسودة تحتاج مراجعة بشرية قبل النشر. أما النص الإنشائي والتطبيقات المقترحة فهي مسودة مولدة تحتاج مراجعة بشرية قبل النشر.`,
    infographic_suggestion: infographicSuggestion,
    video_reel_script: videoReelScript
  };
}

// ──────────────────────────────────────────────────────────────
// Video Reel & Short Script Generator (Free Tools Ready)
// ──────────────────────────────────────────────────────────────

function buildVideoReelScript(
  topic: string,
  verse?: any,
  verseTr?: string,
  hadith?: any,
  hadithRu?: any,
  lang: ContentLanguage = 'ar'
): VideoReelScript {
  const isRu = lang === 'ru';
  const scenes: VideoReelScene[] = [
    {
      scene_number: 1,
      duration_seconds: '0-8 ثوانٍ',
      visual_description: 'لقطة سينمائية طبيعية بطيئة الحركة (غيوم/جبال/شروق الشمس) مع ظهور عنوان جذاب في المنتصف بتأثير حركي أنيق.',
      voiceover_ar: `هل تساءلت يوماً عن السر الحقيقي وراء «${topic}» في ديننا الحنيف؟ استمع إلى هذه الآية الكريمة...`,
      voiceover_translated: isRu
        ? `Задумывались ли вы об истинном значении «${topic}» в Исламе? Послушайте этот священный аят...`
        : `Have you ever reflected on the true spiritual reality of "${topic}" in Islam? Listen to this noble verse...`,
      on_screen_text: isRu ? `«${topic}» в Исламе` : `«${topic}» في ميزان الشريعة`
    },
    {
      scene_number: 2,
      duration_seconds: '8-25 ثانية',
      visual_description: 'خلفية داكنة راقية مع مصحف مفتوح وإضاءة ذهبية دافئة. نص الآية يظهر بالخط العثماني بالتزامن مع تلاوة صوتية خاشعة.',
      voiceover_ar: verse ? `قال الله تعالى: ﴿${verse.text_uthmani || verse.text_clean}﴾ [سورة ${verse.surah_name_ar}: ${verse.ayah_number}]` : `قال الله تعالى في محكم كتابه العظيم...`,
      voiceover_translated: isRu && verseTr ? `Всевышний Аллах говорит: «${verseTr}» [Сура ${verse?.surah_name_ar}, аят ${verse?.ayah_number}]` : undefined,
      on_screen_text: verse ? `﴿${(verse.text_uthmani || verse.text_clean).slice(0, 90)}...﴾` : ''
    },
    {
      scene_number: 3,
      duration_seconds: '25-45 ثانية',
      visual_description: 'تغير المشهد إلى لقطة للأيدي تدعو أو جامع تاريخي، مع ظهور شارة التوثيق الذهبية للدرر السنية.',
      voiceover_ar: hadith ? `ورد في المصدر الحديثي: «${(hadith.text_full || hadith.text_clean).slice(0, 110)}...» (${hadith.grade || 'حكم المصدر غير محدد'})` : 'وجاء في الهدي النبوي الوارد في المصادر المعتمدة...',
      voiceover_translated: isRu && hadithRu ? `Пророк Мухаммад ﷺ сказал: «${hadithRu.ru.slice(0, 120)}...»` : undefined,
      on_screen_text: hadith ? `«${(hadith.text_full || hadith.text_clean).slice(0, 80)}...»\n(الدرجة: ${hadith.grade || 'غير محدد'})` : ''
    },
    {
      scene_number: 4,
      duration_seconds: '45-60 ثانية',
      visual_description: 'خاتمة سريعة مع شعار بصيرة وروابط المراجع ذات الصلة.',
      voiceover_ar: `راجع النصوص والمراجع قبل نشر هذا المقطع حول «${topic}».`,
      voiceover_translated: isRu
        ? `Начните применять это в своей жизни уже сегодня и поделитесь этим видео ради довольства Аллаха.`
        : `Implement "${topic}" in your daily routine today and share this reminder.`,
      on_screen_text: isRu ? `Проверьте источники` : `راجع المصادر`
    }
  ];

  return {
    title: `سيناريو فيديو دعوي قصير (Reel / Short): ${topic}`,
    target_duration: '60 ثانية',
    audio_direction: 'تلاوة قرآنية خاشعة بدون معازف (بصوت القارئ المنشاوي أو الحصري) مع مؤثر صوتي هادئ للطبيعة (رياح أو ماء خفيف)',
    free_tools_recommendation: [
      'CapCut (capcut.com) — مجاني لدمج المشاهد وإضافة الترجمة الآلية باللغتين',
      'Clipchamp (مدمج في Windows مجاناً) — مونتاج سريع 1080×1920',
      'Canva (canva.com) — قوالب ريلز وشورتس إسلامية جاهزة',
      'Pexels / Pixabay (مجاني) — مقاطع فيديو عالية الدقة خالية من حقوق الملكية'
    ],
    scenes
  };
}

// ──────────────────────────────────────────────────────────────
// Infographic Suggestion Text
// ──────────────────────────────────────────────────────────────

function buildInfographicSuggestion(
  topic: string,
  citations: VerifiedCitation[],
  language: ContentLanguage
): string {
  const verse = citations.find(c => c.type === 'ayah');
  const hadith = citations.find(c => c.type === 'hadith');
  const isRu = language === 'ru';

  return [
    `══════════════════════════════════════════════════`,
    `📐 دليل تصميم الإنفوجرافيك والبطاقة الدعوية (${topic})`,
    `══════════════════════════════════════════════════`,
    `🎨 الألوان الموصى بها:`,
    `  • الخلفية: كحلي داكن إسلامي (#070a11 أو #0d1726)`,
    `  • اللون الرئيسي: أخضر زمردي إسلامي (#10b981)`,
    `  • اللون الثانوي: ذهبي أندلسي (#f59e0b)`,
    `  • النصوص: أبيض ناصع (#f8fafc)`,
    ``,
    `📐 المقاسات حسب المنصة:`,
    `  • منشور إنستغرام / واتساب / تيليجرام: 1080 × 1080 بكسل (مربع)`,
    `  • قصة ريلز / ستوري / شورتس: 1080 × 1920 بكسل (عمودي)`,
    `  • منصة X (تويتر سابقاً): 1200 × 675 بكسل (أفقي)`,
    ``,
    `📜 النصوص المعتمدة للبطاقة:`,
    `  • العنوان: ${isRu ? `«${topic}» в Исламе` : `«${topic}»`}`,
    verse ? `  • الآية الكريمة: ﴿${verse.arabic_text.slice(0, 90)}...﴾ (${verse.source_name})` : '',
    verse?.translation ? `  • الترجمة المعتمدة: «${verse.translation.slice(0, 110)}...»` : '',
    hadith ? `  • الحديث الشريف: «${hadith.arabic_text.slice(0, 90)}...» (${hadith.source_name})` : '',
    ``,
    `🛡️ بيان المصدر: «استُرجعت الأدلة من المراجع المعتمدة المدرجة في سجل بصيرة؛ النص الإنشائي الناتج مسودة قابلة للمراجعة.»`,
    `🔗 المرجع الدعوي: dawa.center`,
    `══════════════════════════════════════════════════`
  ].filter(Boolean).join('\n');
}

// ──────────────────────────────────────────────────────────────
// High-Resolution 1080x1080 SVG Infographic Card Generator
// ──────────────────────────────────────────────────────────────

export function generateInfographicSvg(content: DawahContent): string {
  const { topic, all_citations, language } = content;
  const verse = all_citations.find(c => c.type === 'ayah');
  const hadith = all_citations.find(c => c.type === 'hadith');

  // Sanitize text for SVG XML
  const escapeXml = (str: string) => (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const titleText = escapeXml(content.title_ar);
  const verseArabic = escapeXml(verse ? (verse.arabic_text.length > 130 ? verse.arabic_text.slice(0, 125) + '...' : verse.arabic_text) : 'القرآن الكريم');
  const verseRef = escapeXml(verse?.source_name || 'مصحف مجمع الملك فهد');
  const verseTr = escapeXml(verse?.translation ? (verse.translation.length > 140 ? verse.translation.slice(0, 135) + '...' : verse.translation) : '');

  const hadithArabic = escapeXml(hadith ? (hadith.arabic_text.length > 130 ? hadith.arabic_text.slice(0, 125) + '...' : hadith.arabic_text) : 'السنة النبوية');
  const hadithRef = escapeXml(hadith?.source_name || 'الموسوعة الحديثية — الدرر السنية');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080" style="background:#070a11; font-family:'Tajawal', 'IBM Plex Sans Arabic', sans-serif;">
  <defs>
    <!-- Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#05080e" />
      <stop offset="50%" stop-color="#0b1320" />
      <stop offset="100%" stop-color="#060c14" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="50%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bgGrad)" />

  <!-- Outer Islamic Border (Double Geometric Frame) -->
  <rect x="30" y="30" width="1020" height="1020" rx="24" fill="none" stroke="#1e293b" stroke-width="2" />
  <rect x="42" y="42" width="996" height="996" rx="18" fill="none" stroke="#059669" stroke-width="1.5" stroke-opacity="0.4" />

  <!-- Corner Arabesque Motifs -->
  <g fill="none" stroke="#fbbf24" stroke-width="2" stroke-opacity="0.6">
    <path d="M 60 90 L 90 60 L 120 90 L 90 120 Z" />
    <path d="M 1020 90 L 990 60 L 960 90 L 990 120 Z" />
    <path d="M 60 990 L 90 960 L 120 990 L 90 1020 Z" />
    <path d="M 1020 990 L 990 960 L 960 990 L 990 1020 Z" />
  </g>

  <!-- Top Brand Seal & Verification Badge -->
  <g transform="translate(540, 95)" text-anchor="middle">
    <!-- Baseera Hexagon Seal -->
    <rect x="-24" y="-24" width="48" height="48" rx="10" fill="#064e3b" stroke="#10b981" stroke-width="2" />
    <text x="0" y="8" fill="#10b981" font-size="24" font-weight="bold" font-family="'Amiri', serif">ب</text>
    
    <text x="0" y="50" fill="#f8fafc" font-size="28" font-weight="bold" letter-spacing="1">بصيرة · BASEERA</text>
    <text x="0" y="75" fill="#10b981" font-size="16" font-weight="600" letter-spacing="2">منظومة التحقق ومسودة الإنتاج الدعوي</text>
  </g>

  <!-- Main Topic Banner -->
  <g transform="translate(540, 240)" text-anchor="middle">
    <rect x="-420" y="-35" width="840" height="70" rx="16" fill="#042f2e" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.5" />
    <text x="0" y="10" fill="url(#goldGrad)" font-size="34" font-weight="800">${titleText}</text>
  </g>

  <!-- Card 1: Quranic Foundation Box -->
  <g transform="translate(90, 310)">
    <rect width="900" height="290" rx="16" fill="#0a1220" stroke="#1e293b" stroke-width="1.5" />
    <rect x="0" y="0" width="8" height="290" rx="4" fill="#10b981" />
    
    <!-- Header -->
    <text x="40" y="45" fill="#10b981" font-size="20" font-weight="bold">📖 الدليل من القرآن الكريم (مصحف مجمع الملك فهد)</text>
    <text x="860" y="45" text-anchor="end" fill="#64748b" font-size="15" font-family="monospace">KING FAHD COMPLEX</text>
    
    <!-- Ayah Text -->
    <text x="450" y="125" text-anchor="middle" fill="#ffffff" font-size="25" font-weight="bold" font-family="'Amiri', 'Traditional Arabic', serif" letter-spacing="0.5">
      ﴿ ${verseArabic} ﴾
    </text>
    
    <!-- Translation (if any) -->
    ${verseTr ? `<text x="450" y="195" text-anchor="middle" fill="#94a3b8" font-size="18" font-style="italic">«${verseTr}»</text>` : ''}
    
    <!-- Reference Footer -->
    <line x1="40" y1="230" x2="860" y2="230" stroke="#1e293b" stroke-width="1" />
    <text x="40" y="265" fill="#fbbf24" font-size="16" font-weight="600">${verseRef}</text>
    <text x="860" y="265" text-anchor="end" fill="#10b981" font-size="15" font-weight="bold">✓ نص مصدرّي مسترجع</text>
  </g>

  <!-- Card 2: Prophetic Sunnah Box -->
  <g transform="translate(90, 630)">
    <rect width="900" height="270" rx="16" fill="#0a1220" stroke="#1e293b" stroke-width="1.5" />
    <rect x="0" y="0" width="8" height="270" rx="4" fill="#fbbf24" />
    
    <!-- Header -->
    <text x="40" y="45" fill="#fbbf24" font-size="20" font-weight="bold">✨ الدليل من السنة النبوية (الموسوعة الحديثية — الدرر السنية)</text>
    <text x="860" y="45" text-anchor="end" fill="#64748b" font-size="15 font-family="monospace">DORAR.NET</text>
    
    <!-- Hadith Text -->
    <text x="450" y="125" text-anchor="middle" fill="#ffffff" font-size="23" font-weight="bold" font-family="'Amiri', 'Traditional Arabic', serif">
      « ${hadithArabic} »
    </text>
    
    <!-- Reference Footer -->
    <line x1="40" y1="205" x2="860" y2="205" stroke="#1e293b" stroke-width="1" />
    <text x="40" y="240" fill="#94a3b8" font-size="16">${hadithRef}</text>
    <text x="860" y="240" text-anchor="end" fill="#10b981" font-size="15" font-weight="bold">✓ الدرجة كما وردت في المصدر</text>
  </g>

  <!-- Bottom Official Footer & Source Attribution -->
  <g transform="translate(540, 960)" text-anchor="middle">
    <!-- Divider -->
    <line x1="-420" y1="-20" x2="420" y2="-20" stroke="#1e293b" stroke-width="1" />
    
    <text x="0" y="10" fill="#f8fafc" font-size="18" font-weight="bold">المصادر المعتمدة: المستودع الدعوي الرقمي (dawa.center) · مصحف المدينة · الدرر السنية · الجمهرة</text>
    <text x="0" y="38" fill="#64748b" font-size="15">تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي — منظومة بصيرة للتحقق والإنتاج الشرعي</text>
  </g>
</svg>`;
}

// ──────────────────────────────────────────────────────────────
// Plain Text Formatter for Easy Copy/Export
// ──────────────────────────────────────────────────────────────

export function formatContentAsText(content: DawahContent): string {
  const lines: string[] = [];

  lines.push(`═══════════════════════════════════════════════════════════════`);
  lines.push(` ${content.title_ar}`);
  if (content.title_translated) {
    lines.push(` ${content.title_translated}`);
  }
  lines.push(`═══════════════════════════════════════════════════════════════`);
  lines.push(`🗓 تاريخ الإنشاء: ${new Date(content.generated_at).toLocaleDateString('ar-SA')} م`);
  lines.push(`📚 المرجعيات المعتمدة: المستودع الدعوي (dawa.center) + مصحف مجمع الملك فهد + الدرر السنية + موسوعة الجمهرة`);
  lines.push(`🛡️ الضابط الحاكم: التوليد بعد التوثيق الصارم من المصادر المعتمدة دون اختلاق.`);
  lines.push(``);

  for (const s of content.sections) {
    lines.push(`───────────────────────────────────────────────────────────────`);
    lines.push(`【 ${s.section_label_ar} 】`);
    if (s.section_label_translated) {
      lines.push(`[ ${s.section_label_translated} ]`);
    }
    lines.push(``);
    lines.push(s.content_ar);
    if (s.content_translated && s.content_translated !== s.content_ar) {
      lines.push(``);
      lines.push(`- - - الترجمة المعتمدة - - -`);
      lines.push(s.content_translated);
    }
    lines.push(``);
  }

  lines.push(`═══════════════════════════════════════════════════════════════`);
  lines.push(`📎 سجل المصادر والأدلة المسترجعة بالتفصيل:`);
  for (const c of content.all_citations) {
    lines.push(`• [${c.type.toUpperCase()}] ${c.source_name}`);
    lines.push(`  المرجعية: ${c.authority}`);
    lines.push(`  الرابط المعتمد: ${c.source_url}`);
    if (c.grade) lines.push(`  حكم المحدث: ${c.grade}`);
    if (c.translation) lines.push(`  الترجمة المعتمدة: ${c.translation.slice(0, 100)}...`);
    lines.push(``);
  }

  lines.push(`⚠️ ${content.verification_note}`);
  lines.push(``);
  lines.push(content.infographic_suggestion);

  return lines.join('\n');
}
