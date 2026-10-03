/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layers,
  Download,
  Info,
  ExternalLink,
  BookOpen,
  MousePointer,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles
} from 'lucide-react';
import { VerificationResult } from '../types/baseera.ts';
import { verifyIslamicTerm } from '../lib/terminologyEngine.ts';
import { verifyHadith } from '../lib/hadithVerifier.ts';
import { extractItemsRuleBased } from '../lib/extractor.ts';

export const ExtensionSimulatorView: React.FC = () => {
  const [selectedWord, setSelectedWord] = useState<string>('Sharia');
  const [customLookup, setCustomLookup] = useState<string>('');
  const [activeVerification, setActiveVerification] = useState<VerificationResult | null>(() => {
    const items = extractItemsRuleBased('Sharia');
    return verifyIslamicTerm(items[0]);
  });

  const handleSimulateSelection = (text: string, context: string) => {
    setSelectedWord(text);
    const items = extractItemsRuleBased(text);
    if (items.length > 0) {
      if (items[0].type === 'hadith') {
        setActiveVerification(verifyHadith(items[0]));
      } else {
        setActiveVerification(verifyIslamicTerm(items[0]));
      }
    }
  };

  const handleCustomLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLookup.trim()) return;
    handleSimulateSelection(customLookup.trim(), '');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Header */}
      <div className="border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <span>واجهة القارئ والمترجم (Reader Layer)</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>Chrome & Edge Extension</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-emerald-400 font-medium">Manifest V3</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-tajawal text-white tracking-tight">
              إضافة المتصفح — بصيرة للقارئ والمعرّف بالإسلام
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              تتيح للقارئ والباحث والمترجم تظليل أي مصطلح أو حديث أثناء تصفح المقالات والصفحات لرؤية التحقق الفوري وسياقه الشرعي المعتمد في موسوعة الجمهرة دون مغادرة الصفحة.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <a
              href="/baseera-extension.zip"
              download="baseera-extension.zip"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white shadow-md shadow-emerald-950 flex items-center gap-2 transition-all cursor-pointer text-xs active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>تحميل حزمة الإضافة (.ZIP)</span>
            </a>
          </div>
        </div>

        {/* 4-Step Quick Install Bar */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/[0.08]">
            <strong className="text-emerald-400 block mb-1">1. فك ضغط الملف</strong>
            <p className="text-slate-400 leading-normal">
              حمّل ملف <code className="text-slate-300">baseera-extension.zip</code> وفك ضغطه في أي مجلد على حاسوبك.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/[0.08]">
            <strong className="text-emerald-400 block mb-1">2. صفحة الإضافات</strong>
            <p className="text-slate-400 leading-normal">
              افتح المتصفح واكتب في شريط العنوان: <code className="text-emerald-300">chrome://extensions</code>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/[0.08]">
            <strong className="text-emerald-400 block mb-1">3. وضع المطوّر</strong>
            <p className="text-slate-400 leading-normal">
              فعّل مفتاح <strong>Developer mode</strong> في الزاوية العلوية للمتصفح.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/[0.08]">
            <strong className="text-emerald-400 block mb-1">4. تحميل الإضافة</strong>
            <p className="text-slate-400 leading-normal">
              اضغط <strong>Load unpacked</strong> واختر المجلد المفكوك لتظهر أيقونة بصيرة فورياً!
            </p>
          </div>
        </div>
      </div>

      {/* Simulator Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Simulated Web Article Page (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0b101b] border border-white/[0.08] p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="text-xs text-slate-500 font-mono ml-2">https://global-dawah-review.org/article</span>
            </div>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <MousePointer className="w-3.5 h-3.5" />
              انقر على الكلمات لاختبار النافذة
            </span>
          </div>

          {/* Article Mockup */}
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
            <h2 className="text-xl font-bold font-tajawal text-white">
              Understanding Core Islamic Principles in Modern Global Dialogue
            </h2>

            <p className="leading-relaxed">
              In contemporary discussions, introducing Islamic terminology to an international audience requires deep accuracy. For instance,{' '}
              <button
                onClick={() => handleSimulateSelection('Tawhid', 'Tawhid in Islam is monotheism')}
                className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                Tawhid
              </button>{' '}
              is the central cornerstone of Islam, and must never be reduced to a detached deistic concept without worship requirements.
            </p>

            <p className="leading-relaxed">
              Similarly, many media outlets mistakenly equate{' '}
              <button
                onClick={() => handleSimulateSelection('Sharia', 'reducing Sharia to penal law and punishments')}
                className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold hover:bg-amber-900 transition-colors cursor-pointer"
              >
                Sharia
              </button>{' '}
              merely with penal laws and criminal punishments, ignoring that its overarching purpose is justice, mercy, human dignity, and the protection of the five necessities.
            </p>

            <p className="leading-relaxed">
              Regarding universal ethics, the Prophet Muhammad ﷺ emphasized benevolence, stating:{' '}
              <button
                onClick={() => handleSimulateSelection('الراحمون يرحمهم الرحمن ارحموا من في الأرض', 'حديث الراحمون يرحمهم الرحمن')}
                className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/40 font-amiri text-base hover:bg-sky-900 transition-colors cursor-pointer"
              >
                «الراحمون يرحمهم الرحمن ارحموا من في الأرض يرحمكم من في السماء»
              </button>{' '}
              which represents universal compassion in Islamic teachings.
            </p>

            <p className="leading-relaxed">
              Another widespread error is mistranslating{' '}
              <button
                onClick={() => handleSimulateSelection('Jihad', 'Translating Jihad as Holy War')}
                className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold hover:bg-rose-900 transition-colors cursor-pointer"
              >
                Jihad
              </button>{' '}
              as "Holy War", an alien ecclesiastical concept that distorts its primary meaning of spiritual and ethical striving.
            </p>
          </div>

          {/* Custom Term Lookup Form */}
          <div className="pt-4 border-t border-white/[0.06]">
            <form onSubmit={handleCustomLookup} className="flex items-center gap-2">
              <input
                type="text"
                value={customLookup}
                onChange={(e) => setCustomLookup(e.target.value)}
                placeholder="أو اكتب أي مصطلح لتجربة الإضافة (مثل: Ibadah, Sunnah)..."
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer transition-colors"
              >
                فحص فوري
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Pixel-Perfect Browser Extension Popup (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-xs font-semibold text-slate-400 mb-2 self-start">
            محاكاة النافذة المنبثقة لإضافة المتصفح (Extension Popup):
          </div>

          <div className="w-full max-w-sm rounded-2xl bg-[#080d17] border border-emerald-500/40 p-5 shadow-2xl space-y-4">
            {/* Extension Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                  ب
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">بصيرة — Baseera</h3>
                  <span className="text-[10px] text-emerald-400 block -mt-0.5">طبقة التحقق والسياق</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
            </div>

            {/* Selected Text Box */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] text-xs">
              <span className="text-[10px] text-slate-500 block mb-1">المصطلح / النص المحدد:</span>
              <span className="font-bold text-sky-400 text-sm font-tajawal">{selectedWord}</span>
            </div>

            {/* Live Verification Result */}
            {activeVerification && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{activeVerification.status_label_ar}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {activeVerification.citation?.source_name}
                  </span>
                </div>

                {/* Jamhara / Canonical Meaning */}
                {(activeVerification.jamhara_definition || activeVerification.canonical_text) && (
                  <div className="p-3 rounded-lg bg-black/30 border border-white/[0.06] text-xs text-slate-300 leading-relaxed">
                    <strong className="text-slate-400 block text-[11px] mb-1">المعنى في هذا السياق:</strong>
                    <p>{activeVerification.jamhara_definition || activeVerification.canonical_text}</p>
                  </div>
                )}

                {/* Approved Translation */}
                {activeVerification.verified_translation && (
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.06] text-xs text-slate-400 leading-relaxed font-sans">
                    <strong className="text-slate-300 block mb-0.5">المقابل المعتمد:</strong>
                    <p className="italic">"{activeVerification.verified_translation}"</p>
                  </div>
                )}

                {/* Reduction Alert */}
                {activeVerification.reduction_warning && (
                  <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                    <strong className="text-amber-300 block mb-1">تحذير من تشويه المصطلح:</strong>
                    <p className="text-amber-100/90">{activeVerification.reduction_warning}</p>
                  </div>
                )}

                {/* Official Citation */}
                {activeVerification.citation && (
                  <div className="pt-2 border-t border-white/[0.06] text-[11px] text-slate-500 flex items-center justify-between">
                    <span>المرجع: {activeVerification.citation.source_name}</span>
                    {activeVerification.citation.url && (
                      <a
                        href={activeVerification.citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <span>السند</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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
