/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header.tsx';
import { VerifierView } from './components/VerifierView.tsx';
import { BenchmarkView } from './components/BenchmarkView.tsx';
import { SourceRegistryView } from './components/SourceRegistryView.tsx';
import { ExtensionSimulatorView } from './components/ExtensionSimulatorView.tsx';
import { GovernanceView } from './components/GovernanceView.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'verifier' | 'benchmark' | 'sources' | 'extension' | 'governance'>('verifier');

  return (
    <div className="min-h-screen bg-islamic-pattern bg-[#070a11] text-slate-100 flex flex-col font-ibm selection:bg-emerald-600 selection:text-white">
      {/* Global Header & Brand Navigation (3-Zone Top Bar Contract) */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Viewport */}
      <main className="flex-1">
        {activeTab === 'verifier' && <VerifierView />}
        {activeTab === 'benchmark' && <BenchmarkView />}
        {activeTab === 'extension' && <ExtensionSimulatorView />}
        {activeTab === 'sources' && <SourceRegistryView />}
        {activeTab === 'governance' && <GovernanceView />}
      </main>

      {/* Global Editorial Footer */}
      <footer className="border-t border-white/[0.06] bg-[#05080e] py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[10px] font-bold">
              ب
            </div>
            <span className="font-semibold text-slate-300">بصيرة · Baseera</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-400">تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي — المسار الرابع</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-400">
            <span>القاعدة الحاكمة: النموذج يستخرج ويقترح، والمصدر المعتمد هو الذي يثبت ويحكم.</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-emerald-400 font-semibold font-mono-numbers">معدل التأكيد الخاطئ (FCR) = 0.0%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
