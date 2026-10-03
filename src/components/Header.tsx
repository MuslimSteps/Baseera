/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Award, BookOpen, Layers, Scale, Download } from 'lucide-react';

interface HeaderProps {
  activeTab: 'verifier' | 'benchmark' | 'sources' | 'extension' | 'governance';
  setActiveTab: (tab: 'verifier' | 'benchmark' | 'sources' | 'extension' | 'governance') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'verifier', label: 'فاحص المحتوى', icon: ShieldCheck },
    { id: 'benchmark', label: 'لوحة القياس (Benchmark)', icon: Award },
    { id: 'extension', label: 'إضافة المتصفح', icon: Layers },
    { id: 'sources', label: 'سجل المصادر المعتمدة', icon: BookOpen },
    { id: 'governance', label: 'الحوكمة والضوابط', icon: Scale },
  ] as const;

  return (
    <header className="border-b border-white/[0.08] bg-[#070a11]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Wordmark (Single Text Element with Geometric Seal) */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <span className="font-tajawal font-bold text-lg leading-none">ب</span>
            </div>
            <a
              href="#home"
              onClick={(e) => { e.preventDefault(); setActiveTab('verifier'); }}
              className="group flex items-baseline gap-2 cursor-pointer select-none"
            >
              <span className="text-xl font-bold font-tajawal tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                بصيرة
              </span>
              <span className="text-xs font-cinzel font-medium tracking-widest text-emerald-400/90 uppercase">
                Baseera
              </span>
            </a>
          </div>

          {/* Zone 2: Clean Text Navigation Links (Single-Line, Anti-Pill) */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-md transition-all whitespace-nowrap flex items-center gap-2 relative ${
                    isActive
                      ? 'text-emerald-400 font-semibold bg-emerald-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-3 h-[2px] bg-emerald-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1-2 Primary Actions */}
          <div className="flex items-center gap-3">
            <a
              href="/baseera-extension.zip"
              download="baseera-extension.zip"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-950 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل الإضافة (.ZIP)</span>
            </a>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-white/[0.05] scrollbar-none text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'text-emerald-400 font-semibold bg-emerald-950/50 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
