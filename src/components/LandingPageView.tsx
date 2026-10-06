import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Sparkles,
  BookOpenCheck,
  FileSearch,
  Scale,
  ArrowLeft,
  AlertTriangle,
  XCircle,
  GitCompare,
  CheckCircle2,
  ChevronLeft,
  Puzzle,
  Download,
  ExternalLink,
  MousePointer2
} from 'lucide-react';

type TabId = 'home' | 'verifier' | 'dawah' | 'extension' | 'sources' | 'benchmark' | 'governance';

interface LandingPageViewProps {
  onNavigate: (tab: TabId) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => {
  // Animated sequential step highlight for "كيف يحل بصيرة المشكلة"
  const [activeStep, setActiveStep] = useState<number>(0);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 2800);

    return () => {
      clearInterval(stepTimer);
    };
  }, []);

  return (
    <div className="page-shell baseera-home relative">
      {/* 1. HERO SECTION - Clean, modern, atmospheric lighting */}
      <section className="relative overflow-hidden pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-line/60 bg-gradient-to-b from-surface/60 via-page to-page">
        {/* Soft, elegant ambient top glow */}
        <div
          className="absolute inset-0 pointer-events-none select-none opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(33, 99, 67, 0.09), rgba(163, 122, 45, 0.05), transparent 75%)'
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center home-fade-in">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-line bg-surface text-xs font-bold text-muted shadow-xs">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span>بصيرة · للتحقق من المحتوى الإسلامي</span>
          </div>

          {/* Main Title */}
          <h1 className="mt-4 font-display text-2xl sm:text-3xl md:text-4xl font-bold text-ink leading-snug">
            التحقق من المحتوى الإسلامي بالمصدر والدليل أولًا
          </h1>

          {/* Direct Subtitle */}
          <p className="mt-3.5 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed text-muted">
            يفحص بصيرة الآيات والأحاديث والمصطلحات والمسائل الفقهية بالرجوع إلى المصادر المعتمدة، ويعرض الدليل القابل للتتبع، ويمتنع عن إصدار حكم عندما لا تكفي الأدلة.
          </p>

          {/* Main Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('verifier')}
              className="btn btn-primary min-h-11 px-6 text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5 cursor-pointer"
            >
              <ShieldCheck className="h-4.5 w-4.5" /> ابدأ الفحص المباشر <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dawah')}
              className="btn btn-secondary min-h-11 px-5 text-sm font-bold transition-transform hover:-translate-y-0.5 cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-brand" /> إعداد المحتوى
            </button>
          </div>

          {/* Extension Download Button */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/baseera-extension.zip"
              download="baseera-extension.zip"
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-line bg-surface hover:border-brand hover:bg-brand-soft/20 text-ink font-bold text-xs shadow-xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            >
              <Download className="h-4 w-4 text-brand" />
              <span>تحميل إضافة المتصفح (Chrome Extension)</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. THE CURRENT PROBLEM (المشكلة الحالية) */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center max-w-xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-danger-soft text-danger text-xs font-bold">
            <AlertTriangle className="h-3.5 w-3.5" /> المشكلة الحالية
          </span>
          <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold text-ink">
            تحديات التحقق من المحتوى الشرعي
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            أبرز المخاطر التي تجعل النقل الرقمي بحاجة إلى حوكمة وتثبت مستمر:
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-300 hover:border-danger/40 hover:-translate-y-1 hover:shadow-md group">
            <div className="w-10 h-10 rounded-xl bg-danger-soft text-danger flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110">
              <XCircle className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-ink">نصوص منسوبة دون توثيق متبع</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              أحاديث ونصوص منسوبة إلى النبي ﷺ دون توثيق يمكن تتبعه في المصادر المفحوصة، مع سرعة تداولها على المنصات الرقمية.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-300 hover:border-amber-400/50 hover:-translate-y-1 hover:shadow-md group">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-ink">إسقاط قيود المسائل وسياقها</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              نقل أحكام فقهية مجردة من قيودها وشروطها المعتمدة في المذاهب، مما يؤدي إلى فهم خاطئ للحكم ونسبته لغير قائله.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-300 hover:border-danger/40 hover:-translate-y-1 hover:shadow-md group">
            <div className="w-10 h-10 rounded-xl bg-danger-soft text-danger flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-ink">توليد إجابات دينية دون عزو</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              اعتماد النماذج التوليدية العامة على التخمين الإحصائي، وتقديم إجابات وفتاوى إنشائية بلا إسناد صريح لمصدر معتمد.
            </p>
          </div>
        </div>
      </section>

      {/* Subtle Divider */}
      <div className="my-2 border-t border-line/60 max-w-3xl mx-auto" aria-hidden="true" />

      {/* 3. HOW BASEERA SOLVES IT (كيف يحل بصيرة المشكلة) - With Sequential Active Flow Animation */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center max-w-xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-strong text-xs font-bold">
            <CheckCircle2 className="h-3.5 w-3.5 text-brand" /> منهجية الحل
          </span>
          <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold text-ink">
            كيف يحل «بصيرة» المشكلة؟
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            معمارية استرجاع حتمية تلتزم بالمصدر وتمتنع عند عدم كفاية الأدلة:
          </p>

          {/* Sequential Step Progress Dots */}
          <div className="flex items-center justify-center gap-2 mt-4" aria-label="مؤشر مراحل الفحص">
            <span
              className={`h-1.5 rounded-full transition-all duration-500 ${
                activeStep === 0 ? 'w-8 bg-brand' : 'w-2 bg-line'
              }`}
            />
            <span
              className={`h-1.5 rounded-full transition-all duration-500 ${
                activeStep === 1 ? 'w-8 bg-brand' : 'w-2 bg-line'
              }`}
            />
            <span
              className={`h-1.5 rounded-full transition-all duration-500 ${
                activeStep === 2 ? 'w-8 bg-brand' : 'w-2 bg-line'
              }`}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div
            onClick={() => setActiveStep(0)}
            className={`rounded-2xl border p-5 transition-all duration-500 cursor-pointer ${
              activeStep === 0
                ? 'border-brand bg-white ring-2 ring-brand/15 shadow-md -translate-y-1'
                : 'border-line bg-surface hover:border-brand/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-bold text-xs transition-all duration-300 ${
                  activeStep === 0
                    ? 'bg-brand text-white shadow-xs scale-110'
                    : 'bg-brand-soft text-brand-strong'
                }`}
              >
                ١
              </span>
              {activeStep === 0 && (
                <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
              )}
            </div>
            <h3 className="font-display text-base font-bold text-ink">البحث في المصادر المعتمدة أولًا</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              البحث المباشر في المصادر المعتمدة لكل نوع من المحتوى قبل تقديم النتيجة، دون توليد من الفراغ.
            </p>
          </div>

          {/* Step 2 */}
          <div
            onClick={() => setActiveStep(1)}
            className={`rounded-2xl border p-5 transition-all duration-500 cursor-pointer ${
              activeStep === 1
                ? 'border-brand bg-white ring-2 ring-brand/15 shadow-md -translate-y-1'
                : 'border-line bg-surface hover:border-brand/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-bold text-xs transition-all duration-300 ${
                  activeStep === 1
                    ? 'bg-brand text-white shadow-xs scale-110'
                    : 'bg-brand-soft text-brand-strong'
                }`}
              >
                ٢
              </span>
              {activeStep === 1 && (
                <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
              )}
            </div>
            <h3 className="font-display text-base font-bold text-ink">عرض قيود المسألة وسياقها الفقهي</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              بيان ما تنقله المصادر المعتمدة، مع إظهار الخلاف عند وجوده ودون ترجيح آلي؛ لأن صفحة ذات صلة لا تعني إثبات المسألة.
            </p>
          </div>

          {/* Step 3 */}
          <div
            onClick={() => setActiveStep(2)}
            className={`rounded-2xl border p-5 transition-all duration-500 cursor-pointer ${
              activeStep === 2
                ? 'border-brand bg-white ring-2 ring-brand/15 shadow-md -translate-y-1'
                : 'border-line bg-surface hover:border-brand/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-bold text-xs transition-all duration-300 ${
                  activeStep === 2
                    ? 'bg-brand text-white shadow-xs scale-110'
                    : 'bg-brand-soft text-brand-strong'
                }`}
              >
                ٣
              </span>
              {activeStep === 2 && (
                <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
              )}
            </div>
            <h3 className="font-display text-base font-bold text-ink">إبراز الدليل والمادة المصدرية</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              إبراز النص أو المادة المصدرية ورابطها المباشر متى كان متاحًا، لتمكين المستخدم من مراجعة الدليل وسياقه بنفسه.
            </p>
          </div>
        </div>
      </section>

      {/* Subtle Divider */}
      <div className="my-2 border-t border-line/60 max-w-3xl mx-auto" aria-hidden="true" />

      {/* 4. BASEERA TOOLSUITE (أدوات بصيرة) - Featuring the Browser Extension as Flagship */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center max-w-xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-soft text-gold-strong text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5 text-gold-strong" /> أدوات المنظومة
          </span>
          <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold text-ink">
            أدوات بصيرة
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            الأداة الأبرز في المنظومة مع باقة من أدوات الفحص والإسناد التخصصية:
          </p>
        </div>

        {/* FLAGSHIP HERO SPOTLIGHT: BROWSER EXTENSION */}
        <div className="mt-7 rounded-2xl border-2 border-brand/25 bg-gradient-to-br from-surface via-brand-soft/10 to-surface p-6 sm:p-7 shadow-xs hover:border-brand/50 transition-all duration-300">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Left/Copy side */}
            <div className="space-y-3 flex-1 text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-strong text-xs font-bold border border-brand/20">
                <Puzzle className="w-3.5 h-3.5 text-brand" />
                <span>الأداة الأبرز في المنظومة</span>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug">
                إضافة بصيرة للمتصفح: تحقق مباشر أثناء التصفح
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                لا حاجة لنسخ النصوص أو مغادرة صفحتك؛ بمجرد تظليل أي نص والنقر بالزر الأيمن للفأرة، تنبثق بطاقة بصيرة الفورية فوق الصفحة لتعرض توثيق الحديث أو الآية ورابط المصدر المعتمد.
              </p>

              {/* Benefits */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-700">
                <span className="flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-lg border border-line">
                  <MousePointer2 className="w-3.5 h-3.5 text-brand" />
                  تظليل النص في أي موقع
                </span>
                <span className="flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-lg border border-line">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                  بطاقة منبثقة برابط الدرر السنية
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('extension')}
                  className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <span>شاهد المحاكاة الحية للإضافة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <a
                  href="/baseera-extension.zip"
                  download="baseera-extension.zip"
                  className="btn btn-secondary min-h-10 px-4 text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل ملف الإضافة (.zip)</span>
                </a>
              </div>
            </div>

            {/* Right/Visual Preview: Realistic Mini Browser Window Simulation */}
            <div className="w-full lg:w-80 shrink-0">
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-md p-4 space-y-3 relative select-none">
                {/* Mini Chrome Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <span className="font-mono text-[9px] text-slate-500 truncate">al-maktaba.org/post</span>
                  <span className="bg-brand/10 text-brand px-1.5 py-0.5 rounded font-bold text-[9px]">بصيرة</span>
                </div>

                {/* Simulated Article text with selection highlight */}
                <div className="text-[11px] leading-relaxed text-slate-600 font-sans">
                  <span>وجاء في الحديث الشريف: </span>
                  <span className="bg-emerald-200/90 text-emerald-950 font-bold px-1 py-0.5 rounded shadow-2xs">
                    «إنما الأعمال بالنيات وإنما لكل امرئ ما نوى»
                  </span>
                </div>

                {/* Floating Baseera Verified Card */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-right space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      حديث صحيح — متفق عليه
                    </span>
                    <span className="font-mono text-[8px] text-emerald-700">v1.0.0</span>
                  </div>
                  <div className="text-[9px] text-emerald-800">
                    المصدر: الموسوعة الحديثية (الدرر السنية)
                  </div>
                  <div className="pt-1 flex items-center justify-between text-[9px] text-brand font-bold border-t border-emerald-200/60">
                    <span>فتح البطاقة في الدرر السنية</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Supporting 3 Tools Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tool 1 */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-300 hover:border-brand hover:-translate-y-1 hover:shadow-md flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-muted">٠١</span>
                <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <FileSearch className="h-4.5 w-4.5" />
                </div>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">فحص النصوص وتوثيقها</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                تحقق من الآيات والأحاديث والمسائل الفقهية بالرجوع إلى المصادر المعتمدة مع عرض التوثيق وأقوال المذاهب.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verifier')}
              className="mt-4 pt-3 border-t border-line text-xs font-bold text-brand hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              ابدأ الفحص المباشر <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tool 2 */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-300 hover:border-brand hover:-translate-y-1 hover:shadow-md flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-muted">٠٢</span>
                <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <GitCompare className="h-4.5 w-4.5" />
                </div>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">فاحص الفروق اللفظية</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                مقارنة دقيقة كلمة بكلمة مع المصحف المعتمد لكشف أي تبديل أو زيادة أو نقص وضبط الرسم العثماني.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verifier')}
              className="mt-4 pt-3 border-t border-line text-xs font-bold text-brand hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              فحص الفروق اللفظية <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tool 3 */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-300 hover:border-gold hover:-translate-y-1 hover:shadow-md flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-muted">٠٣</span>
                <div className="w-9 h-9 rounded-xl bg-gold-soft text-gold-strong flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">إعداد المحتوى الدعوي</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                صياغة محتوى دعوي مبني على مواد تم التحقق منها وإسنادها إلى مصادرها المعتمدة لحماية المنشورات.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dawah')}
              className="mt-4 pt-3 border-t border-line text-xs font-bold text-gold-strong hover:underline flex items-center gap-1 self-start cursor-pointer"
            >
              فتح استوديو الإعداد <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary Navigation Row for Sources & Governance */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('sources')}
            className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface hover:border-line-strong text-xs font-bold text-ink transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-brand" />
              سجل المصادر والمرجعيات المعتمدة
            </span>
            <ChevronLeft className="h-4 w-4 text-muted" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('governance')}
            className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface hover:border-line-strong text-xs font-bold text-ink transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-gold-strong" />
              بوابة الحوكمة ومعايير قياس الجودة (٣٣ اختبارًا)
            </span>
            <ChevronLeft className="h-4 w-4 text-muted" />
          </button>
        </div>
      </section>

      {/* 5. FINAL SIMPLE CALL TO ACTION */}
      <section className="max-w-4xl mx-auto px-4 pt-6 pb-14 text-center">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
          <div className="mb-2">
            <span className="font-display text-xs font-bold text-brand uppercase tracking-wider">
              المصدر أولًا
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
            التحقق بالمصدر والدليل أولًا قبل النشر
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted max-w-lg mx-auto">
            افحص أي آية أو حديث أو مسألة فقهية، وتأكد من مصدرها المعتمد والدليل القابل للتتبع قبل النشر والمشاركة.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('verifier')}
              className="btn btn-primary min-h-11 px-6 text-sm font-bold shadow-sm"
            >
              <ShieldCheck className="h-4.5 w-4.5" /> ابدأ الفحص المباشر
            </button>
            <button
              type="button"
              onClick={() => onNavigate('sources')}
              className="btn btn-secondary min-h-11 px-5 text-sm font-bold"
            >
              استعراض المصادر المعتمدة
            </button>
          </div>
        </div>

        <div className="mt-6 text-xs text-faint">
          بصيرة · للتحقق من المحتوى الإسلامي
        </div>
      </section>
    </div>
  );
};