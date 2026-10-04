/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar, type TabId } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { VerifierView } from './components/VerifierView.tsx';
import { BenchmarkView } from './components/BenchmarkView.tsx';
import { SourceRegistryView } from './components/SourceRegistryView.tsx';
import { ExtensionSimulatorView } from './components/ExtensionSimulatorView.tsx';
import { GovernanceView } from './components/GovernanceView.tsx';
import { DawahStudioView } from './components/DawahStudioView.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('verifier');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen aurora-bg text-ink">
      {/* Ambient aurora glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <span className="glow-blob left-[-6rem] top-[-6rem] h-80 w-80 bg-ai/25" />
        <span className="glow-blob right-[-4rem] top-24 h-72 w-72 bg-gold/20" style={{ animationDelay: '2s' }} />
        <span className="glow-blob bottom-[-6rem] left-1/3 h-80 w-80 bg-brand/20" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar (RTL: rendered on the right) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar activeTab={activeTab} setActiveTab={setActiveTab} onMenuClick={() => setMobileNavOpen(true)} />

          <main id="main-content" className="flex-1">
            {activeTab === 'verifier' && <VerifierView />}
            {activeTab === 'dawah' && <DawahStudioView />}
            {activeTab === 'benchmark' && <BenchmarkView />}
            {activeTab === 'extension' && <ExtensionSimulatorView />}
            {activeTab === 'sources' && <SourceRegistryView />}
            {activeTab === 'governance' && <GovernanceView />}
          </main>

          <footer className="border-t border-hairline bg-canvas-2/60 px-4 py-5 text-xs text-faint sm:px-6">
            <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md border border-gold/40 text-gold font-display text-xs font-bold">ب</span>
                <span className="font-semibold text-muted">بصيرة · Baseera</span>
                <span aria-hidden="true">·</span>
                <span>تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي — المسار الرابع</span>
              </div>
              <div className="flex items-center gap-3">
                <span>النموذج يستخرج ويقترح، والمصدر المعتمد هو الذي يحكم.</span>
                <span className="badge badge-matched font-mono-numbers">FCR = 0.0%</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}