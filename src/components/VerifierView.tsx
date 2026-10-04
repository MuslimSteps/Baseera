/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Globe,
  Image,
  Mic,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
  RefreshCw,
  Upload,
  BookOpen,
  Sparkles,
  Settings2
} from 'lucide-react';
import { AnalysisReport } from '../types/baseera.ts';
import { VerificationCard } from './VerificationCard.tsx';
import { extractItemsRuleBased } from '../lib/extractor.ts';
import { verifyExtractedItems } from '../lib/decisionEngine.ts';

// Pre-defined realistic test cases for one-click verification demo
const SAMPLE_PRESETS = [
  {
    category: 'القرآن الكريم',
    label: 'آية صحيحة (آية الكرسي)',
    type: 'text' as const,
    text: 'قال تعالى: «اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ» [سورة البقرة: 255]'
  },
  {
    category: 'القرآن الكريم',
    label: 'آية بلفظ مبدل (كشف تحريف)',
    type: 'text' as const,
    text: 'في القرآن الكريم: «الله لا إله إلا هو الحي الغفور لا تأخذه سنة ولا نوم» [سورة البقرة]'
  },
  {
    category: 'القرآن الكريم',
    label: 'رقم آية خاطئ (تصحيح العزو)',
    type: 'text' as const,
    text: '«اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ» [سورة البقرة آية 155]'
  },
  {
    category: 'خلط العزو',
    label: 'حديث منسوب خطأ كآية (بحث شامل)',
    type: 'text' as const,
    text: 'في القرآن الكريم: «إنما الأعمال بالنيات وإنما لكل امرئ ما نوى»'
  },
  {
    category: 'خلط العزو',
    label: 'آية منسوبة خطأ كحديث (بحث شامل)',
    type: 'text' as const,
    text: 'قال رسول الله ﷺ في الحديث: «لا إكراه في الدين قد تبين الرشد من الغي»'
  },
  {
    category: 'السنة النبوية',
    label: 'حديث صحيح (البخاري)',
    type: 'text' as const,
    text: 'قال رسول الله ﷺ: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى» رواه البخاري'
  },
  {
    category: 'السنة النبوية',
    label: 'حديث صحيح بعزو خاطئ',
    type: 'text' as const,
    text: 'قال النبي ﷺ في صحيح البخاري: «الراحمون يرحمهم الرحمن ارحموا من في الأرض يرحمكم من في السماء»'
  },
  {
    category: 'السنة النبوية',
    label: 'حديث ضعيف مشتهر',
    type: 'text' as const,
    text: 'قال رسول الله: «اطلبوا العلم ولو بالصين»'
  },
  {
    category: 'السنة النبوية',
    label: 'حديث موضوع مكذوب',
    type: 'text' as const,
    text: 'ورد في الحديث: «حب الوطن من الإيمان»'
  },
  {
    category: 'روايات مكذوبة مركبة',
    label: 'أثر موضوع مشتهر (قصة حذيفة وعمر + استشهاد بآيات)',
    type: 'text' as const,
    text: '3 - ((دخل حذيفة بن اليمان على عمر بن الخطاب فسأله: كيف أصبحت يا حذيفة؟ فأجاب حذيفة: أصبحت أحب الفتنة وأكره الحق وأصلي بغير وضوء ولي في الأرض ما ليس لله في السماء، فغضب عمر غضباً شديداً وربد وجهه، واتفق أن دخل علي بن أبي طالب فرآه على تلك الحالة فسأله عن السبب فذكر له ما قاله ابن اليمان، فقال علي: لقد صدقك فيما قال يا عمر، فقال عمر: وكيف ذلك؟! قال علي: إنه يحب الفتنة لقوله تعالى: إنما أموالكم وأولادكم فتنة [التغابن: 15]، فهو يحب أمواله وأولاده، ويكره الحق يعني الموت لقوله تعالى: واعبد ربك حتى يأتيك اليقين [الحجر: 99]، ويصلي بغير وضوء يعني أنه يصلي على محمد صلى الله عليه وسلم، ومعنى أن له في الأرض ما ليس لله في السماء يعني أن له زوجة وأولاداً، والله تعالى هو الواحد الأحد الفرد الصمد الذي لم يلد ولم يولد، فقال عمر: أحسنت يا أبا الحسن، لقد أذهبت ما في قلبي على حذيفة)).'
  },
  {
    category: 'مصطلحات الجمهرة',
    label: 'مصطلح مختزل (اختزال الشريعة)',
    type: 'text' as const,
    text: 'Sharia exclusively means penal laws, corporal punishments, and amputation of hands.'
  },
  {
    category: 'مصطلحات الجمهرة',
    label: 'مصطلح التوحيد المعتمد',
    type: 'text' as const,
    text: 'Tawhid in Islam is the comprehensive oneness of Allah in Lordship, exclusive Worship, and Divine Attributes.'
  },
  {
    category: 'الفقه والأحكام',
    label: 'مسألة خلافية (المذاهب الأربعة)',
    type: 'text' as const,
    text: 'ما حكم نقض الوضوء بلمس المرأة الأجنبية بغير شهوة عند أئمة الفقه؟'
  },
  {
    category: 'الفقه والأحكام',
    label: 'فتوى شخصية (نزاع طلاق - إحالة)',
    type: 'text' as const,
    text: 'حلفت على زوجتي بالطلاق إن زارت أختها وذهبت غصباً، فهل وقع طلاقي وأنا غضبان؟'
  },
  {
    category: 'الامتناع الشرعي',
    label: 'نص مختلق (امتناع قطعي)',
    type: 'text' as const,
    text: 'قال النبي ﷺ: «من استعمل الحاسوب في الخير كتب الله له بكل ضغطة زر حسنة»'
  }
];

export const VerifierView: React.FC = () => {
  const [inputType, setInputType] = useState<'text' | 'url' | 'image' | 'audio'>('text');
  const [inputText, setInputText] = useState(SAMPLE_PRESETS[0].text);
  const [urlInput, setUrlInput] = useState('https://dorar.net/article/389');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrEngineUsed, setOcrEngineUsed] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('baseera_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');

  // Tab change handler — clears stale text when switching to URL or Image to prevent false matches
  const handleTabChange = (type: 'text' | 'url' | 'image' | 'audio') => {
    setInputType(type);
    setErrorMsg(null);
    setReport(null);
    if (type === 'url') {
      setInputText('');
    } else if (type === 'image') {
      setInputText('');
      setMediaPreview(null);
      setOcrEngineUsed(null);
    } else if (type === 'text' && !inputText) {
      setInputText(SAMPLE_PRESETS[0].text);
    }
  };

  // Dedicated URL Fetcher
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      setErrorMsg('يرجى إدخال رابط صالح أولاً.');
      return;
    }
    setIsFetchingUrl(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setInputText(data.text);
      } else {
        setErrorMsg(data.error || 'تعذر جلب محتوى الرابط.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'فشل الاتصال بالرابط.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Dedicated Image OCR Processor
  const processImageOcr = async (base64Data: string) => {
    setIsProcessingOcr(true);
    setErrorMsg(null);
    setOcrEngineUsed(null);
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64: base64Data,
          apiKey: geminiApiKey.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setInputText(data.text);
        setOcrEngineUsed(data.method);
      } else {
        setErrorMsg(data.error || 'لم يتم التعرف على أي نص داخل الصورة.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'فشلت معالجة الصورة.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setMediaPreview(b64);
      if (inputType === 'image') {
        processImageOcr(b64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!inputText.trim()) {
      if (inputType === 'url') {
        setErrorMsg('يرجى الضغط على «جلب محتوى الرابط» أولاً للتأكد من استخراج المقال.');
      } else if (inputType === 'image') {
        setErrorMsg('يرجى رفع صورة تحتوي على نص واضح أو كتابة النص يدوياً.');
      } else {
        setErrorMsg('يرجى إدخال النص المراد فحصه.');
      }
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        inputType,
        text: inputText,
        url: inputType === 'url' ? urlInput : undefined,
        mediaBase64: (inputType === 'image' || inputType === 'audio') ? mediaPreview : undefined,
        apiKey: geminiApiKey.trim() || undefined
      };

      let fetchedReport: AnalysisReport | null = null;

      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.report) {
            fetchedReport = data.report;
          }
        }
      } catch (networkErr) {
        console.warn('Backend unavailable, running in-browser engine:', networkErr);
      }

      // If backend is not available (e.g. static hosting on GitHub Pages):
      if (!fetchedReport) {
        const items = extractItemsRuleBased(inputText);
        fetchedReport = verifyExtractedItems(items, inputText, inputType);
      }

      if (fetchedReport) {
        setReport(fetchedReport);
      } else {
        throw new Error('لم يتم استلام تقرير تحقق صالح.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء فحص المحتوى.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Bento Hero Row */}
      <section className="bento reveal">
        <div className="bento-card bento-card--gold bento-accent-top col-span-12 p-6 sm:p-8 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="eyebrow">المسار الرابع</span>
            <span aria-hidden="true" className="eyebrow-sep">·</span>
            <span className="text-muted">تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي</span>
          </div>
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            محطة <span className="gradient-text">التحقق</span> من النصوص الشرعية والسياق المعتمد
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            «النموذج اللغوي يستخرج ويقترح، والمصدر المعتمد في الحزمة العلمية هو الذي يحكم ويثبت».
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="badge badge-gold">تحقق متقاطع</span>
            <span className="badge badge-matched">FCR = 0.0%</span>
            <span className="badge badge-ai">AI Extraction</span>
            <button onClick={() => setShowSettings(!showSettings)} className="chip ml-auto">
              <Settings2 className="h-3.5 w-3.5" />
              <span>مفتاح Gemini API (اختياري)</span>
            </button>
          </div>
        </div>

        <div className="bento-card col-span-12 flex flex-col justify-between gap-4 p-6 lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span>القاعدة الذهبية</span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            الحكم لا يُصدره النموذج، بل يُسترجع من المصادر المعتمدة حصراً: المصحف العثماني، الدرر السنية، وموسوعة الجمهرة.
          </p>
          <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-center">
            <div>
              <div className="font-mono-numbers text-lg font-bold text-gold">3</div>
              <div className="text-[10px] text-faint">طبقات تحقق</div>
            </div>
            <div>
              <div className="font-mono-numbers text-lg font-bold text-brand-soft">6</div>
              <div className="text-[10px] text-faint">مصادر معتمدة</div>
            </div>
            <div>
              <div className="font-mono-numbers text-lg font-bold text-ai-soft">150</div>
              <div className="text-[10px] text-faint">حالة قياس</div>
            </div>
          </div>
        </div>
      </section>

      {/* Collapsible API Key Config */}
      {showSettings && (
        <div className="bento-card reveal space-y-2 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink">إعداد مفتاح Google Gemini API:</span>
            <span className="text-[11px] text-muted">يُحفظ محلياً في متصفحك</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => {
                setGeminiApiKey(e.target.value);
                localStorage.setItem('baseera_gemini_key', e.target.value);
              }}
              placeholder="AIzaSy..."
              className="input-field flex-1 font-mono"
            />
            <button onClick={() => setShowSettings(false)} className="btn btn-primary shrink-0">
              حفظ
            </button>
          </div>
          <p className="text-[11px] text-muted">
            ملاحظة: المنظومة تعمل بالكامل بدون مفتاح خارجي (تستخدم Tesseract.js للـ OCR وقواعد البيانات المعتمدة محلياً ومباشرة من الدرر السنية).
          </p>
        </div>
      )}

      {/* Workstation Bento */}
      <section className="bento">
        {/* Input tile */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bento-card h-full space-y-4 p-5 sm:p-6 reveal">
            {/* Input Type Segmented Control */}
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <span className="text-xs font-semibold text-ink/85">قناة الإدخال:</span>
              <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-lg border border-hairline text-xs">
                {[
                  { id: 'text', label: 'نص', icon: FileText },
                  { id: 'url', label: 'رابط', icon: Globe },
                  { id: 'image', label: 'صورة', icon: Image },
                  { id: 'audio', label: 'صوت', icon: Mic },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = inputType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as any)}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 font-medium ${
                        active
                          ? 'bg-gold-strong text-white shadow-sm font-semibold'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* URL Input with Dedicated Fetch Button */}
            {inputType === 'url' && (
              <div className="space-y-2 p-3 bg-black/30 rounded-xl border border-hairline">
                <label className="text-xs text-ink/85 font-medium block">رابط الصفحة أو المقال:</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://dorar.net/article/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-hairline-strong text-xs text-ink placeholder:text-faint focus:outline-none focus:border-gold font-mono"
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={isFetchingUrl}
                    className="px-3 py-2 bg-gold-strong hover:bg-gold-strong text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isFetchingUrl ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جلب...</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5" />
                        <span>جلب محتوى الرابط</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  اضغط «جلب محتوى الرابط» لاستخراج المقال الحقيقي وعرضه في الصندوق أدناه قبل الفحص.
                </p>
              </div>
            )}

            {/* Image / Audio Upload Section with Auto-OCR Feedback */}
            {(inputType === 'image' || inputType === 'audio') && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-dashed border-hairline-strong bg-black/30 text-center space-y-2">
                  <Upload className="w-6 h-6 text-muted mx-auto" />
                  <div className="text-xs text-ink/85">
                    <span>قم برفع {inputType === 'image' ? 'صورة أو مخطوطة (OCR)' : 'مقطع صوتي (STT)'}</span>
                  </div>
                  <input
                    type="file"
                    accept={inputType === 'image' ? 'image/*' : 'audio/*'}
                    onChange={handleFileUpload}
                    className="text-xs text-muted file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-surface-3 file:text-ink hover:file:bg-surface-2 cursor-pointer"
                  />
                </div>

                {/* OCR Progress or Image Preview */}
                {mediaPreview && inputType === 'image' && (
                  <div className="p-3 bg-black/40 rounded-xl border border-hairline flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <img src={mediaPreview} alt="معاينة" className="w-10 h-10 object-cover rounded-md border border-hairline-strong" />
                      <div>
                        <span className="text-ink block font-medium">الصورة المرفوعة</span>
                        {isProcessingOcr ? (
                          <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            جارٍ استخراج النص عبر OCR...
                          </span>
                        ) : ocrEngineUsed ? (
                          <span className="text-emerald-400 text-[11px]">
                            تم استخراج النص بنجاح ({ocrEngineUsed === 'gemini' ? 'Gemini AI Vision' : 'Tesseract OCR'}) ✓
                          </span>
                        ) : (
                          <span className="text-muted text-[11px]">جاهزة للمعالجة</span>
                        )}
                      </div>
                    </div>

                    {!isProcessingOcr && (
                      <button
                        onClick={() => processImageOcr(mediaPreview)}
                        className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-ink/85 rounded text-[11px] transition-colors"
                      >
                        إعادة استخراج
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <span className="text-rose-400 font-bold shrink-0">⚠️</span>
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Text Input Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted">
                <label className="font-medium">
                  {inputType === 'url' ? 'محتوى المقالة المستخرج من الرابط:' : inputType === 'image' ? 'النص المستخرج من الصورة (OCR):' : 'المحتوى المراد فحصه وتوثيقه:'}
                </label>
                <span className="font-mono-numbers text-[11px] text-faint">
                  {inputText.length} حرف
                </span>
              </div>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  inputType === 'url'
                    ? 'اضغط «جلب محتوى الرابط» بالأعلى أو الصق النص هنا...'
                    : inputType === 'image'
                    ? 'سيرد هنا النص المستخرج من الصورة آلياً...'
                    : 'أدخل النص أو الحديث أو المقولة أو السؤال الفقهي هنا...'
                }
                className="w-full p-3 rounded-lg bg-black/40 border border-hairline-strong text-sm text-ink placeholder:text-faint focus:outline-none focus:border-gold font-amiri leading-relaxed resize-y"
              />
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleVerify}
              disabled={isProcessing || isProcessingOcr || isFetchingUrl || !inputText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gold-strong hover:bg-[#c96a12] disabled:bg-slate-800 disabled:text-faint text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-black/40 active:scale-[0.99] cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>جاري الفحص المتقاطع عبر المصادر المعتمدة...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>فحص وتوثيق المحتوى</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Presets tile */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bento-card h-full space-y-3 p-5 sm:p-6 reveal reveal-1">
            <div className="flex items-center justify-between pb-2 border-b border-hairline">
              <span className="text-xs font-semibold text-ink/85 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-gold" />
                حالات اختبار معيارية جاهزة للتجربة:
              </span>
              <span className="text-[11px] text-faint">اختر للتجربة بنقرة واحدة</span>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {SAMPLE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputType('text');
                    setInputText(preset.text);
                  }}
                  className="w-full text-right p-2.5 rounded-lg bg-black/20 hover:bg-white/[0.04] border border-hairline hover:border-gold/30 transition-all text-xs text-ink/85 flex items-start justify-between gap-2 group cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink group-hover:text-gold-soft transition-colors">
                      {preset.label}
                    </span>
                    <span className="text-[11px] text-faint line-clamp-1 font-amiri">
                      {preset.text}
                    </span>
                  </div>
                  <span className="text-[10px] text-faint shrink-0 font-sans mt-0.5">
                    {preset.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results tile */}
        <div className="col-span-12 space-y-5">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active Report Header */}
          {report ? (
            <div className="space-y-5">
              {/* Overall Decision Banner */}
              <div className="bento-card border border-hairline p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-hairline">
                  <div>
                    <span className="text-xs text-faint block mb-0.5 font-mono-numbers">
                      تقرير الفحص المرجعي #{report.id.slice(-6)}
                    </span>
                    <h3 className="text-base font-bold font-display text-ink">
                      ملخص نتيجة التحقق الشامل
                    </h3>
                  </div>

                  {/* Mode Switcher (Simple vs Detailed) */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-black/40 rounded-xl p-1 border border-hairline text-xs">
                      <button
                        onClick={() => setViewMode('simple')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          viewMode === 'simple'
                            ? 'bg-gold-strong text-white shadow-sm'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        ⚡ العرض الميسر (للعامّة)
                      </button>
                      <button
                        onClick={() => setViewMode('detailed')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          viewMode === 'detailed'
                            ? 'bg-gold-strong text-white shadow-sm'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        🔬 التحقيق العلمي (للمحكّمين)
                      </button>
                    </div>

                    <div className="text-left font-mono-numbers text-xs hidden sm:block">
                      <span className="text-emerald-400 font-semibold">{report.verifier_stats.matched_count} مطابق</span>
                      <span className="text-faint mx-1">·</span>
                      <span className="text-amber-400 font-semibold">{report.verifier_stats.needs_review_count} للمراجعة</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs leading-relaxed text-ink/85">
                  <p>{report.summary_ar}</p>
                </div>
              </div>

              {/* Per-Item Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted px-1">
                  <span>العناصر المستخرجة والمفحوصة ({report.verifications.length}):</span>
                  <span>مطابقة مع قواعد الحزمة العلمية</span>
                </div>

                {report.verifications.map((itemResult, idx) => (
                  <VerificationCard key={itemResult.id || idx} result={itemResult} index={idx} viewMode={viewMode} />
                ))}
              </div>
            </div>
          ) : (
            /* Empty State / Educational Showcase */
            <div className="bento-card border border-hairline p-8 shadow-lg text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold font-display text-ink">
                  محطة التحقق في انتظار المدخلات
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  اختر أحد الأمثلة الجاهزة على اليسار، أو الصق أي نص أو حديث أو مقالة لبدء الفحص المتقاطع عبر المصحف بالرسم العثماني وكتب السنة وموسوعة الجمهرة.
                </p>
              </div>

              {/* Quick Feature Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right pt-4 border-t border-hairline">
                <div className="p-3 rounded-lg bg-black/20 border border-hairline">
                  <strong className="text-xs font-semibold text-gold block mb-1">
                    كشف الفوارق اللفظية
                  </strong>
                  <span className="text-[11px] text-muted leading-normal block">
                    مقارنة حرفية بالرسم العثماني لكشف أي كلمة محرفة أو مبدلة.
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-black/20 border border-hairline">
                  <strong className="text-xs font-semibold text-gold block mb-1">
                    كشف خلط العزو
                  </strong>
                  <span className="text-[11px] text-muted leading-normal block">
                    فحص مزدوج يكشف الأحاديث المنسوبة كآيات والآيات المنسوبة كأحاديث.
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-black/20 border border-hairline">
                  <strong className="text-xs font-semibold text-gold block mb-1">
                    ضبط مصطلحات الجمهرة
                  </strong>
                  <span className="text-[11px] text-muted leading-normal block">
                    رصد اختزال المفاهيم الكبرى كالشريعة والتوحيد والجهاد والعبادة.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
