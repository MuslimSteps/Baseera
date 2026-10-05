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
  CircleHelp,
  ChevronDown
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
              {NAV_ITEMS.filter(item => ['verifier','dawah','extension','sources'].includes(item.id)).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`nav-link ${activeTab === item.id ? 'nav-link-active' : ''}`}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mr-auto flex items-center gap-2">
               {activeTab !== 'verifier' && <button
                type="button"
                onClick={() => go('verifier')}
                className="btn btn-primary min-h-11 px-4 sm:px-5"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">ابدأ الفحص</span>
                <span className="sm:hidden">فحص</span>
              </button>}

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

      {activeTab !== 'home' && activeTab !== 'verifier' && (
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
        <div className="mx-auto flex max-w-[980px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <span className="brand-mark brand-mark-small" aria-hidden="true">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <div className="font-display text-base font-bold">بصيرة</div>
              <div className="text-xs text-muted">تحقق من المحتوى وارجع إلى المصدر.</div>
            </div>
          </div>
          <button type="button" className="footer-link !min-h-9 !py-1" onClick={() => go('sources')}>
            المراجع المعتمدة
          </button>
        </div>
      </footer>
    </div>
  );
}
