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
  ShieldCheck,
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
  const isTafsir = (result.item.type === 'tafsir_question' || result.citation?.source_id === 'quran-tafsir-salaf') && Boolean(result.canonical_text || result.citation?.book);
  const isAqeedah = (result.item.type === 'aqeedah_question' || result.citation?.source_id === 'dorar-aqeedah') && Boolean(result.canonical_text || result.citation?.book);

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
          label: 'غير مطابق (رُصد تبديل لفظي)'
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
              ? {
                  icon: <Scale className="h-5 w-5 text-brand" />,
                  badge: 'status-badge bg-emerald-50 text-emerald-800 border-emerald-300',
                  panel: 'result-panel border-s-4 border-s-emerald-600 bg-emerald-50/20',
                  label: 'مسألة فقهية موثقة'
                }
              : isTafsir
                ? {
                    icon: <BookOpenCheck className="h-5 w-5 text-brand" />,
                    badge: 'status-badge bg-emerald-50 text-emerald-800 border-emerald-300',
                    panel: 'result-panel border-s-4 border-s-emerald-600 bg-emerald-50/20',
                    label: 'تفسير موثق من المصدر'
                  }
                : isAqeedah
                  ? {
                      icon: <ShieldCheck className="h-5 w-5 text-brand" />,
                      badge: 'status-badge bg-emerald-50 text-emerald-800 border-emerald-300',
                      panel: 'result-panel border-s-4 border-s-emerald-600 bg-emerald-50/20',
                      label: 'مادة عقدية موثقة'
                    }
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

  const typeLabel = {
    ayah: 'آية قرآنية',
    hadith: 'حديث أو رواية',
    term: 'مصطلح',
    fiqh_question: 'مسألة فقهية',
    tafsir_question: 'سؤال في التفسير',
    aqeedah_question: 'سؤال عقدي',
    claim: 'نص'
  }[result.item.type] || 'نص';

  const displayTitle = isMatched
    ? (result.item.type === 'ayah'
        ? 'مطابق للمصحف الشريف'
        : (cleanLabel(result.status_label_ar) || 'مطابق للمصدر المعتمد'))
    : isAlteredQuran
      ? 'غير مطابق — رُصد اختلاف في لفظ الآية'
      : (cleanLabel(result.status_label_ar) || tone.label);

  return (
    <article className="verification-card">
      <div className={tone.panel}>
        {/* رأس البطاقة: نوع المحتوى + الحكم المباشر + زر فتح المصدر */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`status-icon-wrap ${tone.badge}`} aria-hidden="true">
              {tone.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted">{typeLabel}</span>
                <span className="decision-chip">{tone.label}</span>
              </div>
              <h3 className="mt-1 font-display text-lg sm:text-xl font-bold leading-tight text-ink">
                {displayTitle}
              </h3>
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
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                <FileSearch className="h-4 w-4 text-gold" />
                <span>الدليل ({cleanLabel(result.citation?.source_name) || 'المصدر المعتمد'})</span>
              </span>
            </div>

            <div className="evidence-quote my-2.5">
              «{(result.canonical_text || '').replace(/[\uFC00-\uFC6E]/g, '').trim()}»
            </div>

            <div className="evidence-meta">
              {result.citation?.book && <span>{cleanLabel(result.citation.book)}</span>}
              {result.citation?.number_or_page && <span>{cleanLabel(result.citation.number_or_page)}</span>}
              {result.citation?.grade && <span>{cleanLabel(result.citation.grade)}</span>}
            </div>
          </div>
        ) : (
          !isMatched && compactReason(result.reason) && (
            <p className="mt-3 text-sm leading-7 text-muted border-t border-line/60 pt-3">
              {compactReason(result.reason)}
            </p>
          )
        )}

        {/* عارض الفروق اللفظية المباشر — يظهر فقط عند وجود اختلاف فعلي عن المصحف الشريف */}
        {hasDifferences && result.diff && (
          <div className="mt-4 pt-3.5 border-t border-line/60">
            <div className="eyebrow mb-2">الفروق المكتشفة مع المصحف الشريف</div>
            <WordDiffViewer diff={result.diff} canonicalText={result.canonical_text} />
          </div>
        )}
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
            {compactReason(result.reason) && (
              <div className="rounded-xl border border-line bg-surface p-3 text-xs leading-6 text-muted">
                <strong className="text-ink">بيان التحقق والمطابقة: </strong>
                {compactReason(result.reason)}
              </div>
            )}
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
                <span>مستوى المراجعة: {result.decision_level}</span>
              </div>
            )}

            {result.abstention_note && (
              <div className="notice-box">
                <Info className="h-4 w-4 shrink-0" />
                <span>{result.abstention_note}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};