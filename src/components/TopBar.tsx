/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Award,
  Layers,
  BookOpen,
  Scale,
  CornerDownLeft,
  type LucideIcon
} from 'lucide-react';
import type { TabId } from './Sidebar.tsx';

interface TopBarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onMenuClick: () => void;
}

interface CmdItem {
  id: TabId;
  label: string;
  group: string;
  icon: LucideIcon;
}

const COMMANDS: CmdItem[] = [
  { id: 'verifier', label: 'فاحص المحتوى', group: 'المعمل', icon: ShieldCheck },
  { id: 'dawah', label: 'صانع المحتوى الدعوي', group: 'المعمل', icon: Sparkles },
  { id: 'benchmark', label: 'لوحة القياس', group: 'القياس', icon: Award },
  { id: 'sources', label: 'سجل المصادر المعتمدة', group: 'المصادر', icon: BookOpen },
  { id: 'extension', label: 'إضافة المتصفح', group: 'المنظومة', icon: Layers },
  { id: 'governance', label: 'الحوكمة والضوابط', group: 'المنظومة', icon: Scale }
];

const TITLES: Record<TabId, string> = {
  verifier: 'فاحص المحتوى',
  dawah: 'صانع المحتوى الدعوي',
  benchmark: 'لوحة القياس',
  sources: 'سجل المصادر المعتمدة',
  extension: 'إضافة المتصفح',
  governance: 'الحوكمة والضوابط'
};

export const TopBar: React.FC<TopBarProps> = ({ activeTab, setActiveTab, onMenuClick }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.includes(q) || c.group.includes(q) || c.id.includes(q)
    );
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  const run = (id: TabId) => {
    setActiveTab(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          onClick={onMenuClick}
          aria-label="فتح القائمة"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-muted transition-colors hover:text-ink lg:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Page identity */}
        <div className="hidden min-w-0 flex-col sm:flex">
          <span className="font-mono-numbers text-[10px] uppercase tracking-widest text-faint">
            {TITLES[activeTab]}
          </span>
          <h1 className="truncate font-display text-base font-bold leading-tight text-ink">
            {TITLES[activeTab]}
          </h1>
        </div>

        {/* Command palette */}
        <div ref={wrapRef} className="relative mx-auto w-full max-w-xl">
          <div className="flex items-center gap-2 rounded-2xl border border-hairline-strong bg-black/35 px-3 py-2 transition-colors focus-within:border-gold/70">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="ابحث أو انتقل إلى قسم…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>

          {open && results.length > 0 && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/60">
              {results.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => run(item.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-right text-sm text-muted transition-colors hover:bg-white/5 hover:text-ink"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gold" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] text-faint">{item.group}</span>
                    <CornerDownLeft className="h-3.5 w-3.5 text-faint" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="hidden items-center gap-2 rounded-2xl border border-brand/25 bg-brand/10 px-3 py-2 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          <span className="text-[11px] font-semibold text-brand-soft">النظام جاهز</span>
        </div>
      </div>
    </header>
  );
};