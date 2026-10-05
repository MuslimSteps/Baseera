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

  const tone = isMatched
    ? {
        icon: <CheckCircle2 className="h-5 w-5" />,
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
            icon: <ShieldAlert className="h-5 w-5" />,
            badge: 'status-badge status-referral',
            panel: 'result-panel result-panel-referral',
            label: 'يتطلب الرجوع إلى مختص'
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

  return (
    <article className="verification-card">
      <div className={tone.panel}>
        <div className="flex items-start gap-3">
          <span className={`status-icon-wrap ${tone.badge}`} aria-hidden="true">
            {tone.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted">{typeLabel}</span>
              <span className="decision-chip">{tone.label}</span>
            </div>
            <h3 className="mt-2 font-display text-xl font-bold leading-8 text-ink">
              {cleanLabel(result.status_label_ar) || tone.label}
            </h3>
            {compactReason(result.reason) && (
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
                {compactReason(result.reason)}
              </p>
            )}
          </div>
        </div>

        {result.citation?.url && (
          <a
            href={result.citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link mt-4 w-full justify-center sm:w-auto"
          >
            <BookOpenCheck className="h-4 w-4" />
            <span>فتح المصدر</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {result.canonical_text && !isNotFound && (
        <div className="evidence-block">
          <div className="evidence-head">
            <div>
              <div className="eyebrow">الدليل</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                {cleanLabel(result.citation?.source_name)}
              </div>
            </div>
            <FileSearch className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>

          <div className="evidence-quote">«{(result.canonical_text || '').replace(/[\uFC00-\uFC6E]/g, '').trim()}»</div>

          <div className="evidence-meta">
            {result.citation?.book && <span>{cleanLabel(result.citation.book)}</span>}
            {result.citation?.number_or_page && <span>{cleanLabel(result.citation.number_or_page)}</span>}
            {result.citation?.grade && <span>{cleanLabel(result.citation.grade)}</span>}
          </div>
        </div>
      )}

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

            {result.diff && result.diff.length > 0 && (
              <div>
                <div className="eyebrow mb-2">الفروق</div>
                <WordDiffViewer diff={result.diff} canonicalText={result.canonical_text} />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};