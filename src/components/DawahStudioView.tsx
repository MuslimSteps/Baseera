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
  const [topic, setTopic] = useState('الصبر وفضله في الشدائد');
  const [contentType, setContentType] = useState<'khutba_friday' | 'article_dawah' | 'infographic_card'>('khutba_friday');
  const [language, setLanguage] = useState<'ar' | 'ru' | 'en'>('ru');
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
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Banner: Scientific Package Compliance ──────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-gold/10 via-surface to-canvas border border-gold/30 p-6 md:p-8 shadow-xl reveal">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="badge badge-gold">
                منظومة الإنتاج والتوثيق الدعوي
              </span>
              <span className="text-xs text-muted font-mono">
                المسار الرابع · الحزمة العلمية
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-ink">
              صانع المحتوى الدعوي وخطب الجمعة الموثقة
            </h1>
            <p className="text-muted text-sm max-w-3xl leading-relaxed">
              توليد رصين قائم على قاعدة <strong className="text-gold">«التوليد بعد التوثيق الصارم»</strong>: استرجاع المادة الدعوية حصراً من <span className="text-gold-soft font-mono">dawa.center</span>، والآيات من مصحف مجمع الملك فهد وترجماته المعتمدة (إلمير كولييف للروسية)، والأحاديث من الدرر السنية، وضبط المصطلحات بموسوعة الجمهرة.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 shrink-0 text-xs text-muted bg-white/[0.03] p-3 rounded-xl border border-hairline">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>لا اختلاق للأدلة أو العزو</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-amber-400" />
              <span>ترجمات مجمع الملك فهد المعتمدة</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>بطاقات إنفوجرافيك وسيناريوهات ريلز</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Studio Form & Controls ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Panel */}
        <div className="lg:col-span-1 space-y-6 bento-card border border-hairline rounded-2xl p-6 shadow-lg">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-hairline pb-3">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>إعدادات المسودة الدعوية</span>
            </h2>

            {/* Topic Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink/85 block">
                موضوع الخطبة أو المقال:
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: الصبر، التوبة، رحمة الله، بر الوالدين..."
                className="w-full bg-canvas-soft border border-hairline-strong focus:border-gold rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-faint focus:outline-none transition-all"
              />
            </div>

            {/* Quick Topic Presets */}
            <div className="space-y-2">
              <span className="text-[11px] text-muted block font-medium">موضوعات دعوية شائعة وموثقة:</span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {PRESET_TOPICS.map((pt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopic(pt.topic)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors border ${
                      topic === pt.topic
                        ? 'bg-gold/15 text-gold-soft border-gold/40 font-semibold'
                        : 'bg-white/[0.02] text-muted border-hairline hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {pt.topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink/85 block">
                نوع القالب الدعوي:
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
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-0.5 ${
                      contentType === type.id
                        ? 'bg-gold/15 border-gold text-white'
                        : 'bg-canvas-soft/60 border-hairline text-muted hover:text-ink hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className="text-xs font-bold text-ink">{type.label}</span>
                    <span className="text-[10px] text-faint">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink/85 block flex items-center justify-between">
                <span>اللغة المستهدفة:</span>
                <span className="text-[10px] text-emerald-400 font-mono">ترجمات معتمدة فقط</span>
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
                    className={`py-2 px-2 rounded-xl border text-center transition-all ${
                      language === l.id
                        ? 'bg-gold/15 border-gold text-gold-soft font-bold'
                        : 'bg-canvas-soft/60 border-hairline text-muted hover:text-white'
                    }`}
                  >
                    <div className="text-xs">{l.label}</div>
                    <div className="text-[9px] text-faint truncate">{l.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink/85 block">
                الجمهور والمخاطبون:
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="w-full bg-canvas-soft border border-hairline-strong focus:border-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
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
              <label className="text-xs font-semibold text-ink/85 block">
                توجيهات إضافية (اختياري):
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="مثال: التركيز على تطبيق الصبر في بيئة العمل، أو مراعاة المسلمين في المهجر..."
                rows={2}
                className="w-full bg-canvas-soft border border-hairline-strong focus:border-gold rounded-xl p-3 text-xs text-white placeholder:text-faint focus:outline-none resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold font-display text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-black/40/30"
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
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <span>{error}</span>
            </div>
          )}

          {!result && !loading && (
            <div className="bento-card/60 border border-hairline rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">اختر الموضوع وابدأ التوليد الموثق</h3>
                <p className="text-xs text-muted max-w-md mx-auto">
                  سيقوم النظام باستخراج الآيات من مصحف المدينة، والأحاديث الصحيحة من الدرر السنية، والمصطلحات من الجمهرة، وصياغة خطبة أو مقال جاهز للإلقاء مع الترجمة المعتمدة.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-all inline-flex items-center gap-2"
                >
                  <span>تجربة خطبة عن «الصبر» باللغة الروسية</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Header Bar with Action Buttons */}
              <div className="bento-card border border-hairline rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ موثق من المصادر المعتمدة
                    </span>
                    <span className="text-xs text-muted font-mono">
                      {result.content.all_citations.length} أدلة مسترجعة
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white font-display">
                    {result.content.title_ar}
                  </h2>
                  {result.content.title_translated && (
                    <p className="text-xs text-ink/85 italic font-mono">
                      {result.content.title_translated}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-medium text-ink border border-hairline flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted" />
                    <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadText}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-gold-soft border border-gold/30 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل (TXT)</span>
                  </button>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-2 border-b border-hairline pb-1">
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
                      className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold flex items-center gap-2 transition-all relative ${
                        isActive
                          ? 'text-emerald-400 bento-card border-t border-x border-hairline-strong'
                          : 'text-muted hover:text-ink'
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
                      className="bento-card border border-hairline rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-hairline pb-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-[10px]">
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
                      <div className="text-ink text-sm leading-relaxed whitespace-pre-line font-ibm bg-surface-2 p-4 rounded-xl border border-hairline">
                        {sec.content_ar}
                      </div>

                      {/* Translated Text if exists */}
                      {sec.content_translated && sec.content_translated !== sec.content_ar && (
                        <div className="mt-3 pt-3 border-t border-hairline">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                            {result.content.language === 'ru' ? 'Официальный перевод (Русский)' : 'Official Translation'}
                          </span>
                          <div className="text-ink/85 text-xs leading-relaxed whitespace-pre-line bg-canvas-soft p-3.5 rounded-xl border border-hairline font-sans">
                            {sec.content_translated}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Verification Notice */}
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs leading-relaxed flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{result.content.verification_note}</span>
                  </div>
                </div>
              )}

              {/* Tab 2: Infographic SVG Card View */}
              {activeViewTab === 'infographic' && (
                <div className="space-y-4">
                  <div className="bento-card border border-hairline rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                          <span>بطاقة الإنفوجرافيك التفاعلية (1080 × 1080 بكسل)</span>
                        </h3>
                        <p className="text-xs text-muted">
                          جاهزة للنشر على إنستغرام، واتساب، وتيليجرام بدون أي برامج خارجية
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadSvg}
                        className="px-4 py-2 rounded-xl bg-gold-strong hover:bg-[#c96a12] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-black/40/40 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>تنزيل البطاقة (SVG)</span>
                      </button>
                    </div>

                    {/* SVG Render Container */}
                    <div className="flex justify-center bg-canvas-soft p-4 rounded-xl border border-hairline overflow-hidden">
                      <div
                        className="max-w-[500px] w-full shadow-2xl rounded-xl overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: result.infographic_svg }}
                      />
                    </div>

                    {/* Free Design Tools Recommendations */}
                    <div className="p-4 rounded-xl bg-surface-2 border border-hairline space-y-2">
                      <span className="text-xs font-bold text-amber-300 block">
                        🎨 أدوات مجانية موصى بها لصناعة الإنفوجرافيك والمحتوى البصري:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink/85">
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-hairline">
                          <strong className="text-white">Canva (canva.com):</strong> قوالب إسلامية مجانية جاهزة لمقاس 1080×1080
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-hairline">
                          <strong className="text-white">Adobe Express:</strong> تصاميم مجانية مع دعم الخطوط العربية الرسمية
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-hairline">
                          <strong className="text-white">Piktochart:</strong> إنفوجرافيك تعليمي ودعوي مجاني
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-hairline">
                          <strong className="text-white">Crello / VistaCreate:</strong> قوالب تدعم اللغة الروسية بشكل ممتاز
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Short Video Reel Screenplay View */}
              {activeViewTab === 'video' && (
                <div className="space-y-4">
                  <div className="bento-card border border-hairline rounded-2xl p-6 space-y-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {result.content.video_reel_script.target_duration}
                        </span>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Video className="w-4 h-4 text-cyan-400" />
                          <span>{result.content.video_reel_script.title}</span>
                        </h3>
                      </div>
                      <p className="text-xs text-muted">
                        سيناريو مشهد بمشهد مجهز لصناع المحتوى الدعوي على تيك توك، ريلز إنستغرام، ويوتيوب شورتس
                      </p>
                    </div>

                    {/* Audio Direction */}
                    <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-200 text-xs flex items-center gap-2">
                      <span className="font-bold">التوجيه الصوتي:</span>
                      <span>{result.content.video_reel_script.audio_direction}</span>
                    </div>

                    {/* Scenes List */}
                    <div className="space-y-3">
                      {result.content.video_reel_script.scenes.map((scene) => (
                        <div
                          key={scene.scene_number}
                          className="bg-surface-2 border border-hairline rounded-xl p-4 space-y-2.5"
                        >
                          <div className="flex items-center justify-between border-b border-hairline pb-2">
                            <span className="text-xs font-bold text-cyan-400">
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
                              <span className="text-emerald-400 font-semibold">الصوت (عربي): </span>
                              <span className="text-ink font-ibm">{scene.voiceover_ar}</span>
                            </div>
                            {scene.voiceover_translated && (
                              <div>
                                <span className="text-amber-400 font-semibold">الصوت / الترجمة: </span>
                                <span className="text-ink/85 italic">{scene.voiceover_translated}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Free Video Editing Tools */}
                    <div className="p-4 rounded-xl bg-surface-2 border border-hairline space-y-2">
                      <span className="text-xs font-bold text-cyan-300 block">
                        🎬 أدوات مجانية 100% لمونتاج وإنشاء هذا الريلز:
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
                  <div className="bento-card border border-hairline rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <span>سجل الأدلة والمصادر المعتمدة المستخدمة في هذه المسودة</span>
                    </h3>

                    <div className="space-y-3">
                      {result.content.all_citations.map((c, idx) => (
                        <div
                          key={idx}
                          className="bg-surface-2 border border-hairline rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-400">
                              {c.source_name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              {c.type.toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs text-ink/85 font-ibm bg-canvas-soft p-2.5 rounded-lg border border-hairline">
                            {c.arabic_text}
                          </div>

                          {c.translation && (
                            <div className="text-[11px] text-muted italic">
                              الترجمة المعتمدة: {c.translation}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[11px] text-faint">
                            <span>المرجعية: {c.authority}</span>
                            <a
                              href={c.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold"
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
