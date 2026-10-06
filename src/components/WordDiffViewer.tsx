/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DiffWord } from '../types/baseera.ts';

interface WordDiffViewerProps {
  diff: DiffWord[];
  canonicalText?: string;
  /**
   * When true, repeats the full approved text under the comparison. Defaults to
   * false because the parent card already shows the approved text above, and
   * repeating it is redundant noise for the reader.
   */
  showCanonical?: boolean;
}

export const WordDiffViewer: React.FC<WordDiffViewerProps> = ({ diff, canonicalText, showCanonical = false }) => {
  if (!diff || diff.length === 0) return null;

  const hasChanges = diff.some(d => d.type === 'changed' || d.type === 'missing' || d.type === 'added');

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      {/* Title is rendered by the parent card; here we only show the legend. */}
      <div className="mb-3 grid gap-2 border-b border-line/60 pb-3 sm:grid-cols-2 sm:items-center">
        <span className="text-sm font-bold text-ink">مفتاح الألوان</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted sm:justify-end">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            مطابق
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-600" />
            مبدّل / دخيل
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            ساقط
          </span>
        </div>
      </div>

      {/* Comparison flow */}
      <div className="select-text rounded-xl border border-line bg-page-2 p-5 font-display text-2xl leading-[2.4] text-ink sm:text-[26px]">
        {diff.map((item, idx) => {
          if (item.type === 'equal') {
            return (
              <span key={idx} className="mx-1 font-semibold text-emerald-800">
                {item.word}{' '}
              </span>
            );
          }

          if (item.type === 'changed') {
            return (
              <span
                key={idx}
                className="mx-1 inline-flex flex-col items-center rounded-lg border border-rose-300 bg-rose-50 px-2 py-0.5 align-middle font-bold text-rose-800"
                title={`اللفظ غير مطابق. المعتمد في المصحف: ${item.expected || ''}`}
              >
                <span className="font-display text-[22px] line-through decoration-rose-500 decoration-2">{item.word}</span>
                {item.expected && (
                  <span className="font-display text-lg font-bold text-emerald-700">
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
                className="mx-1 inline-flex flex-col items-center rounded-lg border border-rose-300 bg-rose-50 px-2 py-0.5 align-middle font-bold text-rose-800"
                title="لفظ مبدّل أو دخيل غير موجود في هذا الموضع"
              >
                <span className="font-display text-[22px] line-through decoration-rose-500 decoration-2">{item.word}</span>
                <span className="font-sans text-[11px] font-semibold text-rose-600">دخيل</span>
              </span>
            );
          }

          if (item.type === 'missing') {
            return (
              <span
                key={idx}
                className="mx-1 inline-flex flex-col items-center rounded-lg border border-dashed border-amber-500 bg-amber-50 px-2 py-0.5 align-middle"
                title="لفظ ساقط من النص المعتمد"
              >
                <span className="font-display text-[22px] font-bold text-amber-800">{item.word}</span>
                <span className="font-sans text-[11px] font-semibold text-amber-700">ساقط</span>
              </span>
            );
          }

          return <span key={idx}>{item.word} </span>;
        })}
      </div>

      {showCanonical && canonicalText && hasChanges && (
        <div className="mt-4 border-t border-line/60 pt-3 text-sm text-muted">
          <span className="font-bold text-emerald-800">النص المعتمد في المصحف: </span>
          <span className="font-display text-lg font-bold text-ink">
            «{(canonicalText || '').replace(/[\u06DD\uFD3E\uFD3F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '').trim()}»
          </span>
        </div>
      )}
    </div>
  );
};
