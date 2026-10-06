/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * صانع المحتوى الدعوي والخطب المنبرية — Dawah & Khutbah Studio
 *
 * المنظومة الدعوية القائمة على «التوليد بعد التوثيق الصارم»:
 * • المستودع الدعوي الرقمي (dawa.center) للموضوعات
 * • مجمع الملك فهد للآيات وترجماتها (إلمير كولييف للروسية)
 * • الموسوعة الحديثية (الدرر السنية) للأحاديث وأحكامها
 * • موسوعة الجمهرة (islamic-content.com) للمصطلحات الشرعية
 */

import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Globe2,
  Users,
  FileText,
  Download,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Video,
  Image as ImageIcon,
  Share2,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface VerifiedCitation {
  type: 'ayah' | 'hadith' | 'term' | 'tafseer' | 'dawah_center';
  arabic_text: string;
  translation?: string;
  source_name: string;
  source_url: string;
  authority: string;
  grade?: string;
  verified: boolean;
}

interface DawahSection {
  section_key: string;
  section_label_ar: string;
  section_label_translated?: string;
  content_ar: string;
  content_translated?: string;
  citations: VerifiedCitation[];
}

interface VideoScene {
  scene_number: number;
  duration_seconds: string;
  visual_description: string;
  voiceover_ar: string;
  voiceover_translated?: string;
  on_screen_text: string;
}

interface DawahResult {
  content: {
    id: string;
    topic: string;
    contentType: 'khutba_friday' | 'article_dawah' | 'infographic_card';
    language: 'ar' | 'ru' | 'en';
    audience: string;
    title_ar: string;
    title_translated?: string;
    sections: DawahSection[];
    all_citations: VerifiedCitation[];
    dawa_center_url: string;
    feqhia_url?: string;
    generated_at: string;
    verification_note: string;
    infographic_suggestion: string;
    video_reel_script: {
      title: string;
      target_duration: string;
      audio_direction: string;
      free_tools_recommendation: string[];
      scenes: VideoScene[];
    };
  };
  formatted_text: string;
  infographic_svg: string;
  verification_report?: any;
}

const PRESET_TOPICS = [
  { topic: 'الصبر وفضله في الشدائد', category: 'الرقائق والسلوك' },
  { topic: 'التوبة الصادقة وشروطها', category: 'الإيمان والتزكية' },
  { topic: 'بر الوالدين وحقهما العظيم', category: 'الأخلاق والأسرة' },
  { topic: 'التوحيد وأثره في طمأنينة القلب', category: 'العقيدة' },
  { topic: 'الأمانة والصدق في المعاملات', category: 'المعاملات' },
  { topic: 'فضل الصلاة والمحافظة عليها', category: 'العبادات' },
  { topic: 'صلة الرحم وثمارها في الدنيا والآخرة', category: 'الآداب' },
  { topic: 'رحمة النبي ﷺ بالعالمين', category: 'السيرة النبوية' }
];

export const DawahStudioView: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState<'khutba_friday' | 'article_dawah' | 'infographic_card'>('khutba_friday');
  const [language, setLanguage] = useState<'ar' | 'ru' | 'en'>('ar');
  const [audience, setAudience] = useState<'general' | 'youth' | 'revert' | 'non_muslim' | 'scholar'>('general');
  const [additionalContext, setAdditionalContext] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DawahResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'text' | 'infographic' | 'video' | 'citations'>('text');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/dawah/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          contentType,
          language,
          audience,
          additionalContext: additionalContext.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إعداد المحتوى الدعوي.');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بخادم بصيرة.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = () => {
    if (!result?.formatted_text) return;
    navigator.clipboard.writeText(result.formatted_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadText = () => {
    if (!result?.formatted_text) return;
    const blob = new Blob([result.formatted_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseera-${contentType}-${topic.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    if (!result?.infographic_svg) return;
    const blob = new Blob([result.infographic_svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseera-card-${topic.replace(/\s+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-shell mx-auto max-w-[1380px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      {/* ── Banner: Scientific Package Compliance ──────────────────────── */}
      <div className="tool-card p-6 md:p-8 reveal shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="badge badge-brand">
                منظومة الإنتاج والتوثيق الدعوي
              </span>
              <span className="text-xs text-muted font-mono">
                إعداد المحتوى الموثّق
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-ink">
              استوديو إعداد المحتوى الموثّق
            </h1>
            <p className="text-muted text-sm max-w-3xl leading-relaxed">
              ابدأ بالمادة المرجعية، ثم انتقل إلى الصياغة. تُبنى المسودة من مصادر محددة، وتظل الشواهد والمراجع واضحة حتى تتمكن من مراجعتها قبل النشر.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0 text-xs text-muted bg-page p-3.5 rounded-xl border border-line shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>المصدر قبل الصياغة</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-gold" />
              <span>شواهد وترجمات قابلة للمراجعة</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-info" />
              <span>مخرجات جاهزة للنشر وإعادة الاستخدام</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Studio Form & Controls ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Panel */}
        <div className="lg:col-span-1 space-y-6 tool-card p-6 shadow-sm">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>ابدأ من الفكرة</span>
            </h2>

            {/* Topic Input */}
            <div className="space-y-1.5">
              <label htmlFor="dawah-topic" className="text-xs font-bold text-ink block">
                ما الموضوع الذي تريد إعداده؟
              </label>
              <input
                id="dawah-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="اكتب الموضوع هنا (مثلاً: الصبر، بر الوالدين، التوبة...)"
                className="w-full bg-page border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-xl px-4 py-2.5 text-sm font-medium text-ink placeholder:text-muted focus:outline-none transition-all shadow-sm"
              />
            </div>

            {/* Quick Topic Presets */}
            <div className="space-y-2">
              <span className="text-[11px] text-muted block font-medium">أو ابدأ بموضوع مقترح:</span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {PRESET_TOPICS.map((pt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopic(pt.topic)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-all border cursor-pointer ${
                      topic === pt.topic
                        ? 'bg-brand text-white border-brand font-bold shadow-sm'
                        : 'bg-page text-muted border-line hover:text-ink hover:bg-surface hover:border-line-strong'
                    }`}
                  >
                    {pt.topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink block">
                صيغة المحتوى:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'khutba_friday', label: 'خطبة جمعة منبرية (أركان الخطبة)', desc: 'مقدمة الجمعة، الخطبتان، الاستدلال، الدعاء' },
                  { id: 'article_dawah', label: 'مقال دعوي وتوجيهي', desc: 'تأصيل شرعي بالأدلة، تحليل، وثمرات' },
                  { id: 'infographic_card', label: 'بطاقة ومحتوى لشبكات التواصل', desc: 'نصوص مركزة وموجزة للمنصات الرقمية' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setContentType(type.id as any)}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-0.5 cursor-pointer ${
                      contentType === type.id
                        ? 'bg-brand-soft/40 border-brand text-ink shadow-sm ring-1 ring-brand/30'
                        : 'bg-page border-line text-muted hover:text-ink hover:bg-surface'
                    }`}
                  >
                    <span className="text-xs font-bold text-ink">{type.label}</span>
                    <span className="text-[10px] text-muted">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span>لغة المحتوى:</span>
                <span className="text-[10px] text-brand font-bold">ترجمات معتمدة فقط</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ar', label: 'العربية', sub: 'الأصلية' },
                  { id: 'ru', label: 'الروسية', sub: 'إلمير كولييف' },
                  { id: 'en', label: 'الإنجليزية', sub: 'صحيح إنترناشونال' }
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id as any)}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      language === l.id
                        ? 'bg-brand-soft/40 border-brand text-brand-strong font-bold shadow-sm ring-1 ring-brand/30'
                        : 'bg-page border-line text-muted hover:text-ink hover:bg-surface'
                    }`}
                  >
                    <div className="text-xs font-bold">{l.label}</div>
                    <div className="text-[9px] text-muted truncate">{l.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink block">
                الجمهور المستهدف:
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="w-full bg-page border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-xl px-3 py-2.5 text-xs text-ink focus:outline-none transition-all shadow-sm"
              >
                <option value="general">عموم المسلمين في المسجد والحي</option>
                <option value="youth">الشباب والناشئة (أسلوب حيوي مقنع)</option>
                <option value="revert">المسلمون الجدد (تبسيط المفاهيم وضبطها)</option>
                <option value="non_muslim">غير المسلمين (التعريف بمحاسن الإسلام)</option>
                <option value="scholar">طلاب العلم (توسع في الأدلة والتخريج)</option>
              </select>
            </div>

            {/* Additional Guidance */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink block">
                تفاصيل إضافية (اختياري):
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="مثال: التركيز على تطبيق الصبر في بيئة العمل، أو مراعاة المسلمين في المهجر..."
                rows={2}
                className="w-full bg-page border border-line focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-xl p-3 text-xs text-ink placeholder:text-muted focus:outline-none resize-none transition-all shadow-sm"
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold font-display text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-brand hover:bg-brand-strong text-white cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري استرجاع المصادر وتوثيق المسودة...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>توليد وتوثيق المحتوى الدعوي</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3">
              <span>{error}</span>
            </div>
          )}

          {!result && !loading && (
            <div className="tool-card p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-brand-soft border border-brand/20 text-brand-strong flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink">اختر الموضوع وابدأ التوليد الموثق</h3>
                <p className="text-xs text-muted max-w-md mx-auto">
                  سيقوم النظام باستخراج الآيات من مصحف المدينة، والأحاديث الصحيحة من الدرر السنية، والمصطلحات من الجمهرة، وصياغة خطبة أو مقال جاهز للإلقاء مع الترجمة المعتمدة.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTopic('الصبر وفضله في الشدائد');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-page hover:bg-surface text-brand-strong text-xs font-bold border border-line hover:border-brand/30 transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>تجربة موضوع: «الصبر وفضله في الشدائد»</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Header Bar with Action Buttons */}
              <div className="tool-card p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> موثق من المصادر المعتمدة</span>
                    </span>
                    <span className="text-xs text-muted font-mono">
                      {result.content.all_citations.length} أدلة مسترجعة
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-ink font-display">
                    {result.content.title_ar}
                  </h2>
                  {result.content.title_translated && (
                    <p className="text-xs text-muted italic font-mono">
                      {result.content.title_translated}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-page hover:bg-surface text-xs font-semibold text-ink border border-line flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted" />
                    <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadText}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-page hover:bg-surface text-xs font-semibold text-ink border border-line flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-muted" />
                    <span>تنزيل (TXT)</span>
                  </button>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1.5 border-b border-line pb-2 overflow-x-auto">
                {[
                  { id: 'text', label: 'نص الخطبة / المقال', icon: FileText },
                  { id: 'infographic', label: 'بطاقة الإنفوجرافيك (SVG)', icon: ImageIcon },
                  { id: 'video', label: 'سيناريو الفيديو الدعوي (Reel)', icon: Video },
                  { id: 'citations', label: 'سجل المصادر المسترجعة', icon: BookOpen }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeViewTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveViewTab(tab.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-page text-muted hover:text-ink hover:bg-surface border border-line'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Full Draft Text View */}
              {activeViewTab === 'text' && (
                <div className="space-y-4">
                  {result.content.sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="tool-card p-5 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-line pb-2.5">
                        <span className="text-xs font-bold text-brand flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-brand text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span>{sec.section_label_ar}</span>
                        </span>
                        {sec.section_label_translated && (
                          <span className="text-[11px] text-muted italic">
                            {sec.section_label_translated}
                          </span>
                        )}
                      </div>

                      {/* Arabic Text */}
                      <div className="text-ink text-sm leading-relaxed whitespace-pre-line font-ibm bg-page p-4 rounded-xl border border-line">
                        {sec.content_ar}
                      </div>

                      {/* Translated Text if exists */}
                      {sec.content_translated && sec.content_translated !== sec.content_ar && (
                        <div className="mt-3 pt-3 border-t border-line">
                          <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-1">
                            {result.content.language === 'ru' ? 'Официальный перевод (Русский)' : 'Official Translation'}
                          </span>
                          <div className="text-ink/85 text-xs leading-relaxed whitespace-pre-line bg-page p-3.5 rounded-xl border border-line font-sans">
                            {sec.content_translated}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Verification Notice */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed flex items-start gap-3 shadow-sm">
                    <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700 mt-0.5" />
                    <span>{result.content.verification_note}</span>
                  </div>
                </div>
              )}

              {/* Tab 2: Infographic SVG Card View */}
              {activeViewTab === 'infographic' && (
                <div className="space-y-4">
                  <div className="tool-card p-6 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-brand" />
                          <span>بطاقة الإنفوجرافيك التفاعلية (1080 × 1080 بكسل)</span>
                        </h3>
                        <p className="text-xs text-muted">
                          جاهزة للنشر على إنستغرام، واتساب، وتيليجرام بدون أي برامج خارجية
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadSvg}
                        className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>تنزيل البطاقة (SVG)</span>
                      </button>
                    </div>

                    {/* SVG Render Container */}
                    <div className="flex justify-center bg-page p-4 rounded-xl border border-line overflow-hidden">
                      <div
                        className="max-w-[500px] w-full shadow-lg rounded-xl overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: result.infographic_svg }}
                      />
                    </div>

                    {/* Free Design Tools Recommendations */}
                    <div className="p-4 rounded-xl bg-page border border-line space-y-2">
                      <span className="text-xs font-bold text-brand block">
                        أدوات مجانية موصى بها لصناعة الإنفوجرافيك والمحتوى البصري:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink/85">
                        <div className="p-2.5 rounded-lg bg-surface border border-line">
                          <strong className="text-ink">Canva (canva.com):</strong> قوالب إسلامية مجانية جاهزة لمقاس 1080×1080
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface border border-line">
                          <strong className="text-ink">Adobe Express:</strong> تصاميم مجانية مع دعم الخطوط العربية الرسمية
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface border border-line">
                          <strong className="text-ink">Piktochart:</strong> إنفوجرافيك تعليمي ودعوي مجاني
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface border border-line">
                          <strong className="text-ink">Crello / VistaCreate:</strong> قوالب تدعم اللغة الروسية بشكل ممتاز
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Short Video Reel Screenplay View */}
              {activeViewTab === 'video' && (
                <div className="space-y-4">
                  <div className="tool-card p-6 space-y-6 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          {result.content.video_reel_script.target_duration}
                        </span>
                        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                          <Video className="w-4 h-4 text-info" />
                          <span>{result.content.video_reel_script.title}</span>
                        </h3>
                      </div>
                      <p className="text-xs text-muted">
                        سيناريو مشهد بمشهد مجهز لصناع المحتوى الدعوي على تيك توك، ريلز إنستغرام، ويوتيوب شورتس
                      </p>
                    </div>

                    {/* Audio Direction */}
                    <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2">
                      <span className="font-bold">التوجيه الصوتي:</span>
                      <span>{result.content.video_reel_script.audio_direction}</span>
                    </div>

                    {/* Scenes List */}
                    <div className="space-y-3">
                      {result.content.video_reel_script.scenes.map((scene) => (
                        <div
                          key={scene.scene_number}
                          className="bg-page border border-line rounded-xl p-4 space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between border-b border-line pb-2">
                            <span className="text-xs font-bold text-brand">
                              المشهد {scene.scene_number} ({scene.duration_seconds})
                            </span>
                            <span className="text-[10px] text-muted font-mono">
                              نص الشاشة: {scene.on_screen_text}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div>
                              <span className="text-muted font-semibold">الوصف البصري: </span>
                              <span className="text-ink">{scene.visual_description}</span>
                            </div>
                            <div>
                              <span className="text-brand font-semibold">الصوت (عربي): </span>
                              <span className="text-ink font-ibm">{scene.voiceover_ar}</span>
                            </div>
                            {scene.voiceover_translated && (
                              <div>
                                <span className="text-gold font-semibold">الصوت / الترجمة: </span>
                                <span className="text-ink/85 italic">{scene.voiceover_translated}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Free Video Editing Tools */}
                    <div className="p-4 rounded-xl bg-page border border-line space-y-2">
                      <span className="text-xs font-bold text-brand block">
                        أدوات مجانية 100% لمونتاج وإنشاء هذا الريلز:
                      </span>
                      <ul className="text-xs text-ink/85 space-y-1 list-disc list-inside">
                        {result.content.video_reel_script.free_tools_recommendation.map((tool, idx) => (
                          <li key={idx}>{tool}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Citations & Evidence Explorer */}
              {activeViewTab === 'citations' && (
                <div className="space-y-4">
                  <div className="tool-card p-6 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand" />
                      <span>سجل الأدلة والمصادر المعتمدة المستخدمة في هذه المسودة</span>
                    </h3>

                    <div className="space-y-3">
                      {result.content.all_citations.map((c, idx) => (
                        <div
                          key={idx}
                          className="bg-page border border-line rounded-xl p-4 space-y-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-brand">
                              {c.source_name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {c.type.toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs text-ink font-ibm bg-surface p-2.5 rounded-lg border border-line">
                            {c.arabic_text}
                          </div>

                          {c.translation && (
                            <div className="text-[11px] text-muted italic">
                              الترجمة المعتمدة: {c.translation}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[11px] text-muted">
                            <span>المرجعية: {c.authority}</span>
                            <a
                              href={c.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand hover:text-brand-strong inline-flex items-center gap-1 font-semibold"
                            >
                              <span>الرابط المعتمد</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
