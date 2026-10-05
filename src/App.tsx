/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Layers,
  BookOpenCheck,
  BarChart3,
  Scale,
  Menu,
  X,
  ArrowLeft,
  CircleHelp
} from 'lucide-react';

import { LandingPageView } from './components/LandingPageView.tsx';
import { VerifierView } from './components/VerifierView.tsx';
import { BenchmarkView } from './components/BenchmarkView.tsx';
import { SourceRegistryView } from './components/SourceRegistryView.tsx';
import { ExtensionSimulatorView } from './components/ExtensionSimulatorView.tsx';
import { GovernanceView } from './components/GovernanceView.tsx';
import { DawahStudioView } from './components/DawahStudioView.tsx';

type TabId =
  | 'verifier'
  | 'dawah'
  | 'extension'
  | 'sources'
  | 'benchmark'
  | 'governance';

const NAV_ITEMS: Array<{
  id: TabId;
  label: string;
  short: string;
  icon: React.ReactNode;
}> = [
  { id: 'verifier', label: 'فحص المحتوى', short: 'الفحص', icon: <ShieldCheck /> },
  { id: 'dawah', label: 'إعداد المحتوى', short: 'الإعداد', icon: <Sparkles /> },
  { id: 'extension', label: 'إضافة المتصفح', short: 'الإضافة', icon: <Layers /> },
  { id: 'sources', label: 'المراجع المعتمدة', short: 'المراجع', icon: <BookOpenCheck /> },
  { id: 'benchmark', label: 'قياس الجودة', short: 'الجودة', icon: <BarChart3 /> },
  { id: 'governance', label: 'الحوكمة', short: 'الحوكمة', icon: <Scale /> }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId | 'home'>('home');
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (tab: TabId | 'home') => {
    setActiveTab(tab);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeLabel =
    activeTab === 'home'
      ? 'الرئيسية'
      : NAV_ITEMS.find(item => item.id === activeTab)?.label || 'بصيرة';

  return (
    <div dir="rtl" className="min-h-screen bg-page text-ink">
      <header className="sticky top-0 z-50 border-b border-line/80 bg-page/92 backdrop-blur-xl">
        <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-[72px] items-center gap-4">
            <button
              type="button"
              onClick={() => go('home')}
              className="group flex min-w-0 items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              aria-label="العودة إلى الصفحة الرئيسية"
            >
              <span className="brand-mark" aria-hidden="true">
                <ShieldCheck className="h-5 w-5" strokeWidth={2.3} />
              </span>
              <span className="min-w-0 text-right">
                <span className="block truncate font-display text-[20px] font-bold leading-none tracking-tight">بصيرة</span>
                <span className="mt-1 hidden text-[11px] font-medium text-muted sm:block">تحقق. افهم. انشر بثقة.</span>
              </span>
            </button>

            <div className="hidden h-8 w-px bg-line lg:block" aria-hidden="true" />

            <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
              <button
                type="button"
                onClick={() => go('home')}
                className={`nav-link ${activeTab === 'home' ? 'nav-link-active' : ''}`}
                aria-current={activeTab === 'home' ? 'page' : undefined}
              >
                الرئيسية
              </button>
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`nav-link ${activeTab === item.id ? 'nav-link-active' : ''}`}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                >
                  <span className="nav-link-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mr-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-semibold text-muted xl:flex">
                <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                المراجع تُفحص عند الطلب
              </span>

              <button
                type="button"
                onClick={() => go('verifier')}
                className="btn btn-primary min-h-11 px-4 sm:px-5"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">ابدأ الفحص</span>
                <span className="sm:hidden">فحص</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileOpen(value => !value)}
                className="icon-btn lg:hidden"
                aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <nav className="mobile-nav lg:hidden" aria-label="التنقل على الهاتف">
              <button
                type="button"
                onClick={() => go('home')}
                className={`mobile-nav-link ${activeTab === 'home' ? 'mobile-nav-link-active' : ''}`}
              >
                الرئيسية
              </button>
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`mobile-nav-link ${activeTab === item.id ? 'mobile-nav-link-active' : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="nav-link-icon" aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </span>
                  {activeTab === item.id && <ArrowLeft className="h-4 w-4" />}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {activeTab !== 'home' && (
        <div className="mx-auto flex max-w-[1380px] items-center gap-2 px-4 pb-3 pt-4 text-xs text-muted sm:px-6 lg:px-8">
          <button type="button" onClick={() => go('home')} className="breadcrumb-link">
            الرئيسية
          </button>
          <ArrowLeft className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
          <span className="font-semibold text-ink">{activeLabel}</span>
        </div>
      )}

      <main className="min-h-[calc(100vh-72px)]">
        {activeTab === 'home' && <LandingPageView onNavigate={go} />}
        {activeTab === 'verifier' && <VerifierView />}
        {activeTab === 'dawah' && <DawahStudioView />}
        {activeTab === 'extension' && <ExtensionSimulatorView />}
        {activeTab === 'sources' && <SourceRegistryView />}
        {activeTab === 'benchmark' && <BenchmarkView />}
        {activeTab === 'governance' && <GovernanceView />}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1380px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="brand-mark brand-mark-small" aria-hidden="true">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-base font-bold">بصيرة</div>
                <div className="text-xs text-muted">أداة للتحقق من المحتوى الإسلامي قبل نشره.</div>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-xs leading-6 text-muted">
              تفهم بصيرة النص بمساعدة الذكاء الاصطناعي، ثم تربط النتيجة بالمراجع المعتمدة.
              دورها ليس إصدار فتوى من المعرفة العامة للنموذج، بل مساعدة المستخدم على الوصول إلى الأصل والتحقق منه.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-6 text-xs text-muted lg:justify-end">
            <div>
              <div className="mb-2 font-semibold text-ink">للمستخدم</div>
              <button type="button" className="footer-link" onClick={() => go('verifier')}>فحص نص</button>
              <button type="button" className="footer-link" onClick={() => go('dawah')}>إعداد محتوى</button>
            </div>
            <div>
              <div className="mb-2 font-semibold text-ink">للمهتمين</div>
              <button type="button" className="footer-link" onClick={() => go('sources')}>المراجع</button>
              <button type="button" className="footer-link" onClick={() => go('governance')}>الحوكمة</button>
            </div>
            <div>
              <div className="mb-2 font-semibold text-ink">المنهج</div>
              <button type="button" className="footer-link" onClick={() => go('benchmark')}>قياس الجودة</button>
              <button type="button" className="footer-link" onClick={() => go('extension')}>إضافة المتصفح</button>
            </div>
          </div>
        </div>
        <div className="border-t border-line/80">
          <div className="mx-auto flex max-w-[1380px] items-center gap-2 px-4 py-4 text-[11px] text-faint sm:px-6 lg:px-8">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>في المسائل الشخصية أو الحساسة، راجع أهل الاختصاص. بصيرة لا تستبدل الحكم الشرعي المؤهل.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
