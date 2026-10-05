/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
import { apiFetch, API_BASE_URL } from '../lib/apiClient.ts';

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
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [ocrEngineUsed, setOcrEngineUsed] = useState<string | null>(null);
  const [ocrConsensus, setOcrConsensus] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; provider?: string; text_model?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');
  const [targetCategory, setTargetCategory] = useState<'auto' | 'ayah' | 'hadith' | 'fiqh_question' | 'term'>('auto');

  useEffect(() => {
    console.log('[BASEERA][CLIENT][BOOT]', JSON.stringify({ apiBaseUrl: API_BASE_URL || '(same-origin)', location: window.location.href }));
    let mounted = true;
    apiFetch('/api/ai-status')
      .then(async res => {
        console.log('[BASEERA][CLIENT][AI_STATUS_RESPONSE]', JSON.stringify({ ok: res.ok, status: res.status, serverVersion: res.headers.get('X-Baseera-Server-Version') }));
        return res.ok ? await res.json() : null;
      })
      .then(data => { if (mounted && data) setAiStatus(data); })
      .catch(() => { if (mounted) setAiStatus(null); });
    return () => { mounted = false; };
  }, []);

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
      setOcrConsensus(false);
    } else if (type === 'audio') {
      setInputText('');
      setMediaPreview(null);
      setOcrConsensus(false);
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
      const res = await apiFetch('/api/fetch-url', {
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
      const res = await apiFetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64: base64Data,
          ocrConsensus
        })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setInputText(data.text);
        setOcrEngineUsed(data.method);
        setOcrConsensus(data.consensus === true);
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
      } else if (inputType === 'audio') {
        processAudio(b64, file.type || 'audio/mpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const processAudio = async (base64Data: string, mimeType: string) => {
    setIsProcessingAudio(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaBase64: base64Data, mediaMimeType: mimeType })
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'تعذر تحويل الصوت إلى نص.');
      setInputText(data.text);
      setMediaPreview(base64Data);
    } catch (e: any) {
      setErrorMsg(e.message || 'فشل تحويل المقطع الصوتي إلى نص.');
    } finally {
      setIsProcessingAudio(false);
    }
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
    console.log('[BASEERA][CLIENT][VERIFY_START]', JSON.stringify({ apiBaseUrl: API_BASE_URL || '(same-origin)', location: window.location.href, inputType, inputLength: inputText.length, inputPreview: inputText.slice(0, 160) }));

    try {
      const payload: any = {
        inputType,
        targetCategory,
        text: inputText,
        url: inputType === 'url' ? urlInput : undefined,
        mediaBase64: (inputType === 'image' || inputType === 'audio') ? mediaPreview : undefined,
        ocrConsensus: inputType === 'image' ? ocrConsensus : false
      };

      let fetchedReport: AnalysisReport | null = null;

      let backendUnavailable = false;

      try {
        const res = await apiFetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok) {
          throw new Error(data?.error || `فشل خادم التحقق (HTTP ${res.status}).`);
        }

        console.log('[BASEERA][CLIENT][VERIFY_RESPONSE]', JSON.stringify({ ok: res.ok, status: res.status, serverVersion: res.headers.get('X-Baseera-Server-Version'), reportPresent: Boolean(data?.report), overallStatus: data?.report?.overall_status, summary: data?.report?.summary_ar, verifications: data?.report?.verifications?.map((v: any) => ({ type: v?.item?.type, text: v?.item?.text?.slice(0, 120), status: v?.status, citationUrl: v?.citation?.url || null, aiMatch: v?.ai_match || null })) }));

        if (data?.report) {
          fetchedReport = data.report;
        } else {
          throw new Error('لم يُرجع خادم التحقق تقريرًا صالحًا.');
        }
      } catch (networkErr: any) {
        console.error('[BASEERA][CLIENT][VERIFY_NETWORK_ERROR]', networkErr);
        backendUnavailable = true;
        console.error('Backend verification unavailable:', networkErr);
      }

      // Never silently downgrade a live-source verification to the local
      // offline engine. Fiqh/Tafsir/Aqeedah paths require their approved
      // backend connectors; an offline "not found" is not evidence.
      if (backendUnavailable && !fetchedReport) {
        const localItems = extractItemsRuleBased(inputText);
        const requiresLiveBackend = localItems.some(
          item => item.type === 'fiqh_question' ||
            item.type === 'tafsir_question' ||
            item.type === 'aqeedah_question'
        );

        if (requiresLiveBackend) {
          throw new Error(
            'تعذر الاتصال بخادم التحقق الحي. لم يتم إصدار «لم يُعثر عليه» لأن المصدر المعتمد يحتاج إلى البحث المباشر. شغّل خادم Baseera على المنفذ 3000 ثم أعد الفحص.'
          );
        }

        // Offline fallback remains allowed for purely local verification paths
        // such as exact Quran/terminology checks.
        fetchedReport = verifyExtractedItems(localItems, inputText, inputType);
      }

      if (fetchedReport) {
        setReport(fetchedReport);
      } else {
        throw new Error('لم يتم استلام تقرير تحقق صالح من خادم التحقق.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء فحص المحتوى.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* ── Compact Title ─────────────────────────────────── */}
      <header className="text-center mb-8 reveal">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          تحقق من <span className="gradient-text">المحتوى الشرعي</span>
        </h1>
        <p className="mt-2 text-sm text-muted max-w-lg mx-auto">
          الصق نصاً أو حديثاً أو آية — بصيرة تتحقق من المصادر المعتمدة فوراً
        </p>
      </header>

      {/* ── Main Input Card ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 reveal reveal-1">

        {/* Input Type Tabs — minimal inline pills */}
        <div className="flex items-center gap-1.5">
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Settings — pushed to end */}
          <button onClick={() => setShowSettings(!showSettings)} className="mr-auto text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer" title="إعدادات API">
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {/* Collapsible API Key */}
        {showSettings && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">حالة الذكاء الاصطناعي</span>
              <span className={aiStatus?.enabled ? 'text-emerald-600' : 'text-amber-600'}>
                {aiStatus?.enabled ? 'Groq متصل' : 'Groq غير مهيأ'}
              </span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              يستخدم الخادم Groq للمضاهاة الدلالية واستخراج النية، بينما تبقى المصادر المعتمدة هي المرجع النهائي.
            </p>
            {aiStatus?.text_model && (
              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                {aiStatus.text_model}
              </div>
            )}
          </div>
        )}

        {/* URL Input */}
        {inputType === 'url' && (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://dorar.net/article/..."
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] font-mono"
            />
            <button
              onClick={handleFetchUrl}
              disabled={isFetchingUrl}
              className="px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#2D5280] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {isFetchingUrl ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>جلب...</span></>
              ) : (
                <><Globe className="w-3.5 h-3.5" /><span>جلب المحتوى</span></>
              )}
            </button>
          </div>
        )}

        {/* Image / Audio Upload */}
        {(inputType === 'image' || inputType === 'audio') && (
          <div className="space-y-3">
            <div className="p-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center space-y-2 hover:border-slate-300 transition-colors">
              <Upload className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500">
                {inputType === 'image' ? 'ارفع صورة تحتوي على نص' : 'ارفع مقطعاً صوتياً'}
              </p>
              <input
                type="file"
                accept={inputType === 'image' ? 'image/*' : 'audio/*'}
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-[#1E3A5F] file:text-white hover:file:bg-[#2D5280] cursor-pointer"
              />
            </div>

            {/* OCR Preview */}
            {mediaPreview && inputType === 'image' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <img src={mediaPreview} alt="معاينة" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                  <div>
                    <span className="text-slate-800 block font-medium">الصورة المرفوعة</span>
                    {isProcessingOcr ? (
                      <span className="text-amber-600 flex items-center gap-1 text-[11px]">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        جارٍ استخراج النص...
                      </span>
                    ) : ocrEngineUsed ? (
                      <span className="text-emerald-600 text-[11px]">
                        تم الاستخراج بنجاح ({ocrEngineUsed?.startsWith('groq') ? 'Groq Vision' : 'Tesseract'})
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">جاهزة للمعالجة</span>
                    )}
                  </div>
                </div>
                {!isProcessingOcr && (
                  <button
                    onClick={() => processImageOcr(mediaPreview)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] border border-slate-200 transition-colors cursor-pointer"
                  >
                    إعادة
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Content Type Selector — Quran, Hadith, Fiqh, Term, Auto */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-500 font-medium ml-1">المجال المستهدف:</span>
          {[
            { id: 'auto', label: 'كشف تلقائي (شامل)', icon: Sparkles },
            { id: 'ayah', label: 'قرآن كريم', icon: BookOpen },
            { id: 'hadith', label: 'حديث نبوي', icon: ShieldCheck },
            { id: 'fiqh_question', label: 'حكم فقهي', icon: HelpCircle },
            { id: 'term', label: 'مصطلح شرعي', icon: FileText }
          ].map(cat => {
            const active = targetCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTargetCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                  active
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Text Area — THE HERO */}
        <div>
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              inputType === 'url'
                ? 'سيظهر هنا محتوى الرابط بعد الجلب...'
                : inputType === 'image'
                ? 'سيظهر هنا النص المستخرج من الصورة...'
                : inputType === 'audio'
                ? 'سيظهر هنا النص المستخرج من الصوت...'
                : 'الصق هنا الحديث أو الآية أو النص المراد التحقق منه...'
            }
            className="w-full min-h-[140px] p-4 rounded-xl bg-slate-50 border border-slate-200 text-base text-ink placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 font-naskh leading-loose resize-y"
          />
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[11px] text-slate-400">
              {inputType === 'url' ? 'محتوى الرابط' : inputType === 'image' ? 'نص الصورة' : inputType === 'audio' ? 'نص الصوت' : 'المحتوى المراد فحصه'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {inputText.length} حرف
            </span>
          </div>
        </div>

        {/* Verify Button — BIG and prominent */}
        <button
          onClick={handleVerify}
          disabled={isProcessing || isProcessingOcr || isProcessingAudio || isFetchingUrl || !inputText.trim()}
          className="w-full py-3.5 rounded-xl bg-[#1E3A5F] hover:bg-[#2D5280] disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-all flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
        >
          {isProcessing ? (
            <><RefreshCw className="w-4.5 h-4.5 animate-spin" /><span>جارٍ الفحص عبر المصادر المعتمدة...</span></>
          ) : isProcessingAudio ? (
            <><RefreshCw className="w-4.5 h-4.5 animate-spin" /><span>جارٍ تحويل الصوت...</span></>
          ) : (
            <><ShieldCheck className="w-4.5 h-4.5" /><span>تحقّق الآن</span></>
          )}
        </button>
      </div>

      {/* ── Quick Presets — horizontal scroll chips ────── */}
      <div className="mt-5 reveal reveal-2">
        <p className="text-xs text-slate-500 mb-2.5 flex items-center gap-1.5 px-1">
          <Sparkles className="w-3.5 h-3.5" />
          جرّب مثالاً جاهزاً:
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SAMPLE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputType('text');
                setInputText(preset.text);
                if (preset.category === 'القرآن الكريم') setTargetCategory('ayah');
                else if (preset.category === 'السنة النبوية') setTargetCategory('hadith');
                else if (preset.category === 'الفقه والأحكام' || preset.category === 'الفتاوى والأحوال') setTargetCategory('fiqh_question');
                else if (preset.category === 'مصطلحات الجمهرة') setTargetCategory('term');
                else setTargetCategory('auto');
              }}
              className="shrink-0 px-3.5 py-2 rounded-full bg-white border border-slate-200 hover:border-[#1E3A5F] hover:text-[#1E3A5F] text-xs text-slate-600 font-medium transition-all cursor-pointer whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────── */}
      <div className="mt-8 space-y-5">
        {report ? (
          <div className="space-y-5 reveal">
            {/* Report Header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    تقرير #{report.id.slice(-6)}
                  </span>
                  <h3 className="text-base font-bold font-display text-ink">
                    نتيجة التحقق
                  </h3>
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex bg-slate-100 rounded-full p-0.5 text-xs">
                    <button
                      onClick={() => setViewMode('simple')}
                      className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                        viewMode === 'simple'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      مبسّط
                    </button>
                    <button
                      onClick={() => setViewMode('detailed')}
                      className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                        viewMode === 'detailed'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      تفصيلي
                    </button>
                  </div>

                  <div className="text-xs font-medium hidden sm:flex items-center gap-2">
                    <span className="text-emerald-600">{report.verifier_stats.matched_count} مطابق</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-amber-600">{report.verifier_stats.needs_review_count} مراجعة</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {report.summary_ar}
              </p>
            </div>

            {/* Verification Cards */}
            <div className="space-y-3">
              {report.verifications.map((itemResult, idx) => (
                <VerificationCard key={itemResult.id || idx} result={itemResult} index={idx} viewMode={viewMode} />
              ))}
            </div>
          </div>
        ) : !isProcessing && (
          /* Empty State — minimal */
          <div className="text-center py-16 reveal reveal-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">
              في انتظار النص
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              الصق نصاً أعلاه أو اختر مثالاً جاهزاً لبدء التحقق من المصادر المعتمدة
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
