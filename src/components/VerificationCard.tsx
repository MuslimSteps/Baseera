import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  ShieldAlert,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { VerificationResult } from '../types/baseera.ts';
import { WordDiffViewer } from './WordDiffViewer.tsx';

interface VerificationCardProps {
  result: VerificationResult;
  index: number;
  viewMode?: 'simple' | 'detailed';
}

export const VerificationCard: React.FC<VerificationCardProps> = ({ result, index, viewMode = 'simple' }) => {
  const [showDetails, setShowDetails] = useState(viewMode === 'detailed');

  useEffect(() => {
    setShowDetails(viewMode === 'detailed');
  }, [viewMode]);

  const {
    item,
    status,
    status_label_ar,
    reason,
    citation,
    canonical_text,
    verified_translation,
    diff,
    reduction_warning,
    jamhara_definition,
    school_positions,
    abstention_note,
    decision_level
  } = result;

  // Status visual attributes
  const getStatusTheme = () => {
    switch (status) {
      case 'MATCHED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-950/20',
          badgeText: status_label_ar,
          leftBorder: 'border-r-4 border-r-emerald-500'
        };
      case 'NEEDS_REVIEW':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          textColor: 'text-amber-400',
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-950/20',
          badgeText: status_label_ar,
          leftBorder: 'border-r-4 border-r-amber-500'
        };
      case 'REFER_TO_SPECIALIST':
        return {
          icon: <ArrowUpRight className="w-5 h-5 text-indigo-400 shrink-0" />,
          textColor: 'text-indigo-400',
          borderColor: 'border-indigo-500/30',
          bgColor: 'bg-indigo-950/20',
          badgeText: status_label_ar,
          leftBorder: 'border-r-4 border-r-indigo-500'
        };
      case 'NOT_FOUND_IN_CHECKED_SOURCES':
      default:
        return {
          icon: <HelpCircle className="w-5 h-5 text-muted shrink-0" />,
          textColor: 'text-muted',
          borderColor: 'border-hairline',
          bgColor: 'bg-slate-900/40',
          badgeText: status_label_ar,
          leftBorder: 'border-r-4 border-r-slate-500'
        };
    }
  };

  const statusTheme = getStatusTheme();

  const getTypeLabel = () => {
    switch (item.type) {
      case 'ayah':
        return (item.context && (item.context.includes('تعالى') || item.context.includes('لقوله')))
          ? 'آية مقتبسة داخل سياق النص'
          : 'آية قرآنية';
      case 'hadith':
        return item.text.length > 50 ? 'متن الرواية / الأثر المنقول' : 'حديث نبوي';
      case 'term': return 'مصطلح إسلامي (الجمهرة)';
      case 'fiqh_question': return 'مسألة فقهية';
      default: return 'استشهاد منقول';
    }
  };

  const getDecisionLevelLabel = (level?: string) => {
    if (!level) return null;
    switch (level) {
      case 'A': return 'مصدر نصي قطعي';
      case 'B': return 'مصدر حديثي موثق';
      case 'C': return 'مصدر فقهي اجتهادي';
      default: return null;
    }
  };

  // Strip Arabic diacritics and surah prefix from names like "سُورَةُ التَّغَابُنِ" → "التغابن"
  const cleanSurahName = (raw?: string) => {
    if (!raw) return raw;
    return raw
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '') // diacritics + tatweel
      .replace(/^سورة\s*/u, '')
      .trim();
  };

  return (
    <div className={`bento-card border border-hairline p-5 shadow-lg reveal ${statusTheme.leftBorder} space-y-4`}>
      {/* 1. Header: Element Number & Classification */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-hairline text-xs">
        <div className="flex items-center gap-2 text-muted">
          <span className="font-bold text-ink bg-white/[0.05] px-2 py-0.5 rounded-md">عنصر {index + 1}</span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span className="text-gold font-semibold">{getTypeLabel()}</span>
        </div>

        {decision_level && getDecisionLevelLabel(decision_level) && (
          <span className="text-[11px] text-muted bg-black/30 px-2 py-0.5 rounded border border-hairline">
            {getDecisionLevelLabel(decision_level)}
          </span>
        )}
      </div>

      {/* 2. Direct Simple Verdict Card (للمستخدم العامي: حكم واضح ومباشر في سطرين) */}
      <div className={`p-4 rounded-xl border ${statusTheme.borderColor} ${statusTheme.bgColor} space-y-3`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{statusTheme.icon}</div>
          <div className="flex-1 space-y-1">
            <div className="text-xs text-muted font-medium">النتيجة والخلاصة المعتمدة:</div>
            <div className={`text-base font-bold font-display ${statusTheme.textColor} leading-normal`}>
              {statusTheme.badgeText}
            </div>
            {citation && (
              <div className="text-xs text-ink/85 flex flex-wrap items-center gap-2 pt-1">
                <span className="font-semibold text-muted">المصدر المعتمد:</span>
                <span className="text-white font-medium">{citation.source_name}</span>
                {citation.book && (
                  <>
                    <span className="text-faint">·</span>
                    <span className="text-ink/85">{cleanSurahName(citation.book)}</span>
                  </>
                )}
                {citation.number_or_page && (
                  <>
                    <span className="text-faint">·</span>
                    <span className="text-muted font-mono-numbers">{citation.number_or_page}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {citation?.url && (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-gold-strong hover:text-white text-gold-soft text-xs font-semibold inline-flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
              title="فتح الرابط في منصة المرجع الرسمية"
            >
              <span>توثيق السند</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Canonical Text: Always clearly shown */}
        {canonical_text && status !== 'NOT_FOUND_IN_CHECKED_SOURCES' && (
          <div className="pt-2 border-t border-hairline">
            <div className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{item.type === 'fiqh_question' ? 'النص الفقهي المرجعي من المصدر المعتمد:' : 'النص الصحيح المعتمد في المرجع:'}</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-hairline font-amiri text-lg text-emerald-100 leading-relaxed select-text">
              «{canonical_text}»
            </div>
          </div>
        )}
      </div>

      {/* 3. Expandable Academic Investigation (للمحكّمين والباحثين) */}
      <div className="pt-1">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-2 px-3 rounded-xl bg-black/30 hover:bg-white/[0.04] border border-hairline flex items-center justify-between text-xs text-ink/85 font-medium transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{showDetails ? 'إخفاء التحقيق العلمي ومقارنة الألفاظ' : 'عرض التحقيق العلمي ومقارنة الألفاظ الدقيقة (للمحكّمين)'}</span>
          </span>
          {showDetails ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-hairline space-y-4">
            {/* Raw Input as received */}
            <div>
              <div className="text-xs text-muted mb-1.5 font-medium">النص المنقول المفحوص (كما ورد بالمدخل):</div>
              <div className="p-3 rounded-lg bg-black/50 border border-hairline font-amiri text-base text-ink/85 leading-relaxed select-text">
                «{item.text}»
              </div>
              {item.claimed_source && (
                <div className="text-xs text-muted mt-2 flex items-center gap-1.5">
                  <span>العزو المذكور في المدخل:</span>
                  <span className="text-ink font-medium">{item.claimed_source}</span>
                </div>
              )}
            </div>

            {/* Word-level diff viewer if discrepancy found */}
            {diff && diff.length > 0 && (
              <WordDiffViewer diff={diff} canonicalText={canonical_text} />
            )}

            {/* Verified Translation if available */}
            {verified_translation && (
              <div className="p-3 rounded-lg bg-black/30 border border-hairline text-xs text-ink/85 leading-relaxed font-sans">
                <span className="text-muted font-semibold block mb-1">الترجمة المعتمدة (مجمع الملك فهد / الجمهرة):</span>
                <p className="italic text-ink/85">"{verified_translation}"</p>
              </div>
            )}

            {/* Jamhara Contextual Definition for Terms */}
            {jamhara_definition && (
              <div className="p-3.5 rounded-lg bg-sky-950/20 border border-sky-500/20 text-xs text-sky-200 leading-relaxed">
                <span className="text-sky-300 font-bold block mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  السياق الاصطلاحي المعتمد في موسوعة الجمهرة:
                </span>
                <p className="text-sky-100/90 leading-normal">{jamhara_definition}</p>
              </div>
            )}

            {/* Reductionist Warning Alert */}
            {reduction_warning && (
              <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block mb-0.5">تنبيه سياقي: رصد اختزال أو تشويه للمصطلح:</strong>
                  <p className="text-amber-100/90">{reduction_warning}</p>
                </div>
              </div>
            )}

            {/* Four Madhhabs Scholarly Differences View */}
            {school_positions && school_positions.length > 0 && (
              <div className="border border-hairline rounded-lg overflow-hidden text-xs">
                <div className="bg-slate-900/90 px-3.5 py-2.5 font-semibold text-ink flex items-center gap-1.5 border-b border-hairline">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>أقوال أئمة المذاهب الأربعة المعتمدة (عرض مقارن حيادي دون ترجيح آلي):</span>
                </div>
                <div className="divide-y divide-hairline bg-black/20">
                  {school_positions.map((pos, pIdx) => (
                    <div key={pIdx} className="p-3">
                      <span className="font-bold text-ink block mb-0.5">{pos.school}:</span>
                      <span className="text-muted leading-relaxed">{pos.ruling}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Abstention Statement */}
            {abstention_note && (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-hairline text-xs text-ink/85 flex items-start gap-2">
                <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                <div>
                  <strong className="text-ink block mb-0.5">بيان الامتناع الشرعي:</strong>
                  <p className="text-muted">{abstention_note}</p>
                </div>
              </div>
            )}

            {/* Verification Explanation */}
            <div className="pt-2 text-xs text-ink/85 leading-relaxed">
              <span className="font-semibold text-muted block mb-1">بيان الفحص والتخريج الموسع:</span>
              <p className="text-ink/85 leading-relaxed">{reason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

