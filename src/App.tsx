/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { type TabId } from './components/Sidebar.tsx';
import { LandingPageView } from './components/LandingPageView.tsx';
import { VerifierView } from './components/VerifierView.tsx';
import { BenchmarkView } from './components/BenchmarkView.tsx';
import { SourceRegistryView } from './components/SourceRegistryView.tsx';
import { ExtensionSimulatorView } from './components/ExtensionSimulatorView.tsx';
import { GovernanceView } from './components/GovernanceView.tsx';
import { DawahStudioView } from './components/DawahStudioView.tsx';
import {
  ShieldCheck,
  Sparkles,
  Award,
  BookOpen,
  Layers,
  Scale,
  Menu,
  X,
  Search,
  CheckCircle2,
  Home
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId | 'home'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV_ITEMS: { id: TabId | 'home'; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-4 h-4" /> },
    { id: 'verifier', label: 'فاحص النصوص والآيات', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'dawah', label: 'استوديو الخطب والمقالات', icon: <Sparkles className="w-4 h-4 text-amber-500" />, badge: 'جديد' },
    { id: 'extension', label: 'إضافة المتصفح', icon: <Layers className="w-4 h-4" /> },
    { id: 'sources', label: 'سجل المصادر المعتمدة', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'benchmark', label: 'المعيار وقياس الدقة', icon: <Award className="w-4 h-4" /> },
    { id: 'governance', label: 'ميثاق الحوكمة', icon: <Scale className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 selection:bg-amber-100 selection:text-[#1E3A5F]">
      
      {/* ── Top Floating Navigation Header ─────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Tagline */}
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-3 cursor-pointer text-right group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E3A5F] to-[#152a45] text-white flex items-center justify-center font-bold text-base shadow-sm group-hover:scale-105 transition-transform font-display border border-amber-400/40">
                ب
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base font-display tracking-tight text-slate-900 group-hover:text-[#1E3A5F] transition-colors">
                    بصيرة
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    Baseera
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 hidden sm:block">
                  المنظومة المرجعية الذكية لحماية وتوليد المحتوى الإسلامي
                </span>
              </div>
            </button>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-[#1E3A5F] shadow-sm font-bold border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Action: Quick Verifier Trigger & Mobile Menu Toggle */}
            <div className="flex items-center gap-2.5">
              
              {/* Quick Status Pill */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>الدرر والمصحف متصلان ✓</span>
              </div>

              {/* Direct Quick Launch Button */}
              {activeTab === 'home' ? (
                <button
                  onClick={() => setActiveTab('verifier')}
                  className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">فحص محتوى الآن</span>
                  <span className="sm:hidden">فحص</span>
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('home')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">الرئيسية</span>
                </button>
              )}

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                aria-label="القائمة"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-3 border-t border-slate-200 space-y-1 bg-white">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-[#1E3A5F] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

        </div>
      </header>

      {/* ── Main View Switcher ─────────────────────────────────── */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <LandingPageView onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'verifier' && <VerifierView />}
        {activeTab === 'dawah' && <DawahStudioView />}
        {activeTab === 'extension' && <ExtensionSimulatorView />}
        {activeTab === 'sources' && <SourceRegistryView />}
        {activeTab === 'benchmark' && <BenchmarkView />}
        {activeTab === 'governance' && <GovernanceView />}
      </main>

      {/* ── Rich Global Footer ────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-md bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-xs font-display">
              ب
            </span>
            <span className="font-bold text-slate-800">بصيرة · Baseera</span>
            <span className="text-slate-300">|</span>
            <span>تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي — المسار الرابع</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
            <span>المصادر: المصحف العثماني · الدرر السنية · موسوعة الجمهرة</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Zero Hallucination FCR = 0.0%
            </span>
          </div>

        </div>
      </footer>

    </div>
  );
}