/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DiffWord } from '../types/baseera.ts';

interface WordDiffViewerProps {
  diff: DiffWord[];
  canonicalText?: string;
}

export const WordDiffViewer: React.FC<WordDiffViewerProps> = ({ diff, canonicalText }) => {
  if (!diff || diff.length === 0) return null;

  const hasChanges = diff.some(d => d.type === 'changed' || d.type === 'missing');

  return (
    <div className="mt-4 p-4 rounded-xl bg-[#090e18] border border-white/[0.08] text-sm">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3 text-xs">
        <span className="font-semibold text-slate-300">
          تحليل الفوارق اللفظية مقارنة بالمصدر المعتمد:
        </span>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            لفظ مطابق
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            لفظ مبدّل / دخيل
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            لفظ ساقط
          </span>
        </div>
      </div>

      {/* Manuscript Flow */}
      <div className="font-amiri text-xl leading-loose text-slate-200 select-text p-3 rounded-lg bg-black/30 border border-white/[0.04]">
        {diff.map((item, idx) => {
          if (item.type === 'equal') {
            return (
              <span key={idx} className="hover:text-emerald-300 transition-colors mx-0.5">
                {item.word}{' '}
              </span>
            );
          }

          if (item.type === 'changed') {
            return (
              <span
                key={idx}
                className="inline-flex flex-col items-center mx-1 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-200 align-middle"
                title={`اللفظ المنقول غير مطابق. المعتمد: ${item.expected || ''}`}
              >
                <span className="line-through decoration-rose-400 decoration-2">{item.word}</span>
                {item.expected && (
                  <span className="text-xs font-tajawal text-emerald-400 font-semibold tracking-wide mt-0.5">
                    ({item.expected})
                  </span>
                )}
              </span>
            );
          }

          if (item.type === 'missing') {
            return (
              <span
                key={idx}
                className="inline-block mx-1 px-1.5 py-0.5 rounded bg-amber-950/50 border border-dashed border-amber-500/60 text-amber-300 text-base"
                title="لفظ مفقود من النص المنقول"
              >
                + {item.word}
              </span>
            );
          }

          return <span key={idx}>{item.word} </span>;
        })}
      </div>

      {canonicalText && hasChanges && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] text-xs text-slate-400">
          <strong className="text-emerald-400 ml-1">النص المعتمد الكامل في المصدر:</strong>
          <span className="font-amiri text-base text-slate-300">«{canonicalText}»</span>
        </div>
      )}
    </div>
  );
};
