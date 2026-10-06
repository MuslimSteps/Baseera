/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import registryData from '../../sources/source-registry.json' with { type: 'json' };

const OFFICIAL_URLS: Record<string, string> = {
  'quran-uthmani': 'https://qurancomplex.gov.sa/',
  'quran-translations': 'https://quranpedia.net/',
  'quran-tafsir-salaf': 'https://dorar.net/tafseer',
  'dorar-aqeedah': 'https://dorar.net/aqeeda',
  'dorar-hadith': 'https://dorar.net/hadith',
  'shamela-sunnah': 'https://shamela.ws/',
  'jamhara-terms': 'https://islamic-content.com/dictionary',
  'fiqh-madhahib-dorar': 'https://dorar.net/feqhia',
  'dawa-center': 'https://dawa.center/'
};

const CATEGORY_LABELS: Record<string, string> = {
  quran: 'القرآن الكريم',
  quran_translations: 'ترجمات معاني القرآن',
  tafsir: 'التفسير',
  aqeedah: 'العقيدة',
  hadith: 'الحديث',
  terminology: 'المصطلحات',
  fiqh: 'الفقه',
  dawah: 'المحتوى الدعوي'
};

export const SourceRegistryView: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState(registryData.sources[0]);

  const sourceUrl =
    OFFICIAL_URLS[selectedSource.id] ||
    (selectedSource as any).official_url ||
    'https://dorar.net/';

  return (
    <div className="page-shell source-page mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="source-hero">
        <div className="source-hero-copy">
          <div className="source-kicker">
            <span className="source-kicker-mark" aria-hidden="true">
              <BookOpenCheck className="h-4 w-4" />
            </span>
            المراجع المعتمدة
          </div>
          <h1 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            مصادر بصيرة
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">
            هذه هي المراجع التي ترجع إليها بصيرة عند فحص المحتوى. اختر مرجعًا لمعرفة نطاقه، ثم افتح المصدر نفسه للمراجعة.
          </p>
        </div>

        <div className="source-principle">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <strong>المصدر قبل الحكم</strong>
            <p>الذكاء الاصطناعي يساعد في العثور على المادة وترتيبها؛ المرجع المعتمد هو أساس النتيجة.</p>
          </div>
        </div>
      </section>

      <div className="source-layout">
        <section aria-labelledby="approved-sources-title" className="source-list-panel">
          <div className="source-list-heading">
            <div>
              <h2 id="approved-sources-title" className="font-display text-xl font-bold text-ink">
                المراجع التي تعتمد عليها بصيرة
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted">
                {registryData.sources.length} مراجع منظمة حسب نوع المعرفة.
              </p>
            </div>
            <span className="source-count">{registryData.sources.length}</span>
          </div>

          <div className="source-list">
            {registryData.sources.map((source) => {
              const active = selectedSource.id === source.id;
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSelectedSource(source)}
                  aria-pressed={active}
                  className={`source-item ${active ? 'source-item-active' : ''}`}
                >
                  <span className="source-item-icon" aria-hidden="true">
                    <BookOpenCheck className="h-4 w-4" />
                  </span>
                  <span className="source-item-copy">
                    <span className="source-item-category">
                      {CATEGORY_LABELS[source.category] || 'مرجع معتمد'}
                    </span>
                    <strong>{source.name_ar}</strong>
                    <small>{source.authority}</small>
                  </span>
                  <span className="source-item-check" aria-hidden="true">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="source-detail-panel" aria-labelledby="selected-source-title">
          <div className="source-detail-top">
            <span className="source-detail-badge">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              مرجع معتمد
            </span>
            <span className="source-detail-category">
              {CATEGORY_LABELS[selectedSource.category] || 'مرجع معتمد'}
            </span>
          </div>

          <h2 id="selected-source-title" className="mt-4 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {selectedSource.name_ar}
          </h2>
          <p className="mt-2 text-sm font-semibold text-brand-strong">
            {selectedSource.authority}
          </p>

          <div className="source-detail-grid">
            <div className="source-info-card">
              <span>ماذا يغطي هذا المرجع؟</span>
              <strong>{selectedSource.scope}</strong>
            </div>
            <div className="source-info-card">
              <span>كيف تستخدمه بصيرة؟</span>
              <strong>{selectedSource.rules}</strong>
            </div>
          </div>

          <div className="source-detail-footer">
            <div>
              <span className="source-meta-label">طريقة الوصول</span>
              <strong>{selectedSource.access_method}</strong>
            </div>
            <div>
              <span className="source-meta-label">آخر اعتماد</span>
              <strong>{selectedSource.access_date || 'ضمن السجل الحالي'}</strong>
            </div>
          </div>

          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="source-open-btn"
          >
            <span>فتح المرجع الرسمي</span>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </section>
      </div>

      <p className="source-page-note">
        المرجع المختار هو الذي يظهر للمستخدم مع النتيجة عند توفر دليل مطابق.
      </p>
    </div>
  );
};
