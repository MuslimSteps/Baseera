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

  const hasChanges = diff.some(d => d.type === 'changed' || d.type === 'missing' || d.type === 'added');

  return (
    <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-white text-sm shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3 text-xs">
        <span className="font-semibold text-slate-800">
          تحليل الفوارق اللفظية مقارنة بالمصدر المعتمد:
        </span>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            لفظ مطابق
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            لفظ مبدّل / دخيل
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            لفظ ساقط
          </span>
        </div>
      </div>

      {/* Manuscript Flow */}
      <div className="font-display text-xl leading-loose select-text p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900">
        {diff.map((item, idx) => {
          if (item.type === 'equal') {
            return (
              <span key={idx} className="text-emerald-700 font-semibold mx-1 inline-block">
                {item.word}{' '}
              </span>
            );
          }

          if (item.type === 'changed') {
            return (
              <span
                key={idx}
                className="inline-flex flex-col items-center mx-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-bold align-middle shadow-xs"
                title={`اللفظ غير مطابق. المعتمد في المصحف: ${item.expected || ''}`}
              >
                <span className="line-through decoration-rose-500 decoration-2">{item.word}</span>
                {item.expected && (
                  <span className="text-xs font-semibold text-emerald-700 mt-0.5">
                    ({item.expected})
                  </span>
                )}
              </span>
            );
          }

          if (item.type === 'added') {
            return (
              <span
                key={idx}
                className="inline-flex flex-col items-center mx-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-bold align-middle shadow-xs"
                title="لفظ مبدّل أو دخيل غير موجود في هذا الموضع"
              >
                <span className="line-through decoration-rose-500 decoration-2">{item.word}</span>
                <span className="text-[11px] font-sans text-rose-600 mt-0.5">
                  (لفظ مبدّل / دخيل)
                </span>
              </span>
            );
          }

          if (item.type === 'missing') {
            return (
              <span
                key={idx}
                className="inline-block mx-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-dashed border-amber-400 text-amber-800 font-semibold text-base align-middle shadow-xs"
                title="لفظ ساقط من النص المعتمد"
              >
                + {item.word}
              </span>
            );
          }

          return <span key={idx}>{item.word} </span>;
        })}
      </div>

      {canonicalText && hasChanges && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
          <strong className="text-emerald-700 font-semibold ml-1">النص المعتمد في المصحف:</strong>
          <span className="font-display text-base text-slate-800 font-bold">
            «{(canonicalText || '').replace(/[\uFC00-\uFC6E]/g, '').trim()}»
          </span>
        </div>
      )}
    </div>
  );
};
