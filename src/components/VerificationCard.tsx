/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  ShieldAlert,
  Info,
  Layers
} from 'lucide-react';
import { VerificationResult } from '../types/baseera.ts';
import { WordDiffViewer } from './WordDiffViewer.tsx';

interface VerificationCardProps {
  result: VerificationResult;
  index: number;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({ result, index }) => {
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
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          badgeText: status_label_ar,
          leftBorder: 'border-r-2 border-r-emerald-500'
        };
      case 'NEEDS_REVIEW':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
          textColor: 'text-amber-400',
          borderColor: 'border-amber-500/30',
          badgeText: status_label_ar,
          leftBorder: 'border-r-2 border-r-amber-500'
        };
      case 'REFER_TO_SPECIALIST':
        return {
          icon: <ArrowUpRight className="w-4 h-4 text-indigo-400 shrink-0" />,
          textColor: 'text-indigo-400',
          borderColor: 'border-indigo-500/30',
          badgeText: status_label_ar,
          leftBorder: 'border-r-2 border-r-indigo-500'
        };
      case 'NOT_FOUND_IN_CHECKED_SOURCES':
      default:
        return {
          icon: <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />,
          textColor: 'text-slate-400',
          borderColor: 'border-white/10',
          badgeText: status_label_ar,
          leftBorder: 'border-r-2 border-r-slate-500'
        };
    }
  };

  const statusTheme = getStatusTheme();

  const getTypeLabel = () => {
    switch (item.type) {
      case 'ayah': return 'آية قرآنية';
      case 'hadith': return 'حديث نبوي';
      case 'term': return 'مصطلح إسلامي';
      case 'fiqh_question': return 'مسألة فقهية';
      default: return 'استشهاد منقول';
    }
  };

  return (
    <div className={`rounded-xl bg-[#0b101b] border border-white/[0.08] p-5 shadow-md ${statusTheme.leftBorder}`}>
      {/* Top Editorial Row (Zero-Pill Discipline) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06] text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="font-semibold text-slate-200">عنصر {index + 1}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-emerald-400/90 font-medium">{getTypeLabel()}</span>
          {decision_level && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400">مستوى الحوكمة: {decision_level}</span>
            </>
          )}
        </div>

        <div className={`flex items-center gap-1.5 font-semibold ${statusTheme.textColor}`}>
          {statusTheme.icon}
          <span>{statusTheme.badgeText}</span>
        </div>
      </div>

      {/* Input Text Section */}
      <div className="mt-4">
        <div className="text-xs text-slate-400 mb-1.5 font-medium">النص المنقول المفحوص:</div>
        <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.05] font-amiri text-lg text-slate-200 leading-relaxed">
          «{item.text}»
        </div>
        {item.claimed_source && (
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span>العزو المذكور في المدخل:</span>
            <span className="text-slate-200 font-medium">{item.claimed_source}</span>
          </div>
        )}
      </div>

      {/* Word-level diff viewer if discrepancy found */}
      {diff && diff.length > 0 && (
        <WordDiffViewer diff={diff} canonicalText={canonical_text} />
      )}

      {/* Canonical Text in Approved Source */}
      {canonical_text && status !== 'NOT_FOUND_IN_CHECKED_SOURCES' && !diff?.length && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>النص المعتمد في المرجع المفحوص:</span>
          </div>
          <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 font-amiri text-lg text-emerald-200 leading-relaxed">
            «{canonical_text}»
          </div>
        </div>
      )}

      {/* Verified Translation if available */}
      {verified_translation && (
        <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/[0.05] text-xs text-slate-300 leading-relaxed font-sans">
          <span className="text-slate-400 font-semibold block mb-1">الترجمة المعتمدة (مجمع الملك فهد / الجمهرة):</span>
          <p className="italic text-slate-300">"{verified_translation}"</p>
        </div>
      )}

      {/* Jamhara Contextual Definition for Terms */}
      {jamhara_definition && (
        <div className="mt-4 p-3.5 rounded-lg bg-sky-950/20 border border-sky-500/20 text-xs text-sky-200 leading-relaxed">
          <span className="text-sky-300 font-bold block mb-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            السياق الاصطلاحي المعتمد في موسوعة الجمهرة:
          </span>
          <p className="text-sky-100/90 leading-normal">{jamhara_definition}</p>
        </div>
      )}

      {/* Reductionist Warning Alert */}
      {reduction_warning && (
        <div className="mt-3 p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300 block mb-0.5">تنبيه سياقي: رصد اختزال أو تشويه للمصطلح:</strong>
            <p className="text-amber-100/90">{reduction_warning}</p>
          </div>
        </div>
      )}

      {/* Four Madhhabs Scholarly Differences View */}
      {school_positions && school_positions.length > 0 && (
        <div className="mt-4 border border-white/[0.08] rounded-lg overflow-hidden text-xs">
          <div className="bg-slate-900/90 px-3.5 py-2.5 font-semibold text-slate-200 flex items-center gap-1.5 border-b border-white/[0.06]">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>أقوال أئمة المذاهب الأربعة المعتمدة (عرض مقارن حيادي دون ترجيح آلي):</span>
          </div>
          <div className="divide-y divide-white/[0.05] bg-black/20">
            {school_positions.map((pos, pIdx) => (
              <div key={pIdx} className="p-3">
                <span className="font-bold text-slate-200 block mb-0.5">{pos.school}:</span>
                <span className="text-slate-400 leading-relaxed">{pos.ruling}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abstention Statement */}
      {abstention_note && (
        <div className="mt-3 p-3 rounded-lg bg-slate-900/60 border border-white/[0.08] text-xs text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-200 block mb-0.5">بيان الامتناع:</strong>
            <p className="text-slate-400">{abstention_note}</p>
          </div>
        </div>
      )}

      {/* Verification Explanation */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs text-slate-300 leading-relaxed">
        <span className="font-semibold text-slate-400 block mb-1">بيان الفحص والتخريج:</span>
        <p className="text-slate-300">{reason}</p>
      </div>

      {/* Official Citation Footer */}
      {citation && (
        <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-emerald-400">المرجع:</span>
            <span className="text-slate-200">{citation.source_name}</span>
            {citation.book && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-300">{citation.book}</span>
              </>
            )}
            {citation.number_or_page && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400 font-mono-numbers">{citation.number_or_page}</span>
              </>
            )}
            {citation.grade && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-amber-400 font-medium">الدرجة: {citation.grade}</span>
              </>
            )}
          </div>

          {citation.url && (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-medium transition-colors"
            >
              <span>توثيق السند</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};
