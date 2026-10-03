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
  Sparkles
} from 'lucide-react';
import { AnalysisReport } from '../types/baseera.ts';
import { VerificationCard } from './VerificationCard.tsx';

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
  const [urlInput, setUrlInput] = useState('https://example.com/islamic-article-review');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      let payload: any = {
        inputType,
        text: inputText
      };

      if (inputType === 'url') {
        payload.url = urlInput;
        payload.text = inputText || `مقالة مسترجعة من الرابط: ${urlInput}`;
      } else if (inputType === 'image' || inputType === 'audio') {
        payload.mediaBase64 = mediaPreview;
        payload.mediaMimeType = inputType === 'image' ? 'image/jpeg' : 'audio/mp3';
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`خطأ في استجابة الخادم: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.report) {
        setReport(data.report);
      } else {
        throw new Error(data.error || 'لم يتم استلام تقرير تحقق صالح.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بمحرك التحقق.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setMediaPreview(reader.result as string);
      setInputText(`[ملف تم تحميله: ${file.name}]`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Hero Header */}
      <div className="border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <span>المسار الرابع</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-emerald-400 font-medium">التحقق والتوثيق والسياق</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-tajawal text-white tracking-tight">
              محطة التحقق من النصوص الشرعية والسياق المعتمد
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              «النموذج اللغوي يستخرج ويقترح، والمصدر المعتمد في الحزمة العلمية هو الذي يحكم ويثبت».
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg max-w-sm">
            <span className="text-slate-200 font-semibold block mb-0.5">المصادر المعتمدة المربوطة:</span>
            <span>مصحف المدينة (مجمع الملك فهد) · الموسوعة الحديثية (الدرر السنية) · موسوعة الجمهرة · الموسوعة الفقهية</span>
          </div>
        </div>
      </div>

      {/* Main Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Form (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-5 shadow-lg space-y-4">
            {/* Input Type Segmented Control */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-slate-300">قناة الإدخال:</span>
              <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-lg border border-white/[0.06] text-xs">
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
                      onClick={() => setInputType(tab.id as any)}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 font-medium ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Fields based on Channel */}
            {inputType === 'url' && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">رابط المقال أو الصفحة:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/islamic-article"
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            )}

            {(inputType === 'image' || inputType === 'audio') && (
              <div className="p-4 rounded-xl border border-dashed border-white/[0.15] bg-black/30 text-center space-y-2">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-xs text-slate-300">
                  <span>قم برفع {inputType === 'image' ? 'صورة أو مخطوطة (OCR)' : 'مقطع صوتي (STT)'}</span>
                </div>
                <input
                  type="file"
                  accept={inputType === 'image' ? 'image/*' : 'audio/*'}
                  onChange={handleFileUpload}
                  className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>
            )}

            {/* Text Input Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="font-medium">
                  {inputType === 'url' ? 'محتوى المقالة المستخرج (أو أدخل نصاً يدوياً):' : 'المحتوى المراد فحصه وتوثيقه:'}
                </label>
                <span className="font-mono-numbers text-[11px] text-slate-500">
                  {inputText.length} حرف
                </span>
              </div>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="أدخل النص أو الحديث أو المقولة أو السؤال الفقهي هنا..."
                className="w-full p-3 rounded-lg bg-black/40 border border-white/[0.1] text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-amiri leading-relaxed resize-y"
              />
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleVerify}
              disabled={isProcessing || !inputText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950 active:scale-[0.99] cursor-pointer"
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

          {/* Quick Presets Section (Anti-Pill, Grouped by Discipline) */}
          <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                حالات اختبار معيارية جاهزة للتجربة:
              </span>
              <span className="text-[11px] text-slate-500">اختر للتجربة بنقرة واحدة</span>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {SAMPLE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputType('text');
                    setInputText(preset.text);
                  }}
                  className="w-full text-right p-2.5 rounded-lg bg-black/20 hover:bg-white/[0.04] border border-white/[0.04] hover:border-emerald-500/30 transition-all text-xs text-slate-300 flex items-start justify-between gap-2 group cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-200 group-hover:text-emerald-300 transition-colors">
                      {preset.label}
                    </span>
                    <span className="text-[11px] text-slate-500 line-clamp-1 font-amiri">
                      {preset.text}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-sans mt-0.5">
                    {preset.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Verification Results (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
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
              <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5 font-mono-numbers">
                      تقرير الفحص المرجعي #{report.id.slice(-6)}
                    </span>
                    <h3 className="text-base font-bold font-tajawal text-white">
                      ملخص نتيجة التحقق الشامل
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-left font-mono-numbers">
                      <span className="text-emerald-400 font-semibold">{report.verifier_stats.matched_count} مطابق</span>
                      <span className="text-slate-600 mx-1.5">·</span>
                      <span className="text-amber-400 font-semibold">{report.verifier_stats.needs_review_count} للمراجعة</span>
                      <span className="text-slate-600 mx-1.5">·</span>
                      <span className="text-slate-400">{report.verifier_stats.not_found_count} لم يُعثر عليه</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs leading-relaxed text-slate-300">
                  <p>{report.summary_ar}</p>
                </div>
              </div>

              {/* Per-Item Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>العناصر المستخرجة والمفحوصة ({report.verifications.length}):</span>
                  <span>مطابقة مع قواعد الحزمة العلمية</span>
                </div>

                {report.verifications.map((itemResult, idx) => (
                  <VerificationCard key={itemResult.id || idx} result={itemResult} index={idx} />
                ))}
              </div>
            </div>
          ) : (
            /* Empty State / Educational Showcase */
            <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-8 shadow-lg text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold font-tajawal text-white">
                  محطة التحقق في انتظار المدخلات
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  اختر أحد الأمثلة الجاهزة على اليسار، أو الصق أي نص أو حديث أو مقالة لبدء الفحص المتقاطع عبر المصحف بالرسم العثماني وكتب السنة وموسوعة الجمهرة.
                </p>
              </div>

              {/* Quick Feature Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right pt-4 border-t border-white/[0.06]">
                <div className="p-3 rounded-lg bg-black/20 border border-white/[0.04]">
                  <strong className="text-xs font-semibold text-emerald-400 block mb-1">
                    كشف الفوارق اللفظية
                  </strong>
                  <span className="text-[11px] text-slate-400 leading-normal block">
                    مقارنة حرفية بالرسم العثماني لكشف أي كلمة محرفة أو مبدلة.
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-black/20 border border-white/[0.04]">
                  <strong className="text-xs font-semibold text-emerald-400 block mb-1">
                    كشف خلط العزو
                  </strong>
                  <span className="text-[11px] text-slate-400 leading-normal block">
                    فحص مزدوج يكشف الأحاديث المنسوبة كآيات والآيات المنسوبة كأحاديث.
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-black/20 border border-white/[0.04]">
                  <strong className="text-xs font-semibold text-emerald-400 block mb-1">
                    ضبط مصطلحات الجمهرة
                  </strong>
                  <span className="text-[11px] text-slate-400 leading-normal block">
                    رصد اختزال المفاهيم الكبرى كالشريعة والتوحيد والجهاد والعبادة.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
