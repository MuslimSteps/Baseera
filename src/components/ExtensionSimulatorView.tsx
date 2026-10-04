/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  MousePointer,
  ImageIcon,
  Sparkles,
  FileText
} from 'lucide-react';
import { VerificationResult } from '../types/baseera.ts';
import { verifySingleItemCrossSource } from '../lib/decisionEngine.ts';
import { extractItemsRuleBased } from '../lib/extractor.ts';

export const ExtensionSimulatorView: React.FC = () => {
  const [selectedWord, setSelectedWord] = useState<string>('قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم');
  const [customLookup, setCustomLookup] = useState<string>('');
  const [showSimDetails, setShowSimDetails] = useState(false);
  const [isImageVerification, setIsImageVerification] = useState(false);
  const [extractedOcrText, setExtractedOcrText] = useState<string>('');
  const [showOcrText, setShowOcrText] = useState(false);

  const [activeVerification, setActiveVerification] = useState<VerificationResult | null>(() => {
    const items = extractItemsRuleBased('قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم');
    return verifySingleItemCrossSource(items[0] || {
      type: 'hadith',
      text: 'طلب العلم فريضة على كل مسلم',
      context: 'قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم',
      language: 'ar',
      confidence: 0.95
    });
  });

  const [loadingSim, setLoadingSim] = useState(false);

  const handleSimulateSelection = async (text: string, context: string = '') => {
    setSelectedWord(text);
    setIsImageVerification(false);
    setShowSimDetails(false);
    setShowOcrText(false);
    setLoadingSim(true);

    try {
      const res = await fetch('/api/extension-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context })
      });
      const data = await res.json();
      if (data?.report) {
        setActiveVerification(data.report);
        setLoadingSim(false);
        return;
      }
    } catch {
      // Fallback to client-side verification
    }

    const items = extractItemsRuleBased(text.length > 5 && !context ? `ورد: ${text}` : (context || text));
    if (items.length > 0) {
      setActiveVerification(verifySingleItemCrossSource(items[0]));
    } else {
      setActiveVerification(verifySingleItemCrossSource({
        type: 'claim',
        text: text,
        context: context || text,
        language: /[a-zA-Z]/.test(text) ? 'en' : 'ar',
        confidence: 0.85
      }));
    }
    setLoadingSim(false);
  };

  const handleSimulateImage = async (imageText: string, contextTitle: string) => {
    setSelectedWord(contextTitle);
    setIsImageVerification(true);
    setExtractedOcrText(imageText);
    setShowSimDetails(false);
    setShowOcrText(false);
    setLoadingSim(true);

    try {
      const res = await fetch('/api/extension-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: imageText, context: imageText })
      });
      const data = await res.json();
      if (data?.report) {
        setActiveVerification(data.report);
        setLoadingSim(false);
        return;
      }
    } catch {
      // Fallback
    }

    const items = extractItemsRuleBased(imageText);
    if (items.length > 0) {
      setActiveVerification(verifySingleItemCrossSource(items[0]));
    }
    setLoadingSim(false);
  };

  const handleCustomLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLookup.trim()) return;
    handleSimulateSelection(customLookup.trim(), '');
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Editorial Header */}
      <div className="bento-card bento-card--gold bento-accent-top p-6 sm:p-8 reveal">
        <div className="flex items-center gap-2 text-xs mb-3">
          <span>واجهة القارئ والباحث (Reader & Researcher Layer)</span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span>Chrome & Edge Extension</span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span className="text-gold font-medium">Manifest V3</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display text-ink tracking-tight">
              إضافة المتصفح — بصيرة للقارئ والمعرّف بالإسلام
            </h1>
            <p className="text-sm text-muted mt-3 max-w-3xl leading-relaxed">
              تتيح للقارئ والباحث فحص أي نص أو حديث أثناء تصفح المواقع بمجرد تظليله، أو فحص صور الأحاديث على فيسبوك وتويتر بالنقر بزر الفأرة الأيمن (Right Click Image OCR) والربط المباشر بموسوعة الدرر السنية.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <a
              href="/baseera-extension.zip"
              download="baseera-extension.zip"
              className="px-5 py-2.5 rounded-xl bg-gold-strong hover:bg-[#c96a12] font-semibold text-white shadow-md shadow-black/40 flex items-center gap-2 transition-all cursor-pointer text-xs active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>تحميل حزمة الإضافة (.ZIP)</span>
            </a>
          </div>
        </div>

        {/* 4-Step Quick Install Bar */}
        <div className="mt-6 pt-5 border-t border-hairline grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bento-card border border-hairline">
            <strong className="text-gold block mb-1">1. فك ضغط الملف</strong>
            <p className="text-muted leading-normal">
              حمّل ملف <code className="text-ink/85">baseera-extension.zip</code> وفك ضغطه في أي مجلد على حاسوبك.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bento-card border border-hairline">
            <strong className="text-gold block mb-1">2. صفحة الإضافات</strong>
            <p className="text-muted leading-normal">
              افتح المتصفح واكتب في شريط العنوان: <code className="text-emerald-300">chrome://extensions</code>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bento-card border border-hairline">
            <strong className="text-gold block mb-1">3. وضع المطوّر</strong>
            <p className="text-muted leading-normal">
              فعّل مفتاح <strong>Developer mode</strong> في الزاوية العلوية للمتصفح.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bento-card border border-hairline">
            <strong className="text-gold block mb-1">4. تحميل الإضافة</strong>
            <p className="text-muted leading-normal">
              اضغط <strong>Load unpacked</strong> واختر المجلد المفكوك لتظهر إضافة بصيرة فورياً!
            </p>
          </div>
        </div>
      </div>

      {/* Simulator Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Simulated Web Article Page (7 cols) */}
        <div className="lg:col-span-7 bento-card border border-hairline p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="text-xs text-faint font-mono ml-2">https://social-web-feed.org/post</span>
            </div>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <MousePointer className="w-3.5 h-3.5" />
              انقر على أي نص أو صورة لاختبار الفحص
            </span>
          </div>

          {/* Article & Social Mockup */}
          <div className="space-y-4 text-sm text-ink/85 leading-relaxed font-sans">
            <h2 className="text-xl font-bold font-display text-ink">
              1. نصوص المنشورات (تحديد النص → زر عائم 🔎 تحقّق ببصيرة):
            </h2>

            <div className="p-4 rounded-xl bg-black/30 border border-hairline space-y-3 font-amiri text-lg">
              <p className="leading-relaxed">
                حديث طلب العلم المشتهر وتخريجه في الدرر السنية:{' '}
                <button
                  onClick={() => handleSimulateSelection('طلب العلم فريضة على كل مسلم', 'قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم')}
                  className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold hover:bg-emerald-900 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم»
                </button>
              </p>

              <p className="leading-relaxed">
                ومن الأحاديث الضعيفة المنتشرة بكثرة:{' '}
                <button
                  onClick={() => handleSimulateSelection('الجنة تحت أقدام الأمهات', 'حديث: الجنة تحت أقدام الأمهات')}
                  className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold hover:bg-amber-900 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «الجنة تحت أقدام الأمهات»
                </button>{' '}
                وحديث:{' '}
                <button
                  onClick={() => handleSimulateSelection('حب الوطن من الإيمان')}
                  className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold hover:bg-rose-900 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «حب الوطن من الإيمان»
                </button>
              </p>

              <p className="leading-relaxed">
                بينما الحديث الثابت في الصحيحين:{' '}
                <button
                  onClick={() => handleSimulateSelection('إنما الأعمال بالنيات وإنما لكل امرئ ما نوى')}
                  className="px-2 py-0.5 rounded bg-gold/15 text-gold-soft border border-gold/40 font-bold hover:bg-gold/20 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»
                </button>
              </p>
            </div>

            {/* Social Post Image Mockup */}
            <div className="pt-2">
              <h2 className="text-xl font-bold font-display text-ink mb-2">
                2. عندما يكون الحديث داخل صورة (Right Click للصورة → تحقق عبر بصيرة):
              </h2>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-hairline-strong space-y-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    منشور فيسبوك / تويتر يحتوي على صورة حديث:
                  </span>
                  <span className="text-[11px] text-faint">بدون الحاجة لرفع الصورة يدوياً</span>
                </div>

                {/* Simulated Image Box */}
                <div className="relative rounded-xl border border-emerald-500/30 overflow-hidden bg-gradient-to-br from-[#0a101d] to-[#041c14] p-6 text-center shadow-inner group">
                  <div className="space-y-2 py-3">
                    <div className="text-xs text-emerald-400 tracking-wider">بطاقة دعوية مصممة</div>
                    <div className="font-amiri text-2xl font-bold text-amber-200">
                      « قال رسول الله ﷺ: الجنة تحت أقدام الأمهات »
                    </div>
                    <div className="text-xs text-slate-400">تصميم بطاقة دعوية متداولة على الشبكات</div>
                  </div>

                  {/* Floating Action Button on Image */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleSimulateImage('الجنة تحت أقدام الأمهات', 'صورة حديث: الجنة تحت أقدام الأمهات')}
                      className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all cursor-pointer group-hover:scale-105"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>🔎 تحقّق من الصورة عبر بصيرة</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Term Lookup Form */}
          <div className="pt-4 border-t border-hairline">
            <form onSubmit={handleCustomLookup} className="flex items-center gap-2">
              <input
                type="text"
                value={customLookup}
                onChange={(e) => setCustomLookup(e.target.value)}
                placeholder="أو اكتب أي حديث أو نص لفحصه فورا بالإضافة..."
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-hairline-strong text-xs text-ink placeholder:text-faint focus:outline-none focus:border-gold font-amiri"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gold-strong hover:bg-[#c96a12] text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors"
              >
                فحص فوري
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Pixel-Perfect Browser Extension Popup (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-xs font-semibold text-muted mb-2 self-start flex items-center gap-2">
            <span>النافذة العائمة المصغرة للإضافة (Floating Inline Card):</span>
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
              Shadow DOM
            </span>
          </div>

          {/* Floating Card UI matching exactly what user requested */}
          <div className="w-full max-w-sm rounded-2xl bg-[#090d16] border border-slate-800 p-4 shadow-2xl space-y-3.5">
            {/* Extension Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold text-base">◉</span>
                <h3 className="text-sm font-bold text-emerald-400 leading-tight">بصيرة</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
            </div>

            {/* Context / Preview Box */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className="text-[10px] text-sky-400 block mb-0.5 font-bold">
                {isImageVerification ? 'الصورة المفحوصة (OCR):' : 'النص المحدد:'}
              </span>
              <span className="font-bold text-white text-sm font-amiri leading-normal">«{selectedWord}»</span>
            </div>

            {/* Loading Spinner */}
            {loadingSim && (
              <div className="p-4 text-center text-xs text-slate-400">
                <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin ml-2 align-middle"></span>
                جارٍ التحقق من المراجع المعتمدة (الدرر السنية)...
              </div>
            )}

            {/* Direct Instant Verdict */}
            {!loadingSim && activeVerification && (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border ${
                  activeVerification.status === 'MATCHED'
                    ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-300'
                    : activeVerification.status === 'NEEDS_REVIEW'
                    ? 'bg-amber-950/50 border-amber-600/60 text-amber-300'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300'
                } space-y-1.5`}>
                  <div className="text-sm font-bold font-display leading-snug flex items-center gap-1.5">
                    {!/^[✓⚠️⛔❓✅📖]/.test(activeVerification.status_label_ar) && (
                      <span>{activeVerification.status === 'MATCHED' ? '✓' : activeVerification.status === 'NEEDS_REVIEW' ? '⚠️' : '❓'}</span>
                    )}
                    <span>{activeVerification.status_label_ar}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                    <strong>المصدر المفحوص:</strong> {activeVerification.citation?.source_name || 'الدرر السنية'}
                  </div>
                </div>

                {/* Canonical Text if different or confirmed */}
                {activeVerification.canonical_text && (
                  <div className="p-2.5 rounded-lg bg-black/40 border-r-4 border-emerald-500 text-xs space-y-1">
                    <span className="text-[10px] font-semibold text-emerald-400 block">الحكم / النص المعتمد:</span>
                    <p className="font-amiri text-sm text-emerald-100 leading-relaxed">
                      «{activeVerification.canonical_text.slice(0, 300)}»
                    </p>
                  </div>
                )}

                {/* Action Buttons: [عرض الدليل] and [النص المستخرج] */}
                <div className="flex gap-2 pt-1">
                  {activeVerification.citation?.url && (
                    <a
                      href={activeVerification.citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <span>عرض الدليل</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {isImageVerification && (
                    <button
                      onClick={() => setShowOcrText(!showOcrText)}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>النص المستخرج</span>
                    </button>
                  )}
                </div>

                {/* Collapsible Extracted OCR Text */}
                {showOcrText && extractedOcrText && (
                  <div className="p-2.5 rounded-lg bg-black/50 border border-slate-700 text-xs text-slate-300 leading-relaxed">
                    <strong className="text-sky-400 block mb-1">النص المقروء من الصورة بالذكاء الاصطناعي:</strong>
                    <p className="font-amiri text-sm text-slate-200">«{extractedOcrText}»</p>
                  </div>
                )}

                {/* Expand Details Toggle */}
                <button
                  onClick={() => setShowSimDetails(!showSimDetails)}
                  className="w-full text-center text-[11px] text-slate-400 hover:text-white transition-colors pt-1 cursor-pointer"
                >
                  {showSimDetails ? '▲ إخفاء البيان والتفاصيل' : '▼ تفاصيل التخريج والبيان'}
                </button>

                {showSimDetails && (
                  <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
                    <p>{activeVerification.reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
