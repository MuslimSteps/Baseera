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
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FolderOpen,
  Settings2,
  Puzzle
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
    <div className="page-shell extension-page mx-auto max-w-[1380px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      <section className="extension-hero reveal">
        <div className="extension-hero-copy">
          <div className="extension-badge">
            <Puzzle className="h-4 w-4" aria-hidden="true" />
            إضافة بصيرة للمتصفح
            <span className="extension-badge-meta">Chrome · Edge</span>
          </div>

          <h1 className="extension-hero-title">تحقق أثناء التصفح</h1>
          <p className="extension-hero-text">حدد النص أو الصورة، وتحقق منها دون مغادرة الصفحة.</p>

          <a
            href="/baseera-extension.zip"
            download="baseera-extension.zip"
            className="extension-download"
          >
            <Download className="h-4 w-4" />
            تحميل الإضافة
          </a>
        </div>

        <div className="extension-hero-mark" aria-hidden="true">
          <span className="extension-hero-pattern" />
          <Puzzle className="h-9 w-9" />
          <span>بصيرة</span>
        </div>
      </section>

      <section className="extension-install" aria-label="تثبيت الإضافة">
        <div className="extension-section-head">
          <div>
            <div className="eyebrow">ابدأ في دقيقة</div>
            <h2 className="extension-section-title">ثبّت الإضافة</h2>
          </div>
          <span className="extension-section-note">4 خطوات بسيطة</span>
        </div>

        <div className="extension-install-grid">
          <div className="extension-install-card">
            <div className="extension-step-icon"><Download /></div>
            <div className="extension-step-no">01</div>
            <strong>فك الضغط</strong>
            <p>افتح ملف <code>baseera-extension.zip</code>.</p>
          </div>
          <div className="extension-install-card">
            <div className="extension-step-icon"><FolderOpen /></div>
            <div className="extension-step-no">02</div>
            <strong>افتح الإضافات</strong>
            <p>اكتب <code>chrome://extensions</code>.</p>
          </div>
          <div className="extension-install-card">
            <div className="extension-step-icon"><Settings2 /></div>
            <div className="extension-step-no">03</div>
            <strong>فعّل وضع المطوّر</strong>
            <p>شغّل <strong>Developer mode</strong>.</p>
          </div>
          <div className="extension-install-card">
            <div className="extension-step-icon"><Puzzle /></div>
            <div className="extension-step-no">04</div>
            <strong>أضف بصيرة</strong>
            <p>اختر <strong>Load unpacked</strong> والمجلد.</p>
          </div>
        </div>
      </section>

      {/* Simulator Dual-Column Workspace */}
      <div className="extension-workspace grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Simulated Web Article Page (7 cols) */}
        <div className="extension-browser lg:col-span-7 bento-card">
          <div className="extension-browser-top flex items-center justify-between pb-3 border-b border-hairline">
            <div className="extension-popup-brand flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
              <span />
              <span />
              <span className="extension-browser-url">social-web-feed.org/post</span>
            </div>
            <span className="extension-browser-hint text-xs flex items-center gap-1">
              <MousePointer className="w-3.5 h-3.5" />
              حدّد نصًا
            </span>
          </div>

          {/* Article & Social Mockup */}
          <div className="extension-browser-content space-y-4">
            <h2 className="extension-demo-title text-xl font-bold font-display text-ink">
              حدّد نصًا لفحصه
            </h2>

            <div className="extension-quote p-4 rounded-xl bg-page border border-hairline space-y-3 font-amiri text-lg">
              <p className="leading-relaxed">
                حديث طلب العلم المشتهر وتخريجه في الدرر السنية:{' '}
                <button
                  onClick={() => handleSimulateSelection('طلب العلم فريضة على كل مسلم', 'قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم')}
                  className="px-2 py-0.5 rounded extension-quote-good font-bold hover:bg-emerald-900 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «قال رسول الله ﷺ: طلب العلم فريضة على كل مسلم»
                </button>
              </p>

              <p className="leading-relaxed">
                ومن الأحاديث الضعيفة المنتشرة بكثرة:{' '}
                <button
                  onClick={() => handleSimulateSelection('الجنة تحت أقدام الأمهات', 'حديث: الجنة تحت أقدام الأمهات')}
                  className="px-2 py-0.5 rounded extension-quote-review font-bold hover:bg-amber-900 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «الجنة تحت أقدام الأمهات»
                </button>{' '}
                وحديث:{' '}
                <button
                  onClick={() => handleSimulateSelection('حب الوطن من الإيمان')}
                  className="px-2 py-0.5 rounded extension-quote-question font-bold hover:bg-rose-900 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «حب الوطن من الإيمان»
                </button>
              </p>

              <p className="leading-relaxed">
                بينما الحديث الثابت في الصحيحين:{' '}
                <button
                  onClick={() => handleSimulateSelection('إنما الأعمال بالنيات وإنما لكل امرئ ما نوى')}
                  className="px-2 py-0.5 rounded extension-quote-confirmed font-bold hover:bg-gold/20 transition-colors cursor-pointer"
                  title="انقر لتجربة الفحص الفوري"
                >
                  «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»
                </button>
              </p>
            </div>

            {/* Social Post Image Mockup */}
            <div className="pt-2">
              <h2 className="text-xl font-bold font-display text-ink mb-2">
                أو افحص النص داخل صورة
              </h2>

              <div className="extension-image-demo p-4 rounded-xl border border-hairline-strong space-y-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-brand" />
                    منشور فيسبوك / تويتر يحتوي على صورة حديث:
                  </span>
                  <span className="text-[11px] text-faint">دون الحاجة إلى رفع الصورة يدويًا</span>
                </div>

                {/* Simulated Image Box */}
                <div className="extension-image-card relative rounded-xl border overflow-hidden p-6 text-center group">
                  <div className="extension-image-copy space-y-2 py-3">
                    <div className="text-xs text-brand tracking-wider">بطاقة دعوية مصممة</div>
                    <div className="font-amiri text-2xl font-bold text-amber-200">
                      « قال رسول الله ﷺ: الجنة تحت أقدام الأمهات »
                    </div>
                    <div className="text-xs text-muted">تصميم بطاقة دعوية متداولة على الشبكات</div>
                  </div>

                  {/* Floating Action Button on Image */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleSimulateImage('الجنة تحت أقدام الأمهات', 'صورة حديث: الجنة تحت أقدام الأمهات')}
                      className="extension-image-action px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تحقق من الصورة</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Term Lookup Form */}
          <div className="extension-custom pt-4 border-t border-hairline">
            <form onSubmit={handleCustomLookup} className="flex items-center gap-2">
              <input
                type="text"
                value={customLookup}
                onChange={(e) => setCustomLookup(e.target.value)}
                placeholder="ألصق نصًا للتجربة"
                className="extension-custom-input w-full px-3 py-2 rounded-lg bg-page border border-hairline-strong text-xs text-ink placeholder:text-faint focus:outline-none focus:border-gold font-amiri"
              />
              <button
                type="submit"
                className="extension-custom-button px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                تحقق الآن
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Pixel-Perfect Browser Extension Popup (5 cols) */}
        <div className="extension-preview lg:col-span-5 flex flex-col items-center">
          <div className="extension-preview-label text-xs font-semibold text-muted mb-2 self-start flex items-center gap-2">
            <span>معاينة الإضافة</span>
            <span className="extension-preview-chip text-[10px] px-1.5 py-0.5 rounded font-mono">
              نافذة مدمجة
            </span>
          </div>

          {/* Floating Card UI matching exactly what user requested */}
          <div className="extension-popup extension-popup-card w-full max-w-sm rounded-2xl p-4">
            {/* Extension Header */}
            <div className="extension-popup-head flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <span className="extension-popup-logo"><Puzzle className="h-3.5 w-3.5" /></span>
                <h3 className="text-sm font-bold">بصيرة</h3>
              </div>
              <span className="extension-popup-version text-[10px] font-mono">v1.0.0</span>
            </div>

            {/* Context / Preview Box */}
            <div className="extension-popup-context p-2.5 rounded-lg text-xs">
              <span className="text-[10px] block mb-0.5 font-bold">
                {isImageVerification ? 'الصورة المفحوصة (OCR):' : 'النص المحدد:'}
              </span>
              <span className="font-bold text-sm font-amiri leading-normal">«{selectedWord}»</span>
            </div>

            {/* Loading Spinner */}
            {loadingSim && (
              <div className="extension-popup-loading p-4 text-center text-xs">
                <span className="extension-spinner inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ml-2 align-middle"></span>
                جارٍ التحقق…
              </div>
            )}

            {/* Direct Instant Verdict */}
            {!loadingSim && activeVerification && (
              <div className="space-y-3">
                <div className={`extension-status p-3 rounded-xl border ${
                  activeVerification.status === 'MATCHED'
                    ? 'extension-status-matched'
                    : activeVerification.status === 'NEEDS_REVIEW'
                    ? 'extension-status-review'
                    : 'extension-status-unknown'
                } space-y-1.5`}>
                  <div className="text-sm font-bold font-display leading-snug flex items-center gap-1.5">
                    {activeVerification.status === 'MATCHED'
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      : activeVerification.status === 'NEEDS_REVIEW'
                        ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        : <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <span>{activeVerification.status_label_ar}</span>
                  </div>
                  <div className="extension-popup-source text-[11px] pt-1 border-t">
                    <strong>المصدر:</strong> {activeVerification.citation?.source_name || 'الدرر السنية'}
                  </div>
                </div>

                {/* Canonical Text if different or confirmed */}
                {activeVerification.canonical_text && (
                  <div className="extension-popup-evidence p-2.5 rounded-lg text-xs space-y-1">
                    <span className="text-[10px] font-semibold block">الدليل المعتمد:</span>
                    <p className="font-amiri text-sm leading-relaxed">
                      «{activeVerification.canonical_text.slice(0, 300)}»
                    </p>
                  </div>
                )}

                {/* Action Buttons: [عرض الدليل] and [النص المستخرج] */}
                <div className="extension-popup-actions flex gap-2 pt-1">
                  {activeVerification.citation?.url && (
                    <a
                      href={activeVerification.citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="extension-popup-primary flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>عرض الدليل</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {isImageVerification && (
                    <button
                      onClick={() => setShowOcrText(!showOcrText)}
                      className="extension-popup-secondary py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>النص المستخرج</span>
                    </button>
                  )}
                </div>

                {/* Collapsible Extracted OCR Text */}
                {showOcrText && extractedOcrText && (
                  <div className="extension-popup-ocr p-2.5 rounded-lg text-xs leading-relaxed">
                    <strong className="block mb-1">النص المقروء من الصورة بالذكاء الاصطناعي:</strong>
                    <p className="font-amiri text-sm">«{extractedOcrText}»</p>
                  </div>
                )}

                {/* Expand Details Toggle */}
                <button
                  onClick={() => setShowSimDetails(!showSimDetails)}
                  className="extension-popup-details w-full text-center text-[11px] pt-1 cursor-pointer"
                >
                  {showSimDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                </button>

                {showSimDetails && (
                  <div className="extension-popup-reason p-2.5 rounded-lg text-xs leading-relaxed space-y-1.5">
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
