/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  ExternalLink,
  FolderOpen,
  Settings2,
  Puzzle,
  Play,
  Pause,
  RotateCcw,
  MousePointer2,
  CheckCircle2,
  Lock,
  Copy,
  Search,
  Sparkles,
  Share2,
  Bookmark,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface SimulationStep {
  id: number;
  label: string;
  shortDesc: string;
  guideText: string;
}

const STEPS: SimulationStep[] = [
  {
    id: 0,
    label: '1. تصفح المنشور',
    shortDesc: 'قراءة المحتوى على الويب',
    guideText: 'المستخدم يتصفح مقالاً أو منشوراً على الإنترنت يحتوي على نص ديني أو حديث نبوي.'
  },
  {
    id: 1,
    label: '2. تحديد النص',
    shortDesc: 'تظليل النص بالماوس',
    guideText: 'يقوم المستخدم بتحديد وتظليل النص المراد التحقق من صحته وتخريجه عبر مؤشر الفأرة.'
  },
  {
    id: 2,
    label: '3. الزر الأيمن للفأرة',
    shortDesc: 'فتح قائمة السياق',
    guideText: 'الضغط بالزر الأيمن للفأرة تظهر قائمة المتصفح وتتضمن خيار «تحقّق عبر بصيرة» الخاص بالإضافة.'
  },
  {
    id: 3,
    label: '4. ظهور بطاقة بصيرة',
    shortDesc: 'توثيق فوري وإحالة للمصدر',
    guideText: 'فور النقر، تنبثق بطاقة بصيرة مباشرة فوق المنشور دون مغادرة الصفحة لتعرض الحكم المعتمد ورابط الدرر السنية.'
  }
];

export const ExtensionSimulatorView: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 3200);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
  };

  const handleNext = () => {
    setCurrentStep((prev) => (prev + 1) % STEPS.length);
  };

  return (
    <div className="page-shell extension-page mx-auto max-w-[1380px] space-y-8 px-4 py-7 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="extension-hero reveal">
        <div className="extension-hero-copy">
          <div className="extension-badge">
            <Puzzle className="h-4 w-4" aria-hidden="true" />
            إضافة بصيرة للمتصفح
          </div>

          <h1 className="extension-hero-title">التحقق المباشر أثناء التصفح</h1>
          <p className="extension-hero-text">
            إضافة خفيفة تتيح لك فحص النصوص وتوثيقها بالرجوع إلى المصادر المعتمدة مباشرة دون مغادرة الصفحة.
          </p>

          <a
            href="/baseera-extension.zip"
            download="baseera-extension.zip"
            className="extension-download"
          >
            <Download className="h-4 w-4" />
            تحميل الإضافة (baseera-extension.zip)
          </a>
        </div>

        <div className="extension-hero-mark" aria-hidden="true">
          <Puzzle className="h-10 w-10 text-brand" />
          <span>بصيرة للمتصفح</span>
        </div>
      </section>

      {/* Installation Steps */}
      <section className="extension-install" aria-label="تثبيت الإضافة">
        <div className="extension-section-head">
          <div>
            <div className="eyebrow">طريقة التثبيت</div>
            <h2 className="extension-section-title">خطوات تشغيل الإضافة</h2>
          </div>
          <span className="extension-section-note">4 خطوات سريعة</span>
        </div>

        <div className="extension-install-grid">
          <div className="extension-install-card">
            <div className="extension-step-icon"><Download /></div>
            <div className="extension-step-no">01</div>
            <strong>فك الضغط</strong>
            <p>استخرج محتويات ملف <code>baseera-extension.zip</code> إلى مجلد مستقل على جهازك.</p>
          </div>
          <div className="extension-install-card">
            <div className="extension-step-icon"><FolderOpen /></div>
            <div className="extension-step-no">02</div>
            <strong>صفحة الإضافات</strong>
            <p>افتح إعدادات الإضافات في المتصفح عبر <code>chrome://extensions</code>.</p>
          </div>
          <div className="extension-install-card">
            <div className="extension-step-icon"><Settings2 /></div>
            <div className="extension-step-no">03</div>
            <strong>وضع المطور</strong>
            <p>شغّل خيار <strong>Developer mode</strong> من الزاوية العلوية.</p>
          </div>
          <div className="extension-install-card">
            <div className="extension-step-icon"><Puzzle /></div>
            <div className="extension-step-no">04</div>
            <strong>تحميل الإضافة</strong>
            <p>اضغط <strong>Load unpacked</strong> وحدد مجلد الإضافة المفكوك.</p>
          </div>
        </div>
      </section>

      {/* Realistic Animated Browser Walkthrough */}
      <section className="extension-showcase p-6 sm:p-8 space-y-6" aria-label="محاكاة حية لطريقة عمل الإضافة">
        {/* Section Header with Animation Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div>
            <div className="eyebrow">محاكاة حية وتفاعلية</div>
            <h2 className="extension-section-title">
              كيف تظهر وتعمل إضافة بصيرة فعليًا؟
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-1">
              شاهد كيف تنبثق الإضافة وتوثق الأحاديث مباشرة عند تحديد أي نص والنقر بالزر الأيمن للفأرة.
            </p>
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              type="button"
              onClick={handlePrev}
              title="الخطوة السابقة"
              className="p-2 rounded-lg border border-hairline hover:bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              className="px-3 py-1.5 rounded-lg border border-hairline bg-surface hover:bg-surface-2 text-ink text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-brand" />
                  <span>إيقاف مؤقت</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-brand" />
                  <span>تشغيل العرض</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              title="إعادة العرض من البداية"
              className="p-2 rounded-lg border border-hairline hover:bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="الخطوة التالية"
              className="p-2 rounded-lg border border-hairline hover:bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Step Timeline Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isPassed = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step.id)}
                className={`text-right p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand/10 border-brand text-brand-strong shadow-sm'
                    : isPassed
                    ? 'bg-surface border-emerald-200 text-ink hover:border-brand/40'
                    : 'bg-surface border-hairline text-muted hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isActive ? 'text-brand-strong' : ''}`}>
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
                  )}
                </div>
                <div className="text-[11px] text-muted mt-1 line-clamp-1">
                  {step.shortDesc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Guide Note */}
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-brand-strong">
          <Sparkles className="w-4 h-4 shrink-0 text-brand" />
          <span>{STEPS[currentStep].guideText}</span>
        </div>

        {/* Realistic Mock Browser Window */}
        <div className="mock-browser-window rounded-2xl border border-slate-300/80 bg-white shadow-2xl overflow-hidden transition-all duration-300">
          {/* Browser Chrome Header (Toolbar) */}
          <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 select-none">
            {/* Window control dots */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
            </div>

            {/* Address Bar */}
            <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 bg-white border border-slate-200/90 rounded-lg px-3 py-1 text-xs text-slate-600 shadow-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-mono text-[11px] text-slate-700 truncate direction-ltr text-left flex-1">
                https://al-maktaba.org/posts/hadith-niyyah
              </span>
            </div>

            {/* Browser Extension Toolbar */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  currentStep >= 2
                    ? 'bg-brand text-white shadow-sm ring-2 ring-brand/30'
                    : 'bg-slate-200/70 text-slate-700'
                }`}
                title="إضافة بصيرة مثبتة في شريط المتصفح"
              >
                <Puzzle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">بصيرة</span>
              </div>
            </div>
          </div>

          {/* Browser Viewport: The Webpage Content */}
          <div className="p-6 sm:p-10 bg-[#fdfdfc] relative min-h-[460px] flex items-center justify-center">
            {/* Simulated Web Post Card */}
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 relative">
              {/* Post Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    د
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">شبكة الدراسات الحديثية</h3>
                    <p className="text-[11px] text-slate-500">منشور على الويب · منذ ساعتين</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Bookmark className="w-4 h-4 hover:text-slate-600 transition-colors cursor-pointer" />
                  <Share2 className="w-4 h-4 hover:text-slate-600 transition-colors cursor-pointer" />
                </div>
              </div>

              {/* Post Title */}
              <h4 className="font-display font-bold text-lg sm:text-xl text-slate-900 leading-snug">
                عظمة النية ومدار الشريعة على إخلاص المقاصد
              </h4>

              {/* Post Paragraph */}
              <p className="text-slate-600 text-sm leading-relaxed font-sans">
                قال أئمة الهدى رحمهم الله: مدار أعمال المكلفين كلها على صدق القلوب وصلاح مقاصدها، وقد استفتح الإمام البخاري صحيحه بهذا الحديث الجليل لبيان أن كل عمل لا يُراد به وجه الله فهو باطل:
              </p>

              {/* The Target Quote Block (Where User Interacts) */}
              <div className="relative my-4 p-5 rounded-xl bg-slate-50/80 border border-slate-200/80 font-amiri text-lg leading-loose text-slate-800">
                <span>«</span>
                <span
                  className={`transition-all duration-300 relative inline ${
                    currentStep >= 1
                      ? 'bg-emerald-200/80 text-emerald-950 font-bold px-1.5 py-0.5 rounded shadow-xs'
                      : ''
                  }`}
                >
                  إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله
                </span>
                <span>»</span>

                {/* Animated Mouse Pointer Indicator */}
                {currentStep === 1 && (
                  <div className="absolute -top-3 left-1/3 flex items-center gap-1.5 animate-bounce z-20 pointer-events-none">
                    <MousePointer2 className="w-5 h-5 text-emerald-800 fill-emerald-800 drop-shadow" />
                    <span className="text-[10px] bg-emerald-900 text-white font-sans px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                      تم تحديد النص
                    </span>
                  </div>
                )}

                {/* Step 2: The Right-Click Browser Context Menu */}
                {currentStep === 2 && (
                  <div className="absolute top-8 left-1/4 sm:left-1/3 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 text-xs text-slate-700 font-sans">
                    <div className="px-3 py-1.5 flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-2">
                        <Copy className="w-3.5 h-3.5" />
                        نسخ (Copy)
                      </span>
                      <span className="text-[10px] font-mono">Ctrl+C</span>
                    </div>

                    <div className="px-3 py-1.5 flex items-center gap-2 text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                      بحث في الويب
                    </div>

                    <div className="my-1 border-t border-slate-100" />

                    {/* The Baseera Action Entry in the Context Menu */}
                    <div className="px-3 py-2 bg-emerald-50 text-emerald-900 font-bold flex items-center gap-2 border-s-3 border-emerald-600 shadow-xs relative">
                      <Puzzle className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="flex-1">تحقّق عبر بصيرة</span>
                      <span className="text-[9px] bg-emerald-700 text-white px-1.5 py-0.5 rounded font-normal">
                        إضافة
                      </span>

                      {/* Pointer clicking this item */}
                      <div className="absolute -left-2 top-2 pointer-events-none animate-pulse">
                        <MousePointer2 className="w-4 h-4 text-emerald-900 fill-emerald-900" />
                      </div>
                    </div>

                    <div className="my-1 border-t border-slate-100" />

                    <div className="px-3 py-1.5 text-slate-400">
                      فحص العنصر (Inspect)
                    </div>
                  </div>
                )}

                {/* Step 3: Baseera Verification Card Overlay (Pops up right above the post) */}
                {currentStep === 3 && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-emerald-600/30 p-5 z-40 animate-in fade-in slide-in-from-top-3 text-right font-sans">
                    {/* Card Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                          <Puzzle className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 block leading-none">
                            بصيرة — التحقق المباشر
                          </span>
                          <span className="text-[10px] text-emerald-700">نافذة الإضافة المنبثقة</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        v1.0.0
                      </span>
                    </div>

                    {/* Verified Status Banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-emerald-950">
                          حديث صحيح — متفق عليه
                        </div>
                        <div className="text-[11px] text-emerald-800 mt-0.5">
                          المصدر المعتمد: الموسوعة الحديثية — الدرر السنية
                        </div>
                      </div>
                    </div>

                    {/* Canonical Text / Citation */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs mb-3 space-y-1">
                      <div className="text-[10px] text-slate-500 font-bold">
                        تخريج الحديث في كتب السنة المسندة:
                      </div>
                      <p className="font-amiri text-sm text-slate-900 leading-relaxed">
                        «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى...»
                      </p>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        رواه البخاري في صحيحه (1)، ومسلم (1907) عن عمر بن الخطاب رضي الله عنه.
                      </div>
                    </div>

                    {/* Action Link to Dorar */}
                    <a
                      href="https://dorar.net/hadith/sharh/1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>فتح الدليل الأصلي في موسوعة الدرر السنية</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div className="text-center text-[10px] text-slate-400 mt-2">
                      تم التوثيق آليًا عبر إضافة بصيرة دون مغادرة صفحة القراءة
                    </div>
                  </div>
                )}
              </div>

              {/* Post Footer */}
              <p className="text-slate-500 text-xs leading-relaxed font-sans">
                وهذا الأصل من قواعد الدين الكلية التي اتفق عليها أهل العلم والتحقيق في قبول الأعمال وردها...
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
