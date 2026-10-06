import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSearch,
  Info,
  Scale,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { VerificationResult } from '../types/baseera.ts';
import { WordDiffViewer } from './WordDiffViewer.tsx';

interface VerificationCardProps {
  result: VerificationResult;
  index: number;
  viewMode?: 'simple' | 'detailed';
}

function cleanLabel(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function compactReason(value?: string) {
  const clean = cleanLabel(value);
  if (!clean) return '';
  const first = clean.split(/(?<=[.!؟])\s+/u)[0];
  return (first || clean).length > 220 ? (first || clean).slice(0, 217) + '…' : (first || clean);
}

export const VerificationCard: React.FC<VerificationCardProps> = ({
  result,
  index,
  viewMode = 'simple'
}) => {
  const [detailsOpen, setDetailsOpen] = useState(viewMode === 'detailed');

  useEffect(() => {
    setDetailsOpen(viewMode === 'detailed');
  }, [viewMode]);

  const isAlteredQuran = result.finding_type === 'altered_quran_text';
  const isMatched = result.status === 'MATCHED';
  const isReview = result.status === 'NEEDS_REVIEW' && !isAlteredQuran;
  const isReferral = result.status === 'REFER_TO_SPECIALIST';
  const isNotFound = result.status === 'NOT_FOUND_IN_CHECKED_SOURCES';

  const isFiqh = (result.item.type === 'fiqh_question' || result.citation?.source_id === 'fiqh-madhahib-dorar') && Boolean(result.canonical_text || result.citation?.book);
  const isConsensusDisputed = isFiqh && Boolean(result.status_label_ar?.includes('دعوى إجماع غير صحيحة'));
  const isConsensusVerified = isFiqh && Boolean(result.status_label_ar?.includes('إجماع موثق') || result.status_label_ar?.includes('إجماع فقهي موثق'));
  const isFiqhContradicted = isFiqh && Boolean(
    result.status_label_ar?.includes('غير مطابق') ||
    result.status_label_ar?.includes('دعوى مخالفة') ||
    result.status_label_ar?.includes('دعوى باطلة') ||
    result.finding_type === 'contradicted_claim'
  );
  const hasDifferences = Boolean(result.diff && result.diff.some(d => d.type !== 'equal'));

  const tone = isMatched
    ? {
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-700" />,
        badge: 'status-badge status-matched',
        panel: 'result-panel result-panel-matched',
        label: 'مطابق للمصدر'
      }
    : isAlteredQuran
      ? {
          icon: <ShieldAlert className="h-5 w-5 text-rose-600" />,
          badge: 'status-badge status-danger bg-rose-50 text-rose-700 border-rose-200',
          panel: 'result-panel border-s-4 border-s-rose-500 bg-rose-50/20',
          label: cleanLabel(result.status_label_ar) || 'غير مطابق للمصحف الشريف (رُصد اختلاف لفظي)'
        }
      : isFiqhContradicted
        ? {
            icon: <ShieldAlert className="h-5 w-5 text-rose-600" />,
            badge: 'status-badge status-danger bg-rose-50 text-rose-700 border-rose-200',
            panel: 'result-panel border-s-4 border-s-rose-500 bg-rose-50/20',
            label: 'غير مطابق للمصدر (دعوى باطلة)'
          }
        : isReferral
          ? {
              icon: <ShieldAlert className="h-5 w-5 text-amber-700" />,
              badge: 'status-badge status-referral',
              panel: 'result-panel result-panel-referral',
              label: 'يتطلب الرجوع إلى مختص'
            }
          : isConsensusDisputed
            ? {
                icon: <Scale className="h-5 w-5 text-amber-700" />,
                badge: 'status-badge bg-amber-50 text-amber-800 border-amber-300',
                panel: 'result-panel border-s-4 border-s-amber-500 bg-amber-50/20',
                label: 'مسألة خلافية بين المذاهب'
              }
            : isConsensusVerified
              ? {
                  icon: <Scale className="h-5 w-5 text-emerald-700" />,
                  badge: 'status-badge bg-emerald-50 text-emerald-800 border-emerald-300',
                  panel: 'result-panel border-s-4 border-s-emerald-600 bg-emerald-50/20',
                  label: 'إجماع فقهي موثق'
                }
              : isFiqh
                ? (result.finding_type === 'ambiguous_question' || result.evidence_alignment === 'RELATED'
                    ? {
                        icon: <AlertTriangle className="h-5 w-5 text-amber-700" />,
                        badge: 'status-badge bg-amber-50 text-amber-800 border-amber-300',
                        panel: 'result-panel border-s-4 border-s-amber-500 bg-amber-50/20',
                        label: 'السؤال يحتاج تحديداً ومراجعة'
                      }
                    : {
                        icon: <Scale className="h-5 w-5 text-brand" />,
                        badge: 'status-badge bg-emerald-50 text-emerald-800 border-emerald-300',
                        panel: 'result-panel border-s-4 border-s-emerald-600 bg-emerald-50/20',
                        label: result.is_question ? 'عُثر على المسألة في المصدر' : 'موثقة في المذاهب الأربعة'
                      })
                : isReview
                      ? {
                          icon: <AlertTriangle className="h-5 w-5" />,
                          badge: 'status-badge status-review',
                          panel: 'result-panel result-panel-review',
                          label: 'يحتاج مراجعة'
                        }
                      : {
                          icon: <Info className="h-5 w-5" />,
                          badge: 'status-badge status-neutral',
                          panel: 'result-panel result-panel-neutral',
                          label: 'لم يُعثر عليه'
                        };

  const typeLabel = ({
    ayah: 'آية قرآنية',
    hadith: 'حديث أو رواية',
    term: 'مصطلح',
    fiqh_question: 'مسألة فقهية',
    claim: 'نص'
  } as Record<string, string>)[result.item.type] || 'نص';

  const displayTitle = isMatched
    ? (result.item.type === 'ayah'
        ? (result.is_partial_quote
            ? 'مطابق للمصحف الشريف — النص جزء من الآية'
            : 'مطابق للمصحف الشريف')
        : (cleanLabel(result.status_label_ar) || (result.is_question ? 'عُثر على المسألة في المصدر المعتمد' : 'مطابق للمصدر المعتمد')))
    : isAlteredQuran
      ? (cleanLabel(result.status_label_ar) || 'غير مطابق للمصحف الشريف — رُصد اختلاف في لفظ الآية')
      : isFiqhContradicted
        ? (cleanLabel(result.status_label_ar) || 'غير مطابق للمصدر — دعوى مخالفة للمعتمد')
        : (cleanLabel(result.status_label_ar) || tone.label);

  // ── وصف تقني دقيق لنوع الاختلاف اللفظي (ألفاظ ساقطة / مبدّلة / دخيلة) ──
  const diffStats = (result.diff || []).reduce(
    (acc, d) => {
      if (d.type === 'missing') acc.missing += 1;
      else if (d.type === 'added') acc.added += 1;
      else if (d.type === 'changed') acc.changed += 1;
      return acc;
    },
    { missing: 0, added: 0, changed: 0 }
  );

  const mismatchParts: string[] = [];
  if (diffStats.changed > 0) mismatchParts.push(`${diffStats.changed} لفظ مبدّل`);
  if (diffStats.missing > 0) mismatchParts.push(`${diffStats.missing} لفظ ساقط`);
  if (diffStats.added > 0) mismatchParts.push(`${diffStats.added} لفظ دخيل`);

  const hasDiffDetail = mismatchParts.length > 0;

  // سبب النتيجة: جملة واحدة واضحة ومباشرة، تُبنى من فحص المصدر لا من نص عام.
  const verdictReason = (() => {
    if (isAlteredQuran) {
      const base = result.item.type === 'ayah'
        ? 'النص المدخل لا يطابق نص الآية في المصحف المعتمد'
        : 'النص المدخل لا يطابق اللفظ في المصدر المعتمد';
      if (hasDiffDetail) {
        return `${base}؛ توجد ${mismatchParts.join(' و ')}.`;
      }
      return `${base}؛ راجع الفوارق اللفظية أدناه.`;
    }
    return compactReason(result.reason);
  })();

  // عنوان صندوق الدليل: يوضح ما إذا كان النص مطابقاً فعلاً أو مجرد نص قريب أو يحتوي فوارق لفظية.
  const canonicalBoxLabel = hasDifferences
    ? (result.item.type === 'ayah'
        ? 'تحليل الفوارق اللفظية مقارنة بالمصحف الشريف المعتمد'
        : 'تحليل الفوارق اللفظية مقارنة بالمصدر المعتمد')
    : result.is_partial_quote
      ? (result.item.type === 'ayah'
          ? 'الآية الكاملة من المصدر المعتمد — الجزء المظلَّل هو نصك المدخل'
          : 'الحديث الشريف من المصدر المعتمد — الجزء المظلَّل هو نصك المدخل')
      : isAlteredQuran || isReview
        ? 'نص المصدر المعتمد للاسترشاد (غير مطابق تماماً للمدخل)'
        : 'النص المنقول من المصدر المعتمد';

  const accent = isMatched
    ? 'bg-emerald-500'
    : isAlteredQuran || isFiqhContradicted
      ? 'bg-rose-500'
      : isReferral
        ? 'bg-indigo-500'
        : isNotFound
          ? 'bg-slate-400'
          : 'bg-amber-500';

  return (
    <article className="verification-card">
      <div className={`mb-3 h-1.5 w-full rounded-full ${accent}`} aria-hidden="true" />
      <div className={tone.panel}>
        {/* رأس البطاقة: نوع المحتوى + الحكم المباشر + زر فتح المصدر */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`status-icon-wrap ${tone.badge}`} aria-hidden="true">
              {tone.icon}
            </span>
            <div>
              <span className="text-xs font-bold text-muted">{typeLabel}</span>
              <h3 className="mt-1 font-display text-lg sm:text-xl font-bold leading-tight text-ink">
                <span className="text-muted">النتيجة: </span>{displayTitle}
              </h3>
              {verdictReason && (
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  <span className="font-bold text-ink">سبب النتيجة: </span>{verdictReason}
                </p>
              )}
            </div>
          </div>

          {result.citation?.url && (
            <a
              href={result.citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-link"
            >
              <BookOpenCheck className="h-4 w-4" />
              <span>فتح المصدر</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* مبدأ الحوكمة الصارم لتوثيق الأحاديث النبوية */}
        {(result.item.type === 'hadith' && !isMatched) && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-600/25 bg-amber-500/10 px-3.5 py-2.5 text-xs font-bold leading-relaxed text-amber-900 shadow-sm">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-amber-700 mt-0.5" />
            <span>
              {result.abstention_note || 'لا تُثبت النسبة إلى النبي ﷺ حتى توجد مطابقة صريحة في المصدر الحديثي المعتمد.'}
            </span>
          </div>
        )}

        {/* الدليل مدمج ومباشر في قلب البطاقة دون تكرار */}
        {result.canonical_text && !isNotFound ? (
          <div className="mt-4 pt-3.5 border-t border-line/60">
            {/* تنبيه دلالي ومراجعة عند غموض السؤال */}
            {result.ambiguity_note && (
              <div className="mb-3.5 rounded-xl border border-amber-500/40 bg-amber-50/80 p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-bold text-amber-900 block">تنبيه دلالي ومراجعة:</strong>
                  <p className="leading-relaxed">{result.ambiguity_note}</p>
                </div>
              </div>
            )}

            {/* بيان المخالفة للمصدر عند وجود دعوى مناقضة */}
            {isFiqhContradicted && (
              <div className="mb-3.5 rounded-xl border border-rose-500/40 bg-rose-50/80 p-3.5 text-xs text-rose-950 flex items-start gap-2.5 shadow-xs">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-bold text-rose-900 block">بيان المخالفة للمصدر المعتمد:</strong>
                  <p className="leading-relaxed">{result.baseera_explanation || result.reason}</p>
                </div>
              </div>
            )}

            {/* عرض النص المنقول من المصدر المعتمد أو تحليل الفوارق مرة واحدة بنقاء ووضوح دون تكرار */}
            <div className="rounded-xl border border-line bg-page p-4 text-sm leading-relaxed text-ink space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                  <FileSearch className="h-4 w-4 text-gold" />
                  <span>{canonicalBoxLabel} ({cleanLabel(result.citation?.source_name) || 'المصدر المعتمد'})</span>
                </div>
                {result.evidence_alignment && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    result.evidence_alignment === 'DIRECT'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {result.evidence_alignment === 'DIRECT' ? 'دليل مباشر' : 'متعلق بالسياق'}
                  </span>
                )}
              </div>

              {hasDifferences && result.diff && result.diff.length > 0 ? (
                /* عارض الفوارق اللفظية مدمج مباشرة داخل صندوق الدليل لمنع التكرار */
                <WordDiffViewer diff={result.diff} canonicalText={result.canonical_text} showCanonical={false} />
              ) : (
                <>
                  <div className="evidence-quote font-medium text-ink leading-relaxed">
                    {(() => {
                      const cleaned = (result.canonical_text || '')
                        .replace(/[\u06DD\uFD3E\uFD3F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
                        .trim();
                      const window = result.quote_window;
                      if (!result.is_partial_quote || !window) {
                        return <>«{cleaned}»</>;
                      }
                      const words = cleaned.split(/\s+/);
                      const before = words.slice(0, window.start).join(' ');
                      const matched = words.slice(window.start, window.start + window.words).join(' ');
                      const after = words.slice(window.start + window.words).join(' ');
                      return (
                        <>
                          «{before}
                          {before ? ' ' : ''}
                          <mark className="rounded-md bg-amber-200/80 px-1 font-bold text-ink">{matched}</mark>
                          {after ? ' ' + after : ''}»
                        </>
                      );
                    })()}
                  </div>
                  {result.is_partial_quote && (
                    <p className="pt-1 text-xs font-semibold text-amber-800">
                      الجزء المظلَّل بالأصفر هو النص الذي أدخلته، وهو مطابق حرفيًا لهذا الموضع {result.item.type === 'ayah' ? 'من الآية' : 'من متن الحديث'}.
                    </p>
                  )}
                </>
              )}

              <div className="evidence-meta pt-2 border-t border-line/40 text-xs text-muted flex flex-wrap items-center gap-3">
                {result.citation?.book && <span className="font-semibold text-ink">{cleanLabel(result.citation.book)}</span>}
                {result.citation?.number_or_page && <span>{cleanLabel(result.citation.number_or_page)}</span>}
                {result.citation?.grade && <span>{cleanLabel(result.citation.grade)}</span>}
              </div>
            </div>

            {/* بيان إيضاحي من بصيرة عند الحاجة فقط دون حشو مكرر */}
            {result.baseera_explanation && !result.ambiguity_note && !isFiqhContradicted && !result.baseera_explanation.includes('تبين المعتمد في المسألة') && (
              <div className="mt-2.5 rounded-lg bg-surface/70 border border-line/60 px-3 py-2 text-xs text-muted flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-brand" />
                <span>{result.baseera_explanation}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-page">
        <button
          type="button"
          onClick={() => setDetailsOpen(open => !open)}
          className="details-toggle"
          aria-expanded={detailsOpen}
        >
          <span className="flex items-center gap-2 font-semibold text-ink">
            {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {detailsOpen ? 'إخفاء التفاصيل' : 'تفاصيل المطابقة'}
          </span>
          <span className="text-[11px] text-faint">للباحثين والقراءة المتقدمة</span>
        </button>

        {detailsOpen && (
          <div className="space-y-4 border-t border-line px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="detail-cell">
                <div className="detail-label">النص المدخل</div>
                <div className="detail-value">{result.item.text}</div>
              </div>
              <div className="detail-cell">
                <div className="detail-label">المصدر المرجعي</div>
                <div className="detail-value">
                  {cleanLabel(result.citation?.source_name) || 'لم يحدد'}
                  {result.citation?.book ? ` · ${cleanLabel(result.citation.book)}` : ''}
                </div>
              </div>
              <div className="detail-cell">
                <div className="detail-label">نوع المدخل والتوصيف</div>
                <div className="detail-value">
                  {(result.item.type === 'ayah' || result.citation?.source_id === 'quran-uthmani')
                    ? 'نص قرآني كريم'
                    : (result.item.type === 'hadith' || result.citation?.source_id === 'dorar-hadith')
                    ? 'حديث نبوي شريف'
                    : result.item.type === 'term'
                    ? 'مصطلح إسلامي'
                    : result.is_question
                    ? 'سؤال فقهي مستفهم'
                    : 'ادعاء فقهي / نقل'}
                </div>
              </div>
              <div className="detail-cell">
                <div className="detail-label">حالة المواءمة والدليل</div>
                <div className="detail-value">
                  {result.evidence_alignment === 'DIRECT'
                    ? 'دليل مباشر يطابق قيود المسألة'
                    : result.finding_type === 'ambiguous_question'
                    ? 'مادة مرتبطة (السؤال عام ويحتاج تحديداً)'
                    : 'مستند متعلق بالسياق'}
                </div>
              </div>
            </div>

            {result.ai_match && (
              <div className="ai-note">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>استُخدم الذكاء الاصطناعي لترتيب المرشحات فقط؛ الحكم النهائي مبني على نص المصدر المرجعي.</span>
              </div>
            )}

            {result.decision_level && (
              <div className="notice-box">
                <Info className="h-4 w-4 shrink-0" />
                <span>ضابط الحوكمة الشرعية: توثيق وإحالة للمصدر المعتمد دون استقلال بفتوى (مستوى {result.decision_level})</span>
              </div>
            )}

            {/* مفتاح ألوان وحالات المطابقة المعتمد في بصيرة */}
            {result.is_question ? (
              <div className="rounded-xl border border-line bg-surface/60 p-3.5 text-xs">
                <div className="font-bold text-ink mb-2.5 flex items-center justify-between">
                  <span>مفتاح حالات فحص الأسئلة الفقهية:</span>
                  <span className="text-[11px] font-normal text-muted">الحالة الحالية: <strong className="text-ink">{cleanLabel(result.status_label_ar) || tone.label}</strong></span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${
                    (!isReview && !isNotFound && (result.evidence_alignment === 'DIRECT' || result.finding_type === 'documented_question'))
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/30'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                  }`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                    <span>عُثر على المسألة في المصدر</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${
                    (isReview || result.finding_type === 'ambiguous_question' || result.evidence_alignment === 'RELATED')
                      ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-500/30'
                      : 'bg-amber-50/60 border-amber-200 text-amber-800'
                  }`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                    <span>مادة مرتبطة / يحتاج تحديداً</span>
                  </div>
                  <div className="p-2 rounded-lg border flex items-center gap-1.5 font-semibold bg-rose-50/60 border-rose-200 text-rose-800 opacity-60">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
                    <span>خارج النطاق</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${
                    isNotFound ? 'bg-slate-200 border-slate-400 text-slate-900 ring-2 ring-slate-500/30' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                    <span>لم يُعثر عليه (امتناع)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface/60 p-3.5 text-xs">
                <div className="font-bold text-ink mb-2.5 flex items-center justify-between">
                  <span>مفتاح ألوان وحالات المطابقة:</span>
                  <span className="text-[11px] font-normal text-muted">الحالة الحالية: <strong className="text-ink">{cleanLabel(result.status_label_ar) || tone.label}</strong></span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${isMatched ? 'bg-emerald-100 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/30' : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                    <span>مطابق للمصدر</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${isAlteredQuran || isFiqhContradicted ? 'bg-rose-100 border-rose-400 text-rose-900 ring-2 ring-rose-500/30' : 'bg-rose-50/60 border-rose-200 text-rose-800'}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
                    <span>غير مطابق / مبدّل</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${isReview ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-500/30' : 'bg-amber-50/60 border-amber-200 text-amber-800'}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                    <span>يحتاج مراجعة / خلافي</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 font-semibold ${isNotFound ? 'bg-slate-200 border-slate-400 text-slate-900 ring-2 ring-slate-500/30' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                    <span>لم يُعثر عليه (امتناع)</span>
                  </div>
                </div>
              </div>
            )}

            {result.abstention_note && (
              <div className="notice-box">
                <Info className="h-4 w-4 shrink-0" />
                <span>{result.abstention_note}</span>
              </div>
            )}

            {result.diff && result.diff.length > 0 && (
              <div className="pt-2 border-t border-line">
                <div className="eyebrow mb-2">ألوان المطابقة اللفظية وتحليل الفوارق</div>
                <WordDiffViewer diff={result.diff} canonicalText={result.canonical_text} />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};