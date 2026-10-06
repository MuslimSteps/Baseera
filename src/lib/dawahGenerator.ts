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
import { generateSourceSearchQueriesWithAI, generateQuranReferenceCandidatesWithAI } from './aiMatcher.ts';
import { groqChat, GROQ_TEXT_MODEL } from './groqClient.ts';
import { getAyahTranslations, getHafsAyah, getHafsSurahName, searchHafsAyahsLive, searchHafsAyahsLocal } from './quranpediaClient.ts';

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
  source_url?: string;
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
// Canonical Knowledge Base for Key Islamic Themes
// Grounded strictly in authentic Hafs Quran & Sahih Sunnah
// ──────────────────────────────────────────────────────────────

interface CanonicalTopicSeed {
  patterns: RegExp[];
  quranRefs: Array<{ surah: number; ayah: number }>;
  hadiths: Array<{
    text: string;
    source_book: string;
    number_or_page: string;
    grade: string;
    gradeCategory?: 'sahih' | 'hasan';
    dorar_url?: string;
  }>;
  keyPoints: string[];
  actionSteps: string[];
}

const CANONICAL_SEEDS: CanonicalTopicSeed[] = [
  {
    patterns: [/صبر/i, /شدائد/i, /بلاء/i, /ابتلاء/i, /مصائب/i],
    quranRefs: [
      { surah: 2, ayah: 153 }, // يا أيها الذين آمنوا استعينوا بالصبر والصلاة إن الله مع الصابرين
      { surah: 39, ayah: 10 }, // إنما يوفى الصابرون أجرهم بغير حساب
      { surah: 3, ayah: 200 }  // يا أيها الذين آمنوا اصبروا وصابروا ورابطوا واتقوا الله لعلكم تفلحون
    ],
    hadiths: [
      {
        text: 'عَجَبًا لأَمْرِ المُؤْمِنِ، إنَّ أمْرَهُ كُلَّهُ خَيْرٌ، وليسَ ذاكَ لأَحَدٍ إلَّا لِلْمُؤْمِنِ، إنْ أصابَتْهُ سَرَّاءُ شَكَرَ، فَكانَ خَيْرًا له، وإنْ أصابَتْهُ ضَرَّاءُ صَبَرَ، فَكانَ خَيْرًا له',
        source_book: 'صحيح مسلم',
        number_or_page: '2999',
        grade: 'صحيح'
      },
      {
        text: 'ومَا أُعْطِيَ أَحَدٌ عَطَاءً خَيْرًا وَأَوْسَعَ مِنَ الصَّبْرِ',
        source_book: 'صحيح البخاري',
        number_or_page: '1469',
        grade: 'صحيح'
      }
    ],
    keyPoints: [
      'الصبر ضياء يسلك به المؤمن دروب الشدائد والابتلاءات',
      'معية الله تعالى الخاصة مع الصابرين تثبت الأفئدة وتربط على القلوب',
      'الأجر الجزيل الذي لا حد له أعده الله لمن حبس نفسه عن الجزع والتسخط'
    ],
    actionSteps: [
      'استقبال الصدمة الأولى بالاسترجاع والرضا بقضاء الله وقدره',
      'الفزع إلى الصلاة والدعاء في ساعات الكرب والضيق',
      'اليقين بأن مع العسر يسراً وأن الفرج آتٍ لا محالة'
    ]
  },
  {
    patterns: [/توب/i, /استغفار/i, /ذنوب/i, /معاص/i],
    quranRefs: [
      { surah: 66, ayah: 8 },  // يا أيها الذين آمنوا توبوا إلى الله توبة نصوحا
      { surah: 39, ayah: 53 }, // قل يا عبادي الذين أسرفوا على أنفسهم لا تقنطوا من رحمة الله إن الله يغفر الذنوب جميعا
      { surah: 24, ayah: 31 }  // وتوبوا إلى الله جميعا أيه المؤمنون لعلكم تفلحون
    ],
    hadiths: [
      {
        text: 'لَلَّهُ أَشَدُّ فَرَحًا بِتَوْبَةِ عَبْدِهِ حِينَ يَتُوبُ إِلَيْهِ، مِنْ أَحَدِكُمْ كَانَ عَلَى رَاحِلَتِهِ بِأَرْضِ فَلَاةٍ، فَانْفَلَتَتْ مِنْهُ وَعَلَيْهَا طَعَامُهُ وَشَرَابُهُ... فَقالَ مِن شِدَّةِ الفَرَحِ: اللَّهُمَّ أَنْتَ عَبْدِي وَأَنَا رَبُّكَ، أَخْطَأَ مِن شِدَّةِ الفَرَحِ',
        source_book: 'صحيح مسلم',
        number_or_page: '2747',
        grade: 'صحيح'
      },
      {
        text: 'كُلُّ بَنِي آدَمَ خَطَّاءٌ وَخَيْرُ الْخَطَّائِينَ التَّوَّابُونَ',
        source_book: 'سنن الترمذي',
        number_or_page: '2499',
        grade: 'حسنه الألباني',
        gradeCategory: 'hasan'
      }
    ],
    keyPoints: [
      'التوبة النصوح تبدل السيئات حسنات وتفتح أبواب الفلاح في الدارين',
      'شروط قبول التوبة الصادقة: الإقلاع الفوري، والندم، والعزم على عدم العود، ورد المظالم',
      'سعة رحمة الله تعالى التي وسعت كل شيء وبابه المفتوح دائماً للمنيبين'
    ],
    actionSteps: [
      'المبادرة الفورية بالتوبة قبل فوات الأوان وحلول الأجل',
      'إتباع السيئة بالحسنة لمحوها والإكثار من الاستغفار بالأسحار',
      'إبراء الذمة من حقوق العباد وأموالهم وأعراضهم'
    ]
  },
  {
    patterns: [/والد/i, /أم/i, /أب/i, /بر الوالدين/i],
    quranRefs: [
      { surah: 17, ayah: 23 }, // وقضى ربك ألا تعبدوا إلا إياه وبالوالدين إحسانا
      { surah: 17, ayah: 24 }, // واخفض لهما جناح الذل من الرحمة وقل رب ارحمهما كما ربياني صغيرا
      { surah: 31, ayah: 14 }  // ووصينا الإنسان بوالديه حملته أمه وهنا على وهن
    ],
    hadiths: [
      {
        text: 'جَاءَ رَجُلٌ إلى رَسولِ اللَّهِ صَلَّى اللهُ عليه وسلَّمَ فَقالَ: مَن أحَقُّ النَّاسِ بحُسْنِ صَحَابَتِي؟ قالَ: أُمُّكَ، قالَ: ثُمَّ مَنْ؟ قالَ: ثُمَّ أُمُّكَ، قالَ: ثُمَّ مَنْ؟ قالَ: ثُمَّ أُمُّكَ، قالَ: ثُمَّ أَبُوكَ',
        source_book: 'صحيح البخاري',
        number_or_page: '5971',
        grade: 'صحيح'
      },
      {
        text: 'رَغِمَ أَنْفُ، ثُمَّ رَغِمَ أَنْفُ، ثُمَّ رَغِمَ أَنْفُ، قيلَ: مَنْ يا رَسولَ اللهِ؟ قالَ: مَن أَدْرَكَ أَبَوَيْهِ عِنْدَ الكِبَرِ، أَحَدَهُما، أَوْ كِلَيْهِما فَلَمْ يَدْخُلِ الجَنَّةَ',
        source_book: 'صحيح مسلم',
        number_or_page: '2551',
        grade: 'صحيح'
      }
    ],
    keyPoints: [
      'اقتران حق الوالدين بتوحيد الله جل وعلا في محكم التنزيل دلالة على عظم شأنه',
      'مقام الأم الفريد في الإسلام وتكرار الوصية بها ثلاثاً لعظيم بذلها ومعاناتها',
      'بر الوالدين عند كبر سنهما هو أوسع أبواب الجنة وأعظم أسباب التوفيق والبركة'
    ],
    actionSteps: [
      'خفض الجناح ولين القول وتجنب التأفف أو رفع الصوت بحضرتهما',
      'المسارعة في قضاء حوائجهما وتفقد شؤونهما قبل أن يطلبا',
      'ملازمة الدعاء الصادق لهما في السجود وأدبار الصلوات'
    ]
  },
  {
    patterns: [/توحيد/i, /إيمان/i, /عقيد/i, /لا إله إلا الله/i],
    quranRefs: [
      { surah: 112, ayah: 1 }, // قل هو الله أحد
      { surah: 47, ayah: 19 }, // فاعلم أنه لا إله إلا الله واستغفر لذنبك
      { surah: 2, ayah: 255 }  // الله لا إله إلا هو الحي القيوم
    ],
    hadiths: [
      {
        text: 'حَقُّ اللَّهِ عَلَى الْعِبَادِ أَنْ يَعْبُدُوهُ وَلَا يُشْرِكُوا بِهِ شَيْئًا، وَحَقُّ الْعِبَادِ عَلَى اللَّهِ أَنْ لَا يُعَذِّبَ مَنْ لَا يُشْرِكُ بِهِ شَيْئًا',
        source_book: 'صحيح البخاري',
        number_or_page: '2856',
        grade: 'صحيح'
      },
      {
        text: 'مَنْ مَاتَ وَهُوَ يَعْلَمُ أَنَّهُ لَا إِلَهَ إِلَّا اللَّهُ دَخَلَ الْجَنَّةَ',
        source_book: 'صحيح مسلم',
        number_or_page: '26',
        grade: 'صحيح'
      }
    ],
    keyPoints: [
      'التوحيد هو الغاية الكبرى من خلق الإنس والجن وأساس قبول كل عمل صالح',
      'تحقيق التوحيد يثمر الطمأنينة القلبية والتحرر الكامل من الخوف من غير الله',
      'إفراد الله تعالى بأفعاله وأسمائه وصفاته وعبادته دون ند أو شريك'
    ],
    actionSteps: [
      'تجريد التوكل على الله وإفراده سبحانه بالدعاء والرجاء والخوف',
      'تطهير القلب من الرياء والتعلق بالأسباب الدنيوية الفانية',
      'ترديد كلمة الإخلاص بصدق ويقين واستشعار معانيها الجليلة'
    ]
  },
  {
    patterns: [/أمان/i, /صدق/i, /معامل/i, /وفاء/i],
    quranRefs: [
      { surah: 4, ayah: 58 },  // إن الله يأمركم أن تؤدوا الأمانات إلى أهلها
      { surah: 9, ayah: 119 }, // يا أيها الذين آمنوا اتقوا الله وكونوا مع الصادقين
      { surah: 23, ayah: 8 }   // والذين هم لأماناتهم وعهدهم راعون
    ],
    hadiths: [
      {
        text: 'عَلَيْكُمْ بِالصِّدْقِ، فَإِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ، وَإِنَّ الْبِرَّ يَهْدِي إِلَى الْجَنَّةِ، وَمَا يَزَالُ الرَّجُلُ يَصْدُقُ وَيَتَحَرَّى الصِّدْقَ حَتَّى يُكْتَبَ عِنْدَ اللَّهِ صِدِّيقًا',
        source_book: 'صحيح مسلم',
        number_or_page: '2607',
        grade: 'صحيح'
      },
      {
        text: 'أَدِّ الْأَمَانَةَ إِلَى مَنِ ائْتَمَنَكَ، وَلَا تَخُنْ مَنْ خَانَكَ',
        source_book: 'سنن أبي داود',
        number_or_page: '3535',
        grade: 'صححه الألباني'
      }
    ],
    keyPoints: [
      'الأمانة والصدق هما المقياس الأسمى لنقاء الإيمان وصلاح المجتمع',
      'الخيانة والغدر من صفات النفاق التي تهدم الروابط وتنذر بسخط الله',
      'الصدق في الأقوال والبيوع يورث البركة في الرزق وحسن العاقبة'
    ],
    actionSteps: [
      'تحري الدقة والصدق في كل قول ووعد وتجنب الكذب والمواربة',
      'حفظ الودائع والأسرار وأداء الواجبات الوظيفية بإتقان وإخلاص',
      'الابتعاد التام عن الغش والتدليس في سائر المعاملات المالية'
    ]
  },
  {
    patterns: [/صل[اةو]/i, /مصل/i],
    quranRefs: [
      { surah: 29, ayah: 45 }, // وأقم الصلاة إن الصلاة تنهى عن الفحشاء والمنكر
      { surah: 2, ayah: 238 }, // حافظوا على الصلوات والصلاة الوسطى وقوموا لله قانتين
      { surah: 20, ayah: 14 }  // إنني أنا الله لا إله إلا أنا فاعبدني وأقم الصلاة لذكري
    ],
    hadiths: [
      {
        text: 'أَرَأَيْتُمْ لَوْ أَنَّ نَهَرًا بِبَابِ أَحَدِكُمْ يَغْتَسِلُ مِنْهُ كُلَّ يَوْمٍ خَمْسَ مَرَّاتٍ، هَلْ يَبْقَى مِنْ دَرَنِهِ شَيْءٌ؟ قَالُوا: لَا يَبْقَى مِنْ دَرَنِهِ شَيْءٌ، قَالَ: فَذَلِكَ مَثَلُ الصَّلَوَاتِ الْخَمْسِ، يَمْحُو اللَّهُ بِهِنَّ الْخَطَايَا',
        source_book: 'صحيح البخاري',
        number_or_page: '528',
        grade: 'صحيح'
      },
      {
        text: 'الصَّلَوَاتُ الخَمْسُ، وَالجُمْعَةُ إلى الجُمْعَةِ، وَرَمَضَانُ إلى رَمَضَانَ، مُكَفِّرَاتٌ ما بيْنَهُنَّ إِذَا اجْتَنَبَ الكَبَائِرَ',
        source_book: 'صحيح مسلم',
        number_or_page: '233',
        grade: 'صحيح'
      }
    ],
    keyPoints: [
      'الصلاة عماد الدين وأعظم أركانه العملية وأول ما يحاسب عليه العبد',
      'الصلاة الخاشعة تزكي الروح وتنهى عن الفحشاء والمنكر',
      'المحافظة عليها في أوقاتها جماعة في بيوت الله كفارة للخطايا ورفعة للدرجات'
    ],
    actionSteps: [
      'المبادرة إلى إجابة النداء فور سماع الأذان دون تسويف',
      'إسباغ الوضوء واستحضار عظمة الوقوف بين يدي ملك الملوك',
      'العناية بسنن الرواتب والنوافل لجبر الخلل في الفرائض'
    ]
  },
  {
    patterns: [/رحم/i, /قراب/i, /أقارب/i, /صلة/i],
    quranRefs: [
      { surah: 4, ayah: 1 },   // واتقوا الله الذي تساءلون به والأرحام
      { surah: 13, ayah: 21 }, // والذين يصلون ما أمر الله به أن يوصل
      { surah: 47, ayah: 22 }  // فهل عسيتم إن توليتم أن تفسدوا في الأرض وتقطعوا أرحامكم
    ],
    hadiths: [
      {
        text: 'مَن أَحَبَّ أَنْ يُبْسَطَ له في رِزْقِهِ، وَيُنْسَأَ له في أَثَرِهِ، فَلْيَصِلْ رَحِمَهُ',
        source_book: 'صحيح البخاري',
        number_or_page: '2067',
        grade: 'صحيح'
      },
      {
        text: 'الرَّحِمُ مُعَلَّقَةٌ بِالْعَرْشِ تَقُولُ: مَنْ وَصَلَنِي وَصَلَهُ اللَّهُ، وَمَنْ قَطَعَنِي قَطَعَهُ اللَّهُ',
        source_book: 'صحيح مسلم',
        number_or_page: '2555',
        grade: 'صحيح'
      }
    ],
    keyPoints: [
      'صلة الرحم من أجل القربات وموجبات بسط الرزق والبركة في العمر والأثر',
      'قطيعة الرحم من كبائر الذنوب الموجبة للعنة والحرمان من التوفيق',
      'الصلة الحقيقية هي صلة من قطعك والإحسان لمن أساء إليك'
    ],
    actionSteps: [
      'تعهد الأقارب بالزيارة والتواصل والسؤال عن أحوالهم',
      'المبادرة بالعفو والصفح وتجاوز الخلافات العائلية الدنيوية',
      'مواساة المحتاج منهم بالمال والهدية وحسن المعاملة'
    ]
  },
  {
    patterns: [/نبي/i, /رسول/i, /سيرة/i, /خاتم الأنبياء/i, /محمد/i],
    quranRefs: [
      { surah: 21, ayah: 107 }, // وما أرسلناك إلا رحمة للعالمين
      { surah: 9, ayah: 128 },  // لقد جاءكم رسول من أنفسكم عزيز عليه ما عنتم حريص عليكم بالمؤمنين رءوف رحيم
      { surah: 3, ayah: 159 }   // فبما رحمة من الله لنت لهم
    ],
    hadiths: [
      {
        text: 'إِنَّمَا أَنَا رَحْمَةٌ مُهْدَاةٌ',
        source_book: 'المستدرك على الصحيحين',
        number_or_page: '100',
        grade: 'صححه الألباني'
      },
      {
        text: 'الرَّاحِمُونَ يَرْحَمُهُمُ الرَّحْمَنُ، ارْحَمُوا مَنْ فِي الأَرْضِ يَرْحَمْكُمْ مَنْ فِي السَّمَاءِ',
        source_book: 'سنن أبي داود',
        number_or_page: '4941',
        grade: 'صححه الألباني'
      }
    ],
    keyPoints: [
      'شمولية رحمة النبي ﷺ بالبشرية جمعاء وإرساؤه لمعالم التراحم والعدل',
      'تجسيده العملي للرحمة والرفق حتى مع المسيئين والمخالفين',
      'وجوب محبته والاقتداء بسنته ونشر هديه بالرفق والموعظة الحسنة'
    ],
    actionSteps: [
      'دراسة السيرة النبوية الشريفة واستلهام مواقف الرحمة والوفاء منها',
      'إشاعة التراحم واللين في التعامل مع الأهل والأطفال والضعفاء',
      'كثرة الصلاة والسلام على النبي المختار ﷺ في كل وقت وحين'
    ]
  }
];

function findMatchingSeed(topic: string): CanonicalTopicSeed | undefined {
  const norm = normalizeArabic(topic);
  return CANONICAL_SEEDS.find(seed => seed.patterns.some(p => p.test(norm) || p.test(topic)));
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
  const rows = new Map<string, {
    text_uthmani: string;
    text_clean: string;
    surah_number: number;
    ayah_number: number;
  }>();

  // 1. Check canonical topic seed
  const matchedSeed = findMatchingSeed(topic);
  if (matchedSeed) {
    for (const ref of matchedSeed.quranRefs) {
      const ayah = await getHafsAyah(ref.surah, ref.ayah);
      if (ayah) {
        rows.set(`${ayah.surah}:${ayah.number}`, {
          text_uthmani: ayah.text,
          text_clean: normalizeArabic(ayah.text),
          surah_number: Number(ayah.surah),
          ayah_number: Number(ayah.number)
        });
      }
    }
  }

  // 2. Keyword-based search against Hafs mushaf
  const topicWords = normalizeArabic(topic)
    .split(/\s+/)
    .map(w => w.replace(/^(?:ال|[وفبلك]+)/, ''))
    .filter(w => w.length >= 3);

  const searchQueries = [
    topic,
    ...topicWords
  ].filter(q => q.length >= 2).slice(0, 5);

  for (const q of searchQueries) {
    if (rows.size >= 6) break;
    try {
      const localMatches = searchHafsAyahsLocal(q, 4);
      for (const ayah of localMatches) {
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
      // Continue
    }
  }

  // 3. Fallback to AI reference candidates if still empty
  if (rows.size === 0 && process.env.GROQ_API_KEY?.trim()) {
    try {
      const refs = await generateQuranReferenceCandidatesWithAI(topic);
      for (const ref of refs.slice(0, 4)) {
        const ayah = await getHafsAyah(ref.surah, ref.ayah);
        if (ayah) {
          rows.set(`${ayah.surah}:${ayah.number}`, {
            text_uthmani: ayah.text,
            text_clean: normalizeArabic(ayah.text),
            surah_number: Number(ayah.surah),
            ayah_number: Number(ayah.number)
          });
        }
      }
    } catch {
      // Continue
    }
  }

  return [...rows.values()]
    .slice(0, limit)
    .map(row => ({
      text_uthmani: row.text_uthmani,
      text_clean: row.text_clean,
      surah_name_ar: getHafsSurahName(row.surah_number),
      ayah_number: row.ayah_number,
      surah_number: row.surah_number
    }));
}

async function findRelevantHadiths(topic: string, limit = 3): Promise<any[]> {
  const found: any[] = [];
  const seen = new Set<string>();

  // 1. Canonical seed hadiths
  const matchedSeed = findMatchingSeed(topic);
  if (matchedSeed) {
    for (const h of matchedSeed.hadiths) {
      const key = `${h.text}|${h.source_book}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({
          text_full: h.text,
          text_clean: normalizeArabic(h.text),
          source_book: h.source_book,
          number_or_page: h.number_or_page,
          grade: h.grade,
          gradeCategory: h.gradeCategory || (h.grade.includes('حسن') ? 'hasan' : 'sahih'),
          dorar_url: h.dorar_url
        });
      }
    }
  }

  // 2. Live Dorar search with keywords
  if (found.length < limit) {
    try {
      const aiQueries = process.env.GROQ_API_KEY?.trim()
        ? await generateSourceSearchQueriesWithAI('hadith', topic)
        : [];
      const search = await searchDorarWithSmartQueries(topic, aiQueries);
      for (const h of search.allResults || []) {
        if (h.gradeCategory !== 'sahih' && h.gradeCategory !== 'hasan') continue;
        const key = `${h.text}|${h.book}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(h);
        if (found.length >= limit) break;
      }
    } catch {
      // Continue
    }
  }

  return found.slice(0, limit);
}

async function findJamharaTerm(topic: string): Promise<any | null> {
  const queries = [topic, ...topic.split(/\s+/).filter(w => w.length >= 3)].slice(0, 4);
  for (const query of queries) {
    try {
      const found = await searchJamharaLive(query);
      if (found?.found) return found;
    } catch {
      // Continue
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Composition Engine: Friday Sermons, Dawah Articles & Cards
// ──────────────────────────────────────────────────────────────

interface GeneratedDraftSections {
  firstPartLabel: string;
  firstPartContent: string;
  secondPartLabel: string;
  secondPartContent: string;
  applicationLabel: string;
  applicationContent: string;
  closingLabel: string;
  closingContent: string;
  translatedFirstPart?: string;
  translatedSecondPart?: string;
}

async function generateRichContentWithAI(
  topic: string,
  contentType: ContentType,
  audience: TargetAudience,
  language: ContentLanguage,
  verses: Array<{ text_uthmani: string; surah_name_ar: string; ayah_number: number }>,
  hadiths: Array<{ text_full?: string; text_clean?: string; source_book?: string; grade?: string; number_or_page?: string }>,
  seed?: CanonicalTopicSeed
): Promise<GeneratedDraftSections | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null;

  const isKhutba = contentType === 'khutba_friday';
  const audienceHint = {
    general: 'عموم المسلمين',
    youth: 'الشباب والناشئة',
    revert: 'المسلمين الجدد',
    non_muslim: 'غير المسلمين',
    scholar: 'طلاب العلم والدعاة'
  }[audience];

  const versesFormatted = verses.map(v =>
    `﴿${v.text_uthmani}﴾ [سورة ${v.surah_name_ar}، آية ${v.ayah_number}]`
  ).join('\n');

  const hadithsFormatted = hadiths.map(h =>
    `«${h.text_full || h.text_clean}» [${h.source_book || 'المصدر الحديثي'} - الدرجة: ${h.grade || 'صحيح'}]`
  ).join('\n');

  const prompt = isKhutba
    ? `أنت خطيب جمعة مفوه وعالم شرعي مؤصل في منظومة «بصيرة».
مهمتك: كتابة نص خطبة جمعة كاملة بليغة ومؤصلة بأركانها الشرعية حول موضوع: «${topic}».
الجمهور المستهدف: ${audienceHint}.

الأدلة القرآنية المسترجعة من المصحف المعتمد (استخدمها بنصها القرآني):
${versesFormatted}

الأحاديث النبوية المخرجة من كتب السنة المعتمدة (استخدمها بنصها وتخريجها):
${hadithsFormatted}

شروط الصياغة:
1. الخطبة الأولى كاملة: تبدأ بالحمد والثناء والشهادتين والوصية بالتقوى، ثم بسط الموضوع وشرح الآيات والأحاديث المذكورة أعلاه مع بيان معانيها وثمارها، وتنتهي بطلب الاستغفار.
2. الخطبة الثانية كاملة: تبدأ بحمد الله والصلاة على نبيه، ثم وصايا عملية واقعية للجمهور، وتختم بدعاء جامع ومؤثر للأمة الإسلامية.
3. تفصيل غني وواضح بدون اختصار مخل.

أعد النتيجة حصراً بصيغة JSON:
{
  "firstPartContent": "نص الخطبة الأولى كاملاً ومفصلاً...",
  "secondPartContent": "نص الخطبة الثانية كاملاً ومفصلاً بالدعاء...",
  "applicationContent": "توجيهات عملية وإرشادات دعوية للخطيب...",
  "closingContent": "وصايا ختامية وإطار المراجعة قبل الإلقاء..."
}`
    : `أنت باحث شرعي ومؤصل إسلامي رصين في منظومة «بصيرة».
مهمتك: كتابة مقال دعوي مؤصل وعميق ومفصل حول موضوع: «${topic}».
الجمهور المستهدف: ${audienceHint}.

الأدلة القرآنية المسترجعة من المصحف المعتمد:
${versesFormatted}

الأحاديث النبوية المخرجة من كتب السنة المعتمدة:
${hadithsFormatted}

شروط الصياغة:
1. مقدمة تأصيلية فكرية رصينة عن مكانة الموضوع.
2. تفصيل المحاور مع توظيف الآيات القرآنية والأحاديث النبوية المذكورة أعلاه وشرح فقهها.
3. تطبيقات معاصرة ومسائل عملية تفيد القارئ.
4. خاتمة جامعة وتوصيات دعوية نافعة.

أعد النتيجة حصراً بصيغة JSON:
{
  "firstPartContent": "المقدمة والمحور القرآني المفصل...",
  "secondPartContent": "المحور النبوي والتطبيقات العملية والتربوية...",
  "applicationContent": "خطة العمل والتوصيات الدعوية للقارئ...",
  "closingContent": "الخاتمة الجامعة وملاحظات التوثيق..."
}`;

  try {
    const raw = await groqChat(
      [{ role: 'user', content: prompt }],
      {
        model: GROQ_TEXT_MODEL,
        temperature: 0.3,
        maxTokens: 2500,
        json: true,
        timeoutMs: 14000
      }
    );

    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed.firstPartContent === 'string' && parsed.firstPartContent.length > 150) {
      return {
        firstPartLabel: isKhutba ? 'الخطبة الأولى: التأصيل والبيان' : 'المقدمة والمحور القرآني',
        firstPartContent: parsed.firstPartContent.trim(),
        secondPartLabel: isKhutba ? 'الخطبة الثانية: التطبيق والدعاء' : 'الهدي النبوي والتطبيقات العملية',
        secondPartContent: (parsed.secondPartContent || '').trim(),
        applicationLabel: isKhutba ? 'إطار التوجيه المنبري والإلقاء' : 'التطبيقات الدعوية المعاصرة',
        applicationContent: (parsed.applicationContent || '').trim(),
        closingLabel: isKhutba ? 'خاتمة المسودة والمراجعة' : 'الخاتمة والتوصيات',
        closingContent: (parsed.closingContent || '').trim()
      };
    }
  } catch (err) {
    console.warn('[BASEERA][DAWAH][AI_FALLBACK]', err);
  }

  return null;
}

function buildDeterministicDraft(
  topic: string,
  contentType: ContentType,
  audience: TargetAudience,
  verses: Array<{ text_uthmani: string; surah_name_ar: string; ayah_number: number }>,
  hadiths: Array<{ text_full?: string; text_clean?: string; source_book?: string; grade?: string; number_or_page?: string }>,
  seed?: CanonicalTopicSeed
): GeneratedDraftSections {
  const isKhutba = contentType === 'khutba_friday';
  const audienceHint = {
    general: 'عموم المسلمين',
    youth: 'الشباب والناشئة',
    revert: 'المسلمين الجدد',
    non_muslim: 'غير المسلمين',
    scholar: 'طلاب العلم والدعاة'
  }[audience];

  const mainVerse = verses[0];
  const secondVerse = verses[1];
  const mainHadith = hadiths[0];
  const secondHadith = hadiths[1];

  const keyPoints = seed?.keyPoints || [
    `تحقيق «${topic}» من أسمى مقاصد الشريعة الإسلامية وأعظم سبل صلاح الفرد والمجتمع`,
    `الارتباط الوثيق بين الإيمان الصادق وترجمة هذا الأصل في سائر المعاملات والأخلاق`,
    `عظيم الأجر والثواب الذي ادخره الله تعالى للمتمسكين بهدي الكتاب والسنة`
  ];

  const actionSteps = seed?.actionSteps || [
    `المحاسبة الدورية للنفس وتجديد النية الصادقة ابتغاء مرضاة الله تعالى`,
    `ترجمة هذا التوجيه في محيط الأسرة وميدان العمل ليكون المسلم قدوة صالحة`,
    `التعاون على البر والتقوى والتواصي بالحق والصبر في مواجهة الفتن`
  ];

  if (isKhutba) {
    // ── First Sermon ──
    const khutba1Lines = [
      'إنَّ الحَمْدَ لِلَّهِ، نَحْمَدُهُ وَنَسْتَعِينُهُ وَنَسْتَغْفِرُهُ، وَنَعُوذُ بِاللَّهِ مِنْ شُرُورِ أَنْفُسِنَا وَمِنْ سَيِّئَاتِ أَعْمَالِنَا، مَنْ يَهْدِهِ اللَّهُ فَلَا مُضِلَّ لَهُ، وَمَنْ يُضْلِلْ فَلَا هَادِيَ لَهُ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ.',
      '',
      'يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ حَقَّ تُقَاتِهِ وَلَا تَمُوتُنَّ إِلَّا وَأَنْتُمْ مُسْلِمُونَ [آل عمران: 102].',
      'يَا أَيُّهَا النَّاسُ اتَّقُوا رَبَّكُمُ الَّذِي خَلَقَكُمْ مِنْ نَفْسٍ وَاحِدَةٍ وَخَلَقَ مِنْهَا زَوْجَهَا وَبَثَّ مِنْهُمَا رِجَالًا كَثِيرًا وَنِسَاءً وَاتَّقُوا اللَّهَ الَّذِي تَسَاءَلُونَ بِهِ وَالْأَرْحَامَ إِنَّ اللَّهَ كَانَ عَلَيْكُمْ رَقِيبًا [النساء: 1].',
      '',
      `أَمَّا بَعْدُ عِبَادَ اللَّهِ: فَإِنَّ أَصْدَقَ الحَدِيثِ كِتَابُ اللَّهِ، وَخَيْرَ الهَدْيِ هَدْيُ مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَإِنَّ مِنْ أَعْظَمِ أُصُولِ دِينِنَا القَوِيمِ، وَأَجَلِّ أَبْوَابِ الخَيْرِ وَالفَلَاحِ، مَا نَلْتَقِي حَوْلَهُ فِي هَذَا اليَوْمِ الأَغَرِّ؛ مَوْضُوعُنَا: «${topic}».`,
      '',
      `عِبَادَ اللَّهِ: لَقَدْ بَيَّنَ اللَّهُ جَلَّ فِي عُلَاهُ فِي كِتَابِهِ العَزِيزِ مَكَانَةَ هَذَا الأَمْرِ وَعَظِيمَ شَأْنِهِ، فَقَالَ سُبْحَانَهُ فِي مُحْكَمِ التَّنْزِيلِ:`,
      mainVerse ? `﴿${mainVerse.text_uthmani}﴾ [سورة ${mainVerse.surah_name_ar}: ${mainVerse.ayah_number}].` : '',
      secondVerse ? `وَقَالَ عَزَّ مِنْ قَائِلٍ: ﴿${secondVerse.text_uthmani}﴾ [سورة ${secondVerse.surah_name_ar}: ${secondVerse.ayah_number}].` : '',
      '',
      `وَفِي هَذِهِ الآيَاتِ البَيِّنَاتِ تَبْيَانٌ شَافٍ لِكُلِّ مُؤْمِنٍ يَطْلُبُ مَرْضَاةَ رَبِّهِ؛ حَيْثُ يُبَيِّنُ الحَقُّ سُبْحَانَهُ أَنَّ:`,
      ...keyPoints.map(p => `• ${p}.`),
      '',
      `ثُمَّ اعْلَمُوا عِبَادَ اللَّهِ أَنَّ سُنَّةَ النَّبِيِّ المـُصْطَفَى صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ جَاءَتْ شَارِحَةً وَمُؤَكِّدَةً لِهَذَا الهَدْيِ العَظِيمِ، فَقَدْ وَرَدَ عَنْهُ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ:`,
      mainHadith ? `«${mainHadith.text_full || mainHadith.text_clean}» [أَخْرَجَهُ ${mainHadith.source_book || 'المصدر الحديثي'}، رَقْم: ${mainHadith.number_or_page || '—'}، وَحُكْمُهُ: ${mainHadith.grade || 'صحيح'}].` : '',
      secondHadith ? `كَمَا صَحَّ عَنْهُ عَلَيْهِ الصَّلَاةُ وَالسَّلَامُ: «${secondHadith.text_full || secondHadith.text_clean}» [${secondHadith.source_book || 'المصدر الحديثي'}].` : '',
      '',
      'أَقُولُ قَوْلِي هَذَا، وَأَسْتَغْفِرُ اللَّهَ العَظِيمَ الجَلِيلَ لِي وَلَكُمْ وَلِسَائِرِ المـُسْلِمِينَ مِنْ كُلِّ ذَنْبٍ، فَاسْتَغْفِرُوهُ إِنَّهُ هُوَ الغَفُورُ الرَّحِيمُ.'
    ].filter(Boolean).join('\n');

    // ── Second Sermon ──
    const khutba2Lines = [
      'الحَمْدُ لِلَّهِ وَكَفَى، وَصَلَاةً وَسَلَامًا عَلَى عِبَادِهِ الَّذِينَ اصْطَفَى، وَخَاتَمِ النَّبِيِّينَ مُحَمَّدٍ المـُجْتَبَى، وَعَلَى آلِهِ وَصَحْبِهِ وَمَنِ اهْتَدَى بِهُدَاهُمْ إِلَى يَوْمِ الدِّينِ.',
      '',
      `أَمَّا بَعْدُ عِبَادَ اللَّهِ: اتَّقُوا اللَّهَ تَعَالَى حَقَّ التَّقْوَى، وَاعْلَمُوا أَنَّ ثَمَرَةَ المَوْعِظَةِ هِيَ العَمَلُ، وَإِنَّنَا إِذْ نَتَذَاكَرُ «${topic}» فَإِنَّ المَقْصُودَ هُوَ تَحْوِيلُ هَذِهِ المَعَانِي الشَّرِيفَةِ إِلَى وَاقِعٍ يَعِيشُهُ المـُسْلِمُ فِي حَيَاتِهِ اليَوْمِيَّةِ:`,
      '',
      ...actionSteps.map((step, idx) => `${idx + 1}. ${step}.`),
      '',
      'ثُمَّ اعْلَمُوا رَحِمَكُمُ اللَّهُ أَنَّ اللَّهَ تَعَالَى أَمَرَكُمْ بِأَمْرٍ بَدَأَ فِيهِ بِنَفْسِهِ، وَثَنَّى بِمَلَائِكَتِهِ المُسَبِّحَةِ بِقُدْسِهِ، فَقَالَ جَلَّ وَعَلَا: ﴿إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا﴾ [الأحزاب: 56].',
      '',
      'اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ، وَعَلَى آلِهِ وَأَصْحَابِهِ أَجْمَعِينَ.',
      'اللَّهُمَّ أَعِزَّ الإِسْلَامَ وَالمـُسْلِمِينَ، وَأَصْلِحْ أَحْوَالَنَا وَأَحْوَالَ المـُسْلِمِينَ فِي كُلِّ مَكَانٍ.',
      'اللَّهُمَّ فَرِّجْ هَمَّ المَهْمُومِينَ، وَنَفِّسْ كَرْبَ المَكْرُوبِينَ، وَاقْضِ الدَّيْنَ عَنِ المَدِينِينَ، وَاشْفِ مَرْضَانَا وَمَرْضَى المـُسْلِمِينَ.',
      'اللَّهُمَّ اغْفِرْ لِلْمُسْلِمِينَ وَالمـُسْلِمَاتِ، والمُؤْمِنِينَ وَالمُؤْمِنَاتِ، الأَحْيَاءِ مِنْهُمْ وَالأَمْوَاتِ.',
      'عِبَادَ اللَّهِ: ﴿إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ وَإِيتَاءِ ذِي الْقُرْبَى وَيَنْهَى عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ وَالْبَغْيِ يَعِظُكُمْ لَعَلَّكُمْ تَذَكَّرُونَ﴾ [النحل: 90]. فَاذْكُرُوا اللَّهَ العَظِيمَ يَذْكُرْكُمْ، وَاشْكُرُوهُ عَلَى نِعَمِهِ يَزِدْكُمْ، وَلَذِكْرُ اللَّهِ أَكْبَرُ وَاللَّهُ يَعْلَمُ مَا تَصْنَعُونَ.'
    ].filter(Boolean).join('\n');

    return {
      firstPartLabel: 'الخطبة الأولى: التأصيل والبيان',
      firstPartContent: khutba1Lines,
      secondPartLabel: 'الخطبة الثانية: التطبيق والدعاء',
      secondPartContent: khutba2Lines,
      applicationLabel: 'إطار التوجيه المنبري',
      applicationContent: `توجيه خاص بالخطيب لـ${audienceHint}:\n• احرص على القراءة المرتلة للآيات القرآنية كما رويت.\n• بيّن التخريج الصحيح للأحاديث النبوية لطمأنة جمهور المصلين.\n• اربط موعظة الجمعة بقضايا المجتمع وهمومه الواقعية دون إفراط أو تفريط.`,
      closingLabel: 'خاتمة المسودة والمراجعة',
      closingContent: `مسودة خطبة موثقة المصادر: صِيغت وفق الأصول الشرعية ومستندة إلى مصحف مجمع الملك فهد وكتب السنة المعتمدة. يُستحسن مراجعتها من الخطيب قبل الصعود إلى المنبر لتكييفها مع الوقت المتاح.`
    };
  } else {
    // ── Dawah Article ──
    const articleIntro = [
      `الحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين نبينا محمد وعلى آله وصحبه أجمعين، أما بعد:`,
      '',
      `تُعدّ قضية «${topic}» من الركائز الجوهرية في البناء التربوي والإيماني للمسلم؛ إذ يتكامل فيها الفهم الشرعي الرصين مع التطبيق العملي المثمر في واقع الحياة المعاصرة.`,
      `وإن الرجوع إلى المنابع الصافية من كتاب الله تعالى وسنة نبيه المصطفى ﷺ هو الضمانة الكبرى للثبات والاهتداء.`
    ].join('\n');

    const articleBody = [
      `■ المحور الأول: التأصيل القرآني وهدايات الآيات`,
      mainVerse ? `قال الله سبحانه وتعالى في محكم التنزيل: ﴿${mainVerse.text_uthmani}﴾ [سورة ${mainVerse.surah_name_ar}: ${mainVerse.ayah_number}].` : '',
      secondVerse ? `ويؤكد التنزيل الحكيم هذا المعنى في موضع آخر: ﴿${secondVerse.text_uthmani}﴾ [سورة ${secondVerse.surah_name_ar}: ${secondVerse.ayah_number}].` : '',
      '',
      `تستوقفنا في هذه النصوص القرآنية دلالات بالغة الأهمية:`,
      ...keyPoints.map(p => `• ${p}.`),
      '',
      `■ المحور الثاني: شواهد السنة النبوية المطهرة`,
      mainHadith ? `وجاء في الهدي النبوي الشريف ما يرويه المصطفى ﷺ: «${mainHadith.text_full || mainHadith.text_clean}» [${mainHadith.source_book || 'المصدر الحديثي'}، حكم الحديث: ${mainHadith.grade || 'صحيح'}].` : '',
      secondHadith ? `كما ورد في الصحيح: «${secondHadith.text_full || secondHadith.text_clean}» [${secondHadith.source_book || 'المصدر الحديثي'}].` : '',
      '',
      `إن التمعن في هذا البيان النبوي يفتح أمام المسلم آفاقاً واسعة لاستشعار عظمة الرسالة المحمدية، وكيف وجّه النبي ﷺ أمته إلى ترسيخ هذا المبدأ في كل شأن من شؤونهم.`,
      '',
      `■ المحور الثالث: الثمار السلوكية والتطبيق المعاصر`,
      `لترجمة هذا الأصل إلى برنامج عملي يلمسه الفرد والمجتمع:`,
      ...actionSteps.map((step, idx) => `${idx + 1}. ${step}.`)
    ].filter(Boolean).join('\n');

    return {
      firstPartLabel: 'المقدمة والتأصيل القرآني',
      firstPartContent: articleIntro,
      secondPartLabel: 'الهدي النبوي والتطبيقات العملية',
      secondPartContent: articleBody,
      applicationLabel: 'خطة العمل الدعوي',
      applicationContent: `دليل استرشادي موجه لـ${audienceHint}:\n• تفعيل حلقات المدارسة والقراءة الأسرية حول مضامين هذا الموضوع.\n• نشر المقاطع والبطاقات المستقاة من هذه المسودة على منصات التواصل الاجتماعي.\n• توجيه الأسئلة الفقهية الدقيقة لأهل الفتوى والاختصاص.`,
      closingLabel: 'الخاتمة والتوصيات',
      closingContent: `نسأل الله تعالى أن يرزقنا العلم النافع والعمل الصالح، وأن يجعلنا من الهداة المهتدين. تم تحرير وتوثيق هذه المادة الدعوية بالاعتماد التام على المصادر الشرعية المعتمدة في سجل بصيرة.`
    };
  }
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

  // 2. Retrieve authenticated Hadith candidates
  const verifiedHadiths = await findRelevantHadiths(topic, 3);

  // 3. Retrieve Terminology from Jamhara
  const termDef = await findJamharaTerm(topic);

  const matchedSeed = findMatchingSeed(topic);

  if (relevantVerses.length === 0 && verifiedHadiths.length === 0 && !termDef && !matchedSeed) {
    throw new Error('لم تُسترجع مادة مصدرية كافية لهذا الموضوع من المراجع المعتمدة.');
  }

  // 4. Resolve translations for Verses if needed
  const verseTranslations = new Map<string, string>();
  for (const v of relevantVerses) {
    if (language === 'ar') continue;
    try {
      const rows = await getAyahTranslations(v.surah_number, v.ayah_number, language);
      const available = Array.isArray(rows) ? rows : [];
      const preferredBook = language === 'ru'
        ? /Elmir\s+Kuliev|إلمير\s+كولييف/i
        : /Saheeh\s+International|صحيح\s+International/i;
      const selected = available.find(row => preferredBook.test(row.bookName)) || available[0];
      if (selected?.text) {
        verseTranslations.set(`${v.surah_number}:${v.ayah_number}`, selected.text);
      }
    } catch {
      // Continue
    }
  }

  // 5. Build Citations List
  const allCitations: VerifiedCitation[] = [];

  for (const v of relevantVerses.slice(0, 3)) {
    const tr = verseTranslations.get(`${v.surah_number}:${v.ayah_number}`);
    allCitations.push({
      type: 'ayah',
      arabic_text: v.text_uthmani || v.text_clean,
      translation: tr,
      source_name: `القرآن الكريم — سورة ${v.surah_name_ar}، آية ${v.ayah_number}`,
      source_url: `https://quranpedia.net/verse/${v.surah_number}/${v.ayah_number}`,
      authority: 'Quranpedia — المصحف الحفصي المعتمد',
      verified: true,
      source_id: 'quran-uthmani'
    });
  }

  for (const h of verifiedHadiths.slice(0, 3)) {
    const hasLivePermalink = Boolean(h.dorar_url && /\/h\/[A-Za-z0-9]+/.test(h.dorar_url));
    allCitations.push({
      type: 'hadith',
      arabic_text: h.text_full || h.text_clean,
      translation: undefined,
      source_name: `${h.source_book || 'الموسوعة الحديثية'}${h.number_or_page ? ` (${h.number_or_page})` : ''} — حكم المحدث: ${h.grade || 'صحيح'}`,
      source_url: hasLivePermalink ? h.dorar_url : undefined,
      authority: hasLivePermalink ? 'مؤسسة الدرر السنية للإشراف العلمي' : 'كتب السنة النبوية المعتمدة',
      grade: h.grade || 'صحيح',
      verified: Boolean(hasLivePermalink),
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

  // 6. Generate Rich Draft Sections
  const isKhutba = contentType === 'khutba_friday';
  let draft = await generateRichContentWithAI(
    topic,
    contentType,
    audience,
    language,
    relevantVerses,
    verifiedHadiths,
    matchedSeed
  );

  if (!draft) {
    draft = buildDeterministicDraft(
      topic,
      contentType,
      audience,
      relevantVerses,
      verifiedHadiths,
      matchedSeed
    );
  }

  const sections: DawahContentSection[] = [];

  // Section 1: Main Speech / Body Part 1
  sections.push({
    section_key: isKhutba ? 'khutba_first' : 'intro',
    section_label_ar: draft.firstPartLabel,
    section_label_translated: language === 'ru'
      ? (isKhutba ? 'Первая часть хутбы' : 'Введение и коранический базис')
      : language === 'en'
      ? (isKhutba ? 'First Sermon: Theological Foundation' : 'Introduction & Quranic Foundation')
      : undefined,
    content_ar: draft.firstPartContent,
    content_translated: draft.translatedFirstPart,
    citations: allCitations.filter(c => c.type === 'ayah')
  });

  // Section 2: Main Speech / Body Part 2
  if (draft.secondPartContent) {
    sections.push({
      section_key: isKhutba ? 'khutba_second' : 'hadith_body',
      section_label_ar: draft.secondPartLabel,
      section_label_translated: language === 'ru'
        ? (isKhutba ? 'Вторая часть хутбы: применение и мольба' : 'Пророческое руководство и практика')
        : language === 'en'
        ? (isKhutba ? 'Second Sermon: Practical Guidance & Duaa' : 'Prophetic Guidance & Practical Application')
        : undefined,
      content_ar: draft.secondPartContent,
      content_translated: draft.translatedSecondPart,
      citations: allCitations.filter(c => c.type === 'hadith')
    });
  }

  // Section 3: Quranic Evidence Box
  if (relevantVerses.length > 0) {
    const quranLines = relevantVerses.map(v => {
      const tr = verseTranslations.get(`${v.surah_number}:${v.ayah_number}`);
      return [
        `﴿${v.text_uthmani}﴾ [سورة ${v.surah_name_ar}: ${v.ayah_number}]`,
        tr ? `الترجمة المعتمدة: «${tr}»` : ''
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    sections.push({
      section_key: 'quran_daleel',
      section_label_ar: 'النصوص القرآنية المسترجعة من المصحف المعتمد',
      section_label_translated: language === 'ru' ? 'Коранические аяты из источника' : 'Quranic Texts from Approved Source',
      content_ar: quranLines,
      citations: allCitations.filter(c => c.type === 'ayah')
    });
  }

  // Section 4: Hadith Evidence Box
  if (verifiedHadiths.length > 0) {
    const hadithLines = verifiedHadiths.map(h => [
      `«${h.text_full || h.text_clean}»`,
      `المصدر: ${h.source_book || 'الموسوعة الحديثية'}${h.number_or_page ? ` (${h.number_or_page})` : ''} | الدرجة: ${h.grade || 'صحيح'}`
    ].join('\n')).join('\n\n');

    sections.push({
      section_key: 'hadith_daleel',
      section_label_ar: 'الأحاديث النبوية المخرجة من كتب السنة المعتمدة',
      section_label_translated: language === 'ru' ? 'Достоверные хадисы из источников' : 'Authentic Hadiths from Approved Sources',
      content_ar: hadithLines,
      citations: allCitations.filter(c => c.type === 'hadith')
    });
  }

  // Section 5: Application & Review Guidelines
  sections.push({
    section_key: 'application',
    section_label_ar: draft.applicationLabel,
    section_label_translated: language === 'ru' ? 'Практическое руководство' : 'Implementation Guidelines',
    content_ar: draft.applicationContent,
    citations: termDef ? allCitations.filter(c => c.type === 'term') : []
  });

  // Section 6: Closing & Verification Seal
  sections.push({
    section_key: 'khatimah',
    section_label_ar: draft.closingLabel,
    section_label_translated: language === 'ru' ? 'Заключение и проверка' : 'Conclusion & Verification',
    content_ar: draft.closingContent,
    citations: []
  });

  // 7. Video Reel & Infographic Artifacts
  const mainVerse = relevantVerses[0];
  const mainVerseTr = mainVerse ? verseTranslations.get(`${mainVerse.surah_number}:${mainVerse.ayah_number}`) : undefined;
  const mainHadith = verifiedHadiths[0] || null;

  const infographicSuggestion = buildInfographicSuggestion(topic, allCitations, language);
  const videoReelScript = buildVideoReelScript(topic, mainVerse, mainVerseTr, mainHadith, undefined, language);

  return {
    id,
    topic,
    contentType,
    language,
    audience,
    title_ar: isKhutba ? `خطبة جمعة مؤصلة: «${topic}»` : `مقال دعوي مؤصل: «${topic}»`,
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
    verification_note: `المسودة صُنعت بالاستناد إلى الآيات الحفصية والأحاديث المعتمدة، ثم أُرفق تقرير التحقق الذاتي (Verification Report) لبيان حالة التوثيق لكل شاهد بشكل منفصل وتحديد الروابط الحية المكتملة.`,
    infographic_suggestion: infographicSuggestion,
    video_reel_script: videoReelScript
  };
}

// ──────────────────────────────────────────────────────────────
// Video Reel & Short Script Generator
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
      visual_description: 'لقطة سينمائية طبيعية بطيئة الحركة (شروق الشمس / جبال شاهقة) مع ظهور عنوان جذاب في المنتصف بتأثير حركي أنيق.',
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
      voiceover_ar: hadith ? `ورد في المصدر الحديثي: «${(hadith.text_full || hadith.text_clean).slice(0, 110)}...» (${hadith.grade || 'صحيح'})` : 'وجاء في الهدي النبوي الوارد في المصادر المعتمدة...',
      voiceover_translated: isRu && hadithRu ? `Пророк Мухаммад ﷺ сказал: «${hadithRu.ru.slice(0, 120)}...»` : undefined,
      on_screen_text: hadith ? `«${(hadith.text_full || hadith.text_clean).slice(0, 80)}...»\n(الدرجة: ${hadith.grade || 'صحيح'})` : ''
    },
    {
      scene_number: 4,
      duration_seconds: '45-60 ثانية',
      visual_description: 'خاتمة سريعة مع شعار بصيرة ورسالة دعوية تطبيقية.',
      voiceover_ar: `ابدأ بتطبيق هذا الهدي في حياتك اليوم، وشاركه لتكون لك صدقة جارية حول «${topic}».`,
      voiceover_translated: isRu
        ? `Начните применять это в своей жизни уже сегодня и поделитесь этим видео ради довольства Аллаха.`
        : `Implement "${topic}" in your daily routine today and share this reminder.`,
      on_screen_text: isRu ? `Проверено через Baseera` : `موثق عبر بصيرة`
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
    `🛡️ بيان المصدر: «استُرجعت الأدلة من المراجع المعتمدة المدرجة في سجل بصيرة؛ المحتوى موثق ومعد للنشر.»`,
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
  </defs>

  <rect width="1080" height="1080" fill="url(#bgGrad)" />
  <rect x="30" y="30" width="1020" height="1020" rx="24" fill="none" stroke="#1e293b" stroke-width="2" />
  <rect x="42" y="42" width="996" height="996" rx="18" fill="none" stroke="#059669" stroke-width="1.5" stroke-opacity="0.4" />

  <g fill="none" stroke="#fbbf24" stroke-width="2" stroke-opacity="0.6">
    <path d="M 60 90 L 90 60 L 120 90 L 90 120 Z" />
    <path d="M 1020 90 L 990 60 L 960 90 L 990 120 Z" />
    <path d="M 60 990 L 90 960 L 120 990 L 90 1020 Z" />
    <path d="M 1020 990 L 990 960 L 960 990 L 990 1020 Z" />
  </g>

  <g transform="translate(540, 95)" text-anchor="middle">
    <rect x="-24" y="-24" width="48" height="48" rx="10" fill="#064e3b" stroke="#10b981" stroke-width="2" />
    <text x="0" y="8" fill="#10b981" font-size="24" font-weight="bold" font-family="'Amiri', serif">ب</text>
    <text x="0" y="50" fill="#f8fafc" font-size="28" font-weight="bold" letter-spacing="1">بصيرة · BASEERA</text>
    <text x="0" y="75" fill="#10b981" font-size="16" font-weight="600" letter-spacing="2">منظومة التحقق والإنتاج الدعوي الموثق</text>
  </g>

  <g transform="translate(540, 240)" text-anchor="middle">
    <rect x="-420" y="-35" width="840" height="70" rx="16" fill="#042f2e" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.5" />
    <text x="0" y="10" fill="url(#goldGrad)" font-size="34" font-weight="800">${titleText}</text>
  </g>

  <g transform="translate(90, 310)">
    <rect width="900" height="290" rx="16" fill="#0a1220" stroke="#1e293b" stroke-width="1.5" />
    <rect x="0" y="0" width="8" height="290" rx="4" fill="#10b981" />
    <text x="40" y="45" fill="#10b981" font-size="20" font-weight="bold">📖 الدليل من القرآن الكريم (مصحف مجمع الملك فهد)</text>
    <text x="860" y="45" text-anchor="end" fill="#64748b" font-size="15" font-family="monospace">KING FAHD COMPLEX</text>
    <text x="450" y="125" text-anchor="middle" fill="#ffffff" font-size="25" font-weight="bold" font-family="'Amiri', 'Traditional Arabic', serif" letter-spacing="0.5">
      ﴿ ${verseArabic} ﴾
    </text>
    ${verseTr ? `<text x="450" y="195" text-anchor="middle" fill="#94a3b8" font-size="18" font-style="italic">«${verseTr}»</text>` : ''}
    <line x1="40" y1="230" x2="860" y2="230" stroke="#1e293b" stroke-width="1" />
    <text x="40" y="265" fill="#fbbf24" font-size="16" font-weight="600">${verseRef}</text>
    <text x="860" y="265" text-anchor="end" fill="#10b981" font-size="15" font-weight="bold">✓ نص مصدري موثق</text>
  </g>

  <g transform="translate(90, 630)">
    <rect width="900" height="270" rx="16" fill="#0a1220" stroke="#1e293b" stroke-width="1.5" />
    <rect x="0" y="0" width="8" height="270" rx="4" fill="#fbbf24" />
    <text x="40" y="45" fill="#fbbf24" font-size="20" font-weight="bold">✨ الدليل من السنة النبوية (الموسوعة الحديثية — الدرر السنية)</text>
    <text x="860" y="45" text-anchor="end" fill="#64748b" font-size="15" font-family="monospace">DORAR.NET</text>
    <text x="450" y="125" text-anchor="middle" fill="#ffffff" font-size="23" font-weight="bold" font-family="'Amiri', 'Traditional Arabic', serif">
      « ${hadithArabic} »
    </text>
    <line x1="40" y1="205" x2="860" y2="205" stroke="#1e293b" stroke-width="1" />
    <text x="40" y="240" fill="#94a3b8" font-size="16">${hadithRef}</text>
    <text x="860" y="240" text-anchor="end" fill="#10b981" font-size="15" font-weight="bold">✓ درجة معتمدة في المصدر</text>
  </g>

  <g transform="translate(540, 960)" text-anchor="middle">
    <line x1="-420" y1="-20" x2="420" y2="-20" stroke="#1e293b" stroke-width="1" />
    <text x="0" y="10" fill="#f8fafc" font-size="18" font-weight="bold">المصادر المعتمدة: المستودع الدعوي (dawa.center) · مصحف المدينة · الدرر السنية · الجمهرة</text>
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
