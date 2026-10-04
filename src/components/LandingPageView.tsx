/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * صفحة الهبوط الاستراتيجية لمنظومة بصيرة — Baseera Strategic Landing Page
 * مصممة وفق أحدث ممارسات UI/UX Pro Max (Bento Grid, Interactive Hero Showcase,
 * Islamic Scholarly Typography, Zero-Hallucination Trust Architecture)
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  BookOpen,
  Layers,
  Award,
  Scale,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Globe,
  FileText,
  Video,
  Share2,
  Cpu,
  Compass,
  Check,
  X,
  ExternalLink,
  ChevronLeft,
  Flame,
  MousePointer,
  HelpCircle,
  Copy
} from 'lucide-react';
import { TabId } from './Sidebar.tsx';

interface LandingPageViewProps {
  onNavigate: (tab: TabId) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => {
  // Interactive Hero Showcase state
  const [activeHeroTab, setActiveHeroTab] = useState<'khutba' | 'hadith' | 'article' | 'extension'>('khutba');

  return (
    <div className="relative overflow-hidden bg-[#F8FAFC] text-slate-900 pb-20">

      {/* Decorative Islamic Geometric Pattern Watermark (Subtle & Elegant) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.035]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="islamic-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M40 0 L80 40 L40 80 L0 40 Z" fill="none" stroke="#1E3A5F" strokeWidth="1" />
              <circle cx="40" cy="40" r="15" fill="none" stroke="#B45309" strokeWidth="1" />
              <path d="M40 10 L40 70 M10 40 L70 40" stroke="#1E3A5F" strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamic-grid)" />
        </svg>
      </div>

      {/* Ambient Radial Gradient Backdrops */}
      <div className="pointer-events-none absolute -top-40 right-1/2 translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-amber-100/40 via-blue-50/30 to-transparent blur-3xl -z-10" />

      {/* ─────────────────────────────────────────────────────────────
          1. HERO HEADER: Grand Title & Strategic Value Proposition
          ───────────────────────────────────────────────────────────── */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 text-center">
        
        {/* Challenge Track Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-amber-200/80 shadow-sm text-xs font-semibold text-[#1E3A5F] mb-6 reveal">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي</span>
          <span className="text-slate-300">|</span>
          <span className="text-amber-700 font-bold">المسار الرابع · فئة النماذج الذكية</span>
        </div>

        {/* Grand Strategic Headline */}
        <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.25] tracking-tight max-w-4xl mx-auto">
          المنظومة المرجعية الذكية
          <br />
          <span className="gradient-text bg-gradient-to-r from-[#1E3A5F] via-amber-700 to-[#1E3A5F] bg-clip-text text-transparent">
            لحماية وتوليد المحتوى الإسلامي
          </span>
        </h1>

        {/* Sub-headline covering Sermons, Articles, Verification, and Extension */}
        <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          <strong className="text-slate-900 font-semibold">«النموذج يستخرج ويصيغ، والمصادر المعتمدة حصراً تحكم وتوثق».</strong>
          <br className="hidden sm:inline" />
          وداعاً للهلوسة في علوم الشريعة — تدقيق فوري للآيات والأحاديث، إعداد موثّق لخطب الجمعة والمقالات، وفحص عائم للمنشورات عبر إضافة المتصفح.
        </p>

        {/* Primary Call to Action Bar */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <button
            onClick={() => onNavigate('verifier')}
            className="px-7 py-3.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-xl transition-all flex items-center gap-2.5 active:scale-[0.98] cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <span>ابدأ فحص المحتوى الشرعي</span>
          </button>

          <button
            onClick={() => onNavigate('dawah')}
            className="px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-300 text-slate-800 text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2.5 active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-amber-600" />
            <span>استوديو إعداد الخطب والمقالات</span>
          </button>

          <button
            onClick={() => onNavigate('extension')}
            className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Layers className="w-4.5 h-4.5 text-[#1E3A5F]" />
            <span>محاكي إضافة المتصفح</span>
          </button>
        </div>

        {/* Trust Badges Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium pt-4 border-t border-slate-200/60 max-w-2xl mx-auto">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>المصحف بالرسم العثماني</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>الموسوعة الحديثية (الدرر السنية)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>موسوعة الجمهرة للمصطلحات</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>معدل هلوسة صفرية (FCR = 0.0%)</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. INTERACTIVE HERO SHOWCASE: Live Interactive Demos
          ───────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          
          {/* Showcase Header & Tab Switcher */}
          <div className="bg-slate-50/90 border-b border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="mr-3 text-xs font-bold text-slate-700 font-mono">
                محاكاة حيّة لمنظومة بصيرة · Live Engine Simulation
              </span>
            </div>

            {/* Interactive Showcase Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setActiveHeroTab('khutba')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeHeroTab === 'khutba'
                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>إعداد خطبة منبرية</span>
              </button>

              <button
                onClick={() => setActiveHeroTab('hadith')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeHeroTab === 'hadith'
                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>كشف حديث ضعيف</span>
              </button>

              <button
                onClick={() => setActiveHeroTab('article')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeHeroTab === 'article'
                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>تدقيق مقال دعوي</span>
              </button>

              <button
                onClick={() => setActiveHeroTab('extension')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeHeroTab === 'extension'
                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>إضافة المتصفح (Hover)</span>
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="p-6 sm:p-8">
            
            {/* ── TAB 1: KHUTBAH GENERATION & AUDIT ── */}
            {activeHeroTab === 'khutba' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">
                      نموذج مخرجات استوديو الخطب الدعوي
                    </span>
                    <h3 className="text-xl font-bold font-display text-slate-900">
                      خطبة جمعة: «بر الوالدين وحقهما العظيم في الإسلام»
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-matched">3 أحاديث صحيحة موثقة</span>
                    <span className="badge badge-gold">آيتان بالرسم العثماني</span>
                    <span className="badge badge-danger">استبعاد رواية ضعيفة</span>
                  </div>
                </div>

                {/* Excerpt of the sermon with live verification indicators */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4 font-naskh text-base leading-loose text-slate-800">
                  <p>
                    الحمد لله الذي وصى بالإحسان إلى الوالدين وقضى، فقال سبحانه وتعالى في محكم التنزيل:{' '}
                    <span className="bg-emerald-100/80 text-emerald-900 px-2 py-0.5 rounded-md font-semibold border border-emerald-300">
                      «وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا» [الإسراء: 23]
                    </span>
                    ... عباد الله، إن حق الوالدين قرنه الله بالتوحيد في مواضع شتى.
                  </p>

                  <p>
                    وقد سأل رجلٌ النبيَّ ﷺ فقال: يا رسول الله، من أحق الناس بحسن صحابتي؟ فقال ﷺ:{' '}
                    <span className="bg-emerald-100/80 text-emerald-900 px-2 py-0.5 rounded-md font-semibold border border-emerald-300">
                      «أمك، قال: ثم من؟ قال: ثم أمك، قال: ثم من؟ قال: ثم أمك، قال: ثم من؟ قال: ثم أبوك»
                    </span>{' '}
                    <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      صحيح البخاري: 5971 ✓
                    </span>
                  </p>

                  {/* Flagged and filtered weak narration alert */}
                  <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 flex items-start gap-3 text-xs font-sans text-amber-900">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">
                        حماية المنبر من الروايات غير الثابتة:
                      </strong>
                      <span>
                        تم استبعاد حديث مشتهر: «الجنة تحت أقدام الأمهات» لأن لفظه ضعيف عند المحدثين (ابن عدي والألباني)، واستُبدل باللفظ الصحيح الثابت في سنن النسائي وأحمد: «الزم رِجْلَها فَثَمَّ الجَنَّةُ» بسند حسن صحيح.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct CTA */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    استوديو بصيرة يتيح توليد الخطبة، المقال الدعوي، سكريبت الريلز، والإنفوجرافيك بدقة شرعية 100%.
                  </span>
                  <button
                    onClick={() => onNavigate('dawah')}
                    className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>فتح استوديو الخطب والمقالات</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB 2: HADITH VERIFICATION ── */}
            {activeHeroTab === 'hadith' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
                      محطة التحقق المرجعي الفوري
                    </span>
                    <h3 className="text-xl font-bold font-display text-slate-900">
                      فحص الأحاديث الشائعة والمكذوبة والموضوعة
                    </h3>
                  </div>
                  <span className="badge badge-danger">كشف حديث منكر / موضوع</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Input claim */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 block mb-2">النص المفحوص:</span>
                    <p className="font-naskh text-lg text-slate-900 font-semibold mb-3">
                      «قال رسول الله ﷺ: اطلبوا العلم ولو بالصين»
                    </p>
                    <p className="text-xs text-slate-500">
                      سياق الفحص: مقال منتشر على وسائل التواصل ينسب المقولة للنبي ﷺ.
                    </p>
                  </div>

                  {/* Engine verdict */}
                  <div className="bg-red-50/70 rounded-2xl p-5 border border-red-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-700">الحكم المعتمد (الدرر السنية):</span>
                      <span className="badge badge-danger font-bold">باطل لا أصل له / ضعيف جداً</span>
                    </div>
                    <p className="text-xs text-red-900 leading-relaxed font-sans">
                      <strong>خلاصة حكم المحدثين:</strong> أخرجه البيهقي في شعب الإيمان وابن عدي في الكامل. قال ابن حبان: «باطل لا أصل له»، وقال الألباني في السلسلة الضعيفة (416): «موضوع».
                    </p>
                    <div className="pt-2 border-t border-red-200/80 text-xs text-slate-700">
                      <strong>البديل الصحيح الموثق:</strong> «طلبُ العِلمِ فريضةٌ على كلِّ مسلِمٍ» [صحيح الجامع: 3913].
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    بصيرة تفحص الأحاديث عبر الربط المباشر بالموسوعة الحديثية بالدرر السنية بدون تدخل أو اجتهاد من النموذج.
                  </span>
                  <button
                    onClick={() => onNavigate('verifier')}
                    className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>تجربة فحص نص أو حديث</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB 3: ARTICLE & TERMINOLOGY AUDIT ── */}
            {activeHeroTab === 'article' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">
                      ضبط المصطلحات الشرعية وموسوعة الجمهرة
                    </span>
                    <h3 className="text-xl font-bold font-display text-slate-900">
                      كشف اختزال المفاهيم الكبرى والتحريف المعنوي
                    </h3>
                  </div>
                  <span className="badge badge-refer">حماية المصطلحات والمفاهيم</span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="text-xs text-slate-500 font-semibold">المفهوم المرصود في مقال دعوي غربي:</div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-700">
                    "Sharia in Islam exclusively refers to harsh medieval penal codes and corporal punishments."
                  </div>

                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">الحكم المعتمد (موسوعة الجمهرة للمصطلحات):</span>
                      <span className="badge badge-refer font-bold">اختزال مخل وتشويه اصطلاحي</span>
                    </div>
                    <p className="text-xs text-indigo-950 leading-relaxed">
                      <strong>التعريف الشرعي المنضبط:</strong> الشريعة في الاصطلاح الشرعي هي ما شرعه الله لعباده من الأحكام الاعتقادية، والأخلاقية، والعملية (العبادات والمعاملات) لتحقيق مصالح الدارين ودرء المفاسد. حصر الشريعة في العقوبات الجنائية هو اختزال باطل ومخالف للإجماع وموسوعة الجمهرة.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    تدقيق المقالات يحمي المحتوى الدعوي من التحريف المفهومي والشبهات الاستشراقية.
                  </span>
                  <button
                    onClick={() => onNavigate('sources')}
                    className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>استعراض مراجع الجمهرة</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB 4: BROWSER EXTENSION (SOCIAL HOVER) ── */}
            {activeHeroTab === 'extension' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                      إضافة المتصفح الذكية (Chrome Extension)
                    </span>
                    <h3 className="text-xl font-bold font-display text-slate-900">
                      تدقيق المنشورات بالـ Hover والـ Right-Click أثناء التصفح
                    </h3>
                  </div>
                  <span className="badge badge-matched">نافذة Shadow DOM عائمة</span>
                </div>

                {/* Mockup of a Facebook/X Post with Floating Popup */}
                <div className="relative bg-slate-100 rounded-2xl p-6 border border-slate-200">
                  
                  {/* Simulated Social Post */}
                  <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                        م
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">صفحة روائع الحكمة</div>
                        <div className="text-[10px] text-slate-400">منشور مقترح على فيسبوك · منذ ساعتين</div>
                      </div>
                    </div>

                    <p className="text-sm font-naskh text-slate-800 leading-relaxed bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                      قال رسول الله ﷺ: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                      <span>👍 1.2K إعجاب</span>
                      <span>💬 84 تعليق</span>
                    </div>
                  </div>

                  {/* Floating Tooltip Result */}
                  <div className="absolute top-12 left-8 sm:left-16 w-80 bg-white rounded-2xl shadow-2xl border-2 border-emerald-500 p-4 space-y-2.5 z-10 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <span className="w-5 h-5 rounded-md bg-[#1E3A5F] text-white flex items-center justify-center text-[10px]">ب</span>
                        <span>بصيرة · فحص فوري</span>
                      </div>
                      <span className="badge badge-matched text-[10px]">حديث صحيح ✓</span>
                    </div>

                    <p className="text-xs font-naskh text-slate-800 font-medium">
                      «إنما الأعمال بالنيات وإنما لكل امرئ ما نوى...»
                    </p>

                    <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div><strong>الراوي:</strong> عمر بن الخطاب رضي الله عنه</div>
                      <div><strong>المحدث:</strong> البخاري · صحيح البخاري (1)</div>
                      <div><strong>الدرجة:</strong> [صحيح] متفق عليه</div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">المصدر: الدرر السنية</span>
                      <span className="text-[10px] text-[#1E3A5F] font-bold">توثيق معتمد ✓</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    لا حاجة لنسخ النصوص أو فتح مواقع أخرى؛ الإضافة تفحص النص أو الصورة مباشرة بنقرة زر أو مرور الفأرة.
                  </span>
                  <button
                    onClick={() => onNavigate('extension')}
                    className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>تجربة محاكي الإضافة الكامل</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. BENTO BOX GRID: The 4 Strategic Pillars of Baseera
          ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-24">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-amber-700 tracking-wider uppercase block mb-2">
            الهندسة الوظيفية لمنظومة بصيرة
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-slate-900">
            أربعة أركان تكاملية لخدمة المحتوى الإسلامي
          </h2>
          <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">
            من فحص الكلمة المفردة والمخطوطة، إلى إعداد خطب المنابر والمحتوى الرقمي العالمي
          </p>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* TILE 1 (Large - Col Span 8): DAWAH & KHUTBAH STUDIO */}
          <div className="lg:col-span-8 bg-gradient-to-br from-white via-amber-50/30 to-white rounded-3xl border border-amber-200/90 shadow-md hover:shadow-xl transition-all p-7 sm:p-9 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-200 text-amber-800 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-gold">توليد بعد التوثيق الصارم</span>
                  <span className="badge badge-matched">0% أحاديث منكرة</span>
                </div>
              </div>

              <h3 className="font-display text-2xl font-bold text-slate-900 mb-3">
                استوديو إعداد وتدقيق الخطب المنبرية والمقالات الدعوية
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                أول استوديو ذكي مخصص للخطباء والدعاة وصناع المحتوى. يجمع بين <strong>المستودع الدعوي الرقمي (dawa.center)</strong>، ومجمع الملك فهد لترجمات القرآن، والموسوعة الحديثية بالدرر السنية.
              </p>

              {/* Sub-features pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>خطب الجمعة والمقالات الرصينة</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    توليد خطبة منبرية كاملة (مقدمة، أدلة البخاري ومسلم، خاتمة) مع استبعاد تام للأحاديث الضعيفة.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-indigo-600" />
                    <span>سيناريوهات ريلز وبطاقات إنفوجرافيك</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    تحويل الموضوع الدعوي فوراً إلى سكريبت فيديو تيك توك / ريلز بمشاهد موقوتة وبطاقة SVG جاهزة للنشر.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-amber-100">
              <span className="text-xs text-slate-400">
                يدعم اللغات: العربية، الروسية (مسلمي القوقاز وآسيا الوسطى)، والإنجليزية.
              </span>
              <button
                onClick={() => onNavigate('dawah')}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>دخول استوديو الخطب</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* TILE 2 (Col Span 4): ZERO-HALLUCINATION VERIFIER */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-md hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-[#1E3A5F] flex items-center justify-center mb-4 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                محرك التحقق الشرعي الصارم
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                فحص فوري للنصوص، الروابط، الصور (OCR للمخطوطات)، والصوت (STT).
              </p>

              <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>مطابقة حرفية بالرسم العثماني وكشف التصحيف</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>كشف خلط العزو (آية منسوبة كحديث أو العكس)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تخريج فوري من الموسوعة الحديثية بالدرر السنية</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>فحص المسائل الفقهية وأقوال المذاهب الأربعة</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('verifier')}
              className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>فتح فاحص المحتوى</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* TILE 3 (Col Span 4): BROWSER EXTENSION */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-md hover:shadow-xl transition-all p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-4 shadow-inner">
                <Layers className="w-6 h-6" />
              </div>

              <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                إضافة المتصفح اللحظية
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                حماية المستخدمين أثناء تصفح شبكات التواصل الاجتماعي ومواقع الأخبار بنقرة واحدة.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 mb-5">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <MousePointer className="w-4 h-4 text-[#1E3A5F]" />
                  <span>تحديد النص → تدقيق فوري عائم</span>
                </div>
                <div>مرور الفأرة على صور الأحاديث → استخراج النص عبر OCR وعرض الدليل بجانب الصورة دون مغادرة الصفحة.</div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('extension')}
              className="w-full py-2.5 bg-white border border-slate-300 hover:border-[#1E3A5F] text-[#1E3A5F] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>تجربة الإضافة في المتصفح</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* TILE 4 (Col Span 8): GOVERNANCE & ZERO-HALLUCINATION BENCHMARK */}
          <div className="lg:col-span-8 bg-gradient-to-br from-slate-900 to-[#12233f] text-white rounded-3xl shadow-xl p-7 sm:p-9 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 text-amber-300 flex items-center justify-center shadow-inner">
                  <Scale className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                    FCR = 0.0% معدل ادعاءات كاذبة
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 text-xs font-bold">
                    150 حالة اختبار معيارية
                  </span>
                </div>
              </div>

              <h3 className="font-display text-2xl font-bold text-white mb-3">
                ميثاق الحوكمة الصارم وسجل المصادر المعتمدة
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                لا نترك الحكم الديني لنزوات النماذج التوليدية. وضعت بصيرة ميثاقاً شرعياً صارماً يحظر مصادر الفرق المنحرفة والروايات الإسرائيلية والمكذوبة، ويعتمد حصراً المصادر المعتمدة الكبرى.
              </p>

              {/* 3 Pillars strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-xs">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-bold text-emerald-400 mb-1">المستوى 1: قطعي الثبوت</div>
                  <div className="text-slate-300 text-[11px]">المصحف العثماني وصحيحي البخاري ومسلم لا يقبل فيها أي تحريف.</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-bold text-amber-400 mb-1">المستوى 2: اجتهادي معتبر</div>
                  <div className="text-slate-300 text-[11px]">فقه المذاهب الأربعة وأحكام المحدثين بعزو صريح لأصحابها.</div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-bold text-red-400 mb-1">المستوى 3: امتناع وحظر</div>
                  <div className="text-slate-300 text-[11px]">حظر توليد نصوص تُنسب للشارع كذباً، والامتناع عن الفتوى الشخصية.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-xs text-slate-400">
                لوحة قياس حية تضم 150 اختباراً معيارياً لضمان سلامة القرار بنسبة 100%.
              </span>
              <button
                onClick={() => onNavigate('benchmark')}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>استعراض لوحة القياس (150 حالة)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. COMPARISON: General AI vs. Baseera (Why General AI Fails)
          ───────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mb-24">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-amber-700 tracking-wider uppercase block mb-2">
            الفارق الجوهري
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-slate-900">
            لماذا تفشل النماذج العامة (ChatGPT / Gemini) وتنجح بصيرة؟
          </h2>
          <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">
            مقارنة واقعية توضح خطورة الاعتماد على النماذج التوليدية المجردة في نصوص الوحيين
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* General AI Card */}
          <div className="bg-red-50/50 rounded-3xl border border-red-200 p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-red-200/80">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                <X className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-red-900 text-base">النماذج اللغوية العامة (التقليدية)</h3>
                <span className="text-xs text-red-700">ChatGPT · Gemini · Claude بدون قيود مرجعية</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-red-900 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 mt-0.5">✕</span>
                <span><strong>هلوسة في متون الأحاديث:</strong> تأليف ألفاظ لم يقلها النبي ﷺ وتلفيق أسانيد وهمية لمجرد حبك الإجابة.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 mt-0.5">✕</span>
                <span><strong>خلط العزو الفادح:</strong> خلط الآيات بالأحاديث، ونسبة الأحاديث الضعيفة والموضوعة للبخاري ومسلم.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 mt-0.5">✕</span>
                <span><strong>جرأة على الفتوى:</strong> ترجيح أقوال في مسائل النزاع والطلاق دون أهلية علمية، مما يسبب فتناً أسرية.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 mt-0.5">✕</span>
                <span><strong>تشويه المفاهيم:</strong> الاعتماد على مدونات ومصادر مستشرقة تختزل الشريعة وتشوه مصطلحات العقيدة.</span>
              </li>
            </ul>
          </div>

          {/* Baseera Card */}
          <div className="bg-emerald-50/50 rounded-3xl border-2 border-emerald-400 p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-emerald-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-950 text-base">منظومة بصيرة (Baseera Architecture)</h3>
                <span className="text-xs text-emerald-800 font-semibold">استرجاع مرجعي صارم + حوكمة علمية</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-emerald-950 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>صفر هلوسة (FCR 0.0%):</strong> لا يُصدر النموذج أي حكم؛ الحكم يُسترجع حرفياً من الدرر السنية والمصحف العثماني.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>كشف مزدوج لخلط العزو:</strong> خوارزمية دقيقة تفصل بين الآية والحديث وتكشف أي كلمة مبدلة أو رقم عزو خاطئ.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>امتناع وإحالة فقهية:</strong> عرض أقوال المذاهب الأربعة بأمانة والامتناع القطعي عن الإفتاء في النزاعات الشخصية.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>استوديو خطب ومقالات موثق:</strong> توليد سليم شرعياً 100% مستند للمستودع الدعوي مع استبعاد الروايات الضعيفة تلقائياً.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. METRICS STRIP: Validated Dataset & Benchmark
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-200 py-12 mb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="font-display text-3xl sm:text-4xl font-black text-[#1E3A5F]">
                +2,550
              </div>
              <div className="text-xs text-slate-500 font-semibold">حديث ومسألة مفهرسة</div>
            </div>

            <div className="space-y-1">
              <div className="font-display text-3xl sm:text-4xl font-black text-emerald-600">
                0.0%
              </div>
              <div className="text-xs text-slate-500 font-semibold">معدل ادعاءات كاذبة (FCR)</div>
            </div>

            <div className="space-y-1">
              <div className="font-display text-3xl sm:text-4xl font-black text-amber-700">
                150
              </div>
              <div className="text-xs text-slate-500 font-semibold">حالة اختبار معيارية بالكامل</div>
            </div>

            <div className="space-y-1">
              <div className="font-display text-3xl sm:text-4xl font-black text-[#1E3A5F]">
                9
              </div>
              <div className="text-xs text-slate-500 font-semibold">مصادر مرجعية معتمدة حصراً</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FINAL CREATIVE CTA: Ready to Empower Islamic Content
          ───────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="bg-gradient-to-br from-[#1E3A5F] via-[#152a45] to-[#0d1a2d] text-white rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden">
          
          <div className="relative z-10 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center mx-auto border border-white/10">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <h2 className="font-display text-2xl sm:text-4xl font-bold text-white max-w-xl mx-auto leading-snug">
              جاهز لتجهيز خطبتك القادمة، أو تدقيق مقالك، أو حماية متصفحك؟
            </h2>

            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              منظومة بصيرة جاهزة الآن للاستخدام الكامل. اختر الأداة التي تحتاجها وانطلق فوراً بثقة شرعية مطلقة.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onNavigate('verifier')}
                className="px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Search className="w-4.5 h-4.5" />
                <span>فحص وتدقيق نص الآن</span>
              </button>

              <button
                onClick={() => onNavigate('dawah')}
                className="px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4.5 h-4.5 text-amber-300" />
                <span>توليد وتدقيق خطبة جمعة</span>
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
