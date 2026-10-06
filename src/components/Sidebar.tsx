/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Award,
  Layers,
  BookOpen,
  Scale,
  Download,
  X,
  type LucideIcon
} from 'lucide-react';

/**
 * Reads the real False-Confirmation Rate from the benchmark API instead of
 * displaying a hard-coded figure. Shows "—" until the value is available so no
 * unverified claim is ever presented to the user.
 */
function useLiveFcr(): string {
  const [fcr, setFcr] = useState<string>('—');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/benchmark');
        if (!res.ok) return;
        const data = await res.json();
        const value = data?.data?.baseeraFull?.false_confirmation_rate;
        if (!cancelled && typeof value === 'number') {
          setFcr(`${value.toFixed(1)}%`);
        }
      } catch {
        /* keep the neutral placeholder if the engine is unreachable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return fcr;
}

export type TabId = 'verifier' | 'dawah' | 'benchmark' | 'sources' | 'extension' | 'governance';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'المعمل',
    items: [
      { id: 'verifier', label: 'فاحص المحتوى', icon: ShieldCheck, hint: 'تحقق متقاطع' },
      { id: 'dawah', label: 'صانع المحتوى الدعوي', icon: Sparkles, hint: 'توليد موثّق' }
    ]
  },
  {
    label: 'القياس والمصادر',
    items: [
      { id: 'benchmark', label: 'لوحة القياس', icon: Award, hint: '150 حالة' },
      { id: 'sources', label: 'سجل المصادر المعتمدة', icon: BookOpen, hint: 'الحزمة العلمية' }
    ]
  },
  {
    label: 'المنظومة',
    items: [
      { id: 'extension', label: 'إضافة المتصفح', icon: Layers, hint: 'تحقّق فوري' },
      { id: 'governance', label: 'الحوكمة والضوابط', icon: Scale, hint: 'المستويات A–D' }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, mobileOpen, onClose }) => {
  const liveFcr = useLiveFcr();

  const handleSelect = (id: TabId) => {
    setActiveTab(id);
    onClose();
  };

  const body = (
    <div className="flex h-full flex-col gap-6 p-4">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 pt-2">
        <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-b from-gold/25 to-gold/5 border border-gold/40 text-gold">
          <span className="font-display text-xl font-bold leading-none">ب</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight text-ink">بصيرة</span>
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-none">
        {GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <div className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-faint">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="nav-item"
                  data-active={isActive}
                >
                  <Icon className="nav-ico h-4 w-4 shrink-0 text-muted" />
                  <span className="flex-1 text-right">{item.label}</span>
                  <span className="text-[10px] text-faint">{item.hint}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer status */}
      <div className="space-y-3 rounded-2xl border border-hairline bg-black/25 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">معدل التأكيد الخاطئ (المُقاس)</span>
          <span className="badge badge-matched font-mono-numbers">{liveFcr}</span>
        </div>
        <a
          href="/baseera-extension.zip"
          download="baseera-extension.zip"
          className="btn btn-outline w-full"
        >
          <Download className="h-3.5 w-3.5" />
          <span>تحميل الإضافة</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:flex lg:w-72 lg:shrink-0 border-l border-hairline bg-canvas-2/70 backdrop-blur-xl">
        {body}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 right-0 w-72 max-w-[85vw] border-l border-hairline bg-canvas-2 shadow-2xl">
            <button
              onClick={onClose}
              aria-label="إغلاق القائمة"
              className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
};