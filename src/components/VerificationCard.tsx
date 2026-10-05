import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
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

export const VerificationCard: React.FC<VerificationCardProps> = ({
  result,
  index,
  viewMode = 'simple'
}) => {
  const [detailsOpen, setDetailsOpen] = useState(viewMode === 'detailed');

  useEffect(() => {
    setDetailsOpen(viewMode === 'detailed');
  }, [viewMode]);

  const isMatched = result.status === 'MATCHED';
  const isReview = result.status === 'NEEDS_REVIEW';
  const isReferral = result.status === 'REFER_TO_SPECIALIST';
  const isNotFound = result.status === 'NOT_FOUND_IN_CHECKED_SOURCES';

  const tone = result.finding_type === 'altered_quran_text' || isReview
    ? {
        icon: <AlertTriangle className="h-5 w-5" />,
        badge: 'status-badge status-review',
        panel: 'result-panel result-panel-review'
      }
    : isReferral
      ? {
          icon: <ShieldAlert className="h-5 w-5" />,
          badge: 'status-badge status-referral',
          panel: 'result-panel result-panel-referral'
        }
      : isNotFound
        ? {
            icon: <Info className="h-5 w-5" />,
            badge: 'status-badge status-neutral',
            panel: 'result-panel result-panel-neutral'
          }
        : {
            icon: <CheckCircle2 className="h-5 w-5" />,
            badge: 'status-badge status-matched',
            panel: 'result-panel result-panel-matched'
          };

  const typeLabel = {
    ayah: 'آية قرآنية',
    hadith: 'حديث أو رواية',
    term: 'مصطلح',
    fiqh_question: 'مسألة فقهية',
    tafsir_question: 'سؤال في التفسير',
    aqeedah_question: 'سؤال عقدي',
    claim: 'نص يحتاج تحققًا'
  }[result.item.type] || 'نص يحتاج تحققًا';

  return (
    <article className="verification-card">
      <div className="verification-card-top">
        <div className="flex items-center gap-2">
          <span className="item-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="text-xs font-bold text-muted">{typeLabel}</span>
        </div>
        {result.decision_level && (
          <span className="decision-chip">مستوى {result.decision_level}</span>
        )}
      </div>

      <div className={tone.panel}>
        <div className="flex items-start gap-3">
          <span className={`status-icon-wrap ${tone.badge}`} aria-hidden="true">
            {tone.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted">نتيجة الفحص</div>
            <h3 className="mt-1 text-lg font-bold leading-7 text-ink">
              {result.status_label_ar}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{result.reason}</p>
          </div>
        </div>

        {result.citation?.url && (
          <a
            href={result.citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link mt-4"
          >
            <BookOpenCheck className="h-4 w-4" />
            <span>فتح المرجع الأصلي</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {result.canonical_text && !isNotFound && (
        <div className="evidence-block">
          <div className="evidence-head">
            <div>
              <div className="eyebrow">الدليل من المصدر</div>
              <div className="mt-1 text-xs text-muted">
                {cleanLabel(result.citation?.source_name)}
                {result.citation?.book ? ` · ${cleanLabel(result.citation.book)}` : ''}
              </div>
            </div>
            <FileSearch className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>

          <div className="evidence-quote">
            «{result.canonical_text}»
          </div>

          {(result.citation?.number_or_page || result.citation?.grade) && (
            <div className="evidence-meta">
              {result.citation.number_or_page && <span>{result.citation.number_or_page}</span>}
              {result.citation.grade && <span>{result.citation.grade}</span>}
            </div>
          )}
        </div>
      )}

      {result.ai_match && (
        <div className="ai-note">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            المضاهاة بالذكاء الاصطناعي كانت للمساعدة في ترتيب المرشحات فقط؛
            النتيجة النهائية مرتبطة بالمصدر المرجعي.
          </span>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-page">
        <button
          type="button"
          onClick={() => setDetailsOpen(open => !open)}
          className="details-toggle"
          aria-expanded={detailsOpen}
        >
          <span className="flex items-center gap-2">
            {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {detailsOpen ? 'إخفاء التفاصيل' : 'عرض تفاصيل التحقق'}
          </span>
          <span className="text-[11px] text-faint">للقراء والباحثين</span>
        </button>

        {detailsOpen && (
          <div className="space-y-5 border-t border-line px-4 py-5 sm:px-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="detail-cell">
                <div className="detail-label">العنصر المدخل</div>
                <div className="detail-value">{result.item.text}</div>
              </div>
              <div className="detail-cell">
                <div className="detail-label">نوع المرجع</div>
                <div className="detail-value">{cleanLabel(result.citation?.source_name) || 'لم يُحدّد'}</div>
              </div>
            </div>

            {result.abstention_note && (
              <div className="notice-box">
                <Info className="h-4 w-4 shrink-0" />
                <span>{result.abstention_note}</span>
              </div>
            )}

            {result.diff && result.diff.length > 0 && (
              <div>
                <div className="eyebrow mb-2">مقارنة النص</div>
                <WordDiffViewer diff={result.diff} />
              </div>
            )}
          </div>
        )}
      </div>

      {result.status === 'MATCHED' && (
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold text-brand-strong">
          <CheckCircle2 className="h-3.5 w-3.5" />
          تم ربط هذه النتيجة بدليل مصدرّي قبل عرضها.
        </div>
      )}

      {result.status === 'REFER_TO_SPECIALIST' && (
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold text-indigo-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          الإحالة هنا جزء من سلامة الاستخدام، وليست نتيجة فشل.
        </div>
      )}
    </article>
  );
};
