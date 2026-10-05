/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpen,
  ShieldX,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  Calendar,
  Key,
  Scale,
  FileCheck
} from 'lucide-react';
import registryData from '../../sources/source-registry.json' with { type: 'json' };
import { apiFetch } from '../lib/apiClient.ts';

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

export const SourceRegistryView: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState(registryData.sources[0]);
  const [smoke, setSmoke] = useState<any[] | null>(null);
  const [smokeLoading, setSmokeLoading] = useState(false);

  const sourceUrl = OFFICIAL_URLS[selectedSource.id];

  return (
    <div className="page-shell mx-auto max-w-[1380px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      {/* Editorial Header */}
      <div className="bento-card bento-card--gold bento-accent-top p-6 sm:p-8 reveal">
        <div className="flex items-center gap-2 text-xs mb-3">
          <span>سجل المصادر الرسمي المعتمد (Source Registry)</span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span>الحزمة العلمية الرسمية</span>
          <span aria-hidden="true" className="text-faint">·</span>
          <span className="text-gold font-medium">حظر تام للمصادر غير المنضبطة</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display text-ink tracking-tight">
              المراجع المعتمدة لبصيرة
            </h1>
            <p className="text-sm text-muted mt-3 max-w-3xl leading-relaxed">
              هذه الصفحة توضح أين تبحث بصيرة، وما الذي يمكن استخدامه لإثبات النتيجة. تختلف وظيفة المصدر بحسب نوع المحتوى، وتبقى المراجع الظاهرة قابلة للفتح والمراجعة.
            </p>
          </div>

          <div className="text-xs text-ink/85 bg-white/[0.02] border border-hairline p-3 rounded-lg max-w-sm">
            <strong className="text-gold block mb-1">قاعدة التوثيق:</strong>
            <span>الذكاء الاصطناعي يساعد في الاستخراج والترتيب فقط؛ الدليل النهائي يأتي من المصدر المعتمد.</span>
          </div>
        </div>

        {/* Prohibited Sources Bar (Anti-Pill) */}
        <div className="mt-5 p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-300 font-semibold">
            <ShieldX className="w-4 h-4 text-rose-400 shrink-0" />
            <span>مصادر لا تعتمدها بصيرة كمرجع لإثبات النتيجة:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-rose-200">
            {registryData.prohibited_sources.map((src, i) => (
              <span key={i} className="flex items-center gap-1 text-[11px] bg-page px-2 py-0.5 rounded border border-rose-500/30">
                ✕ {src}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bento-card border border-emerald-500/25 p-5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink font-display text-base">حالة اتصال المصادر الحية</h3>
            <p className="text-xs text-muted mt-1">
              فحص تشغيلي اختياري لنقاط المصادر المستخدمة في التحقق. الفشل في مصدر خارجي لا يسمح بصيرة باختراع نتيجة بديلة.
            </p>
          </div>
          <button
            onClick={async () => {
              setSmokeLoading(true);
              try {
                const res = await apiFetch('/api/source-smoke');
                const data = await res.json();
                setSmoke(data.checks || []);
              } catch {
                setSmoke([{ source_id: 'backend', ok: false, detail: 'تعذر الاتصال بخادم بصيرة' }]);
              } finally {
                setSmokeLoading(false);
              }
            }}
            disabled={smokeLoading}
            className="px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-brand text-xs font-semibold disabled:opacity-50"
          >
            {smokeLoading ? 'جارٍ الفحص...' : 'فحص المصادر الآن'}
          </button>
        </div>
        {smoke && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {smoke.map((check: any) => (
              <div key={check.source_id} className="rounded-lg border border-hairline bg-black/25 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{check.source_id}</span>
                  <span className={check.ok ? 'text-brand' : 'text-rose-300'}>
                    {check.ok ? 'متاح' : 'غير متاح'}
                  </span>
                </div>
                <div className="text-[10px] text-muted mt-1 break-words">{check.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sources Grid & Selected Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Approved Sources List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-muted px-1">
            مصادر البحث والتوثيق في الحزمة ({registryData.sources.length}):
          </div>
          {registryData.sources.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelectedSource(source)}
              className={`w-full text-right p-4 rounded-xl border transition-all text-xs cursor-pointer ${
                selectedSource.id === source.id
                  ? 'bg-gold/10 border-gold/60 shadow-md'
                  : 'bento-card border-hairline hover:bg-white/[0.02] text-ink/85'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-sm text-ink font-display">{source.name_ar}</span>
                <span className="text-[10px] text-faint font-mono">{source.category}</span>
              </div>
              <div className="mb-2 text-[10px] text-brand">
                {source.implementation_status === 'active_live_dorar_tafsir' ||
                 source.implementation_status === 'active_live_dorar_aqeedah' ||
                 source.implementation_status === 'active_live_dorar_hadith' ||
                 source.implementation_status === 'active_local_verifier' ||
                 source.implementation_status === 'active_local_plus_live_fallback' ||
                 source.implementation_status === 'active_local_policy_plus_live_dorar' ||
                 source.implementation_status === 'active_live_quranpedia_plus_local_english_snapshot'
                  ? '● مسار تحقق فعّال'
                  : source.implementation_status === 'approved_secondary_reference_dorar_runtime_verifier'
                  ? '● مرجع ثانوي معتمد'
                  : '● مصدر مساعد'}
              </div>
              <p className="text-muted line-clamp-2 leading-relaxed">{source.authority}</p>
            </button>
          ))}
        </div>

        {/* Right Column: Detailed Specification View (8 cols) */}
        <div className="lg:col-span-8">
          <div className="bento-card border border-hairline p-6 shadow-lg space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-hairline">
              <div>
                <span className="text-xs text-faint block mb-0.5 font-mono">
                  معرّف المرجع: {selectedSource.id}
                </span>
                <h3 className="text-xl font-bold font-display text-ink">
                  {selectedSource.name_ar}
                </h3>
              </div>

              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-brand flex items-center gap-1.5 transition-colors"
                >
                  <span>المنصة الرسمية</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Authority & Scope */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted block">الجهة المرجعية ونطاق الاعتماد:</span>
              <p className="text-sm text-ink leading-relaxed bg-page p-3 rounded-lg border border-hairline">
                {selectedSource.authority}
              </p>
            </div>

            {/* Scope / Discipline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-page border border-hairline space-y-1">
                <span className="text-xs text-muted block font-medium">النطاق الشرعي:</span>
                <span className="text-sm font-semibold text-brand">{selectedSource.scope}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-page border border-hairline space-y-1">
                <span className="text-xs text-muted block font-medium">طريقة الوصول والتخزين:</span>
                <span className="text-xs font-mono text-ink/85">{selectedSource.access_method}</span>
              </div>
            </div>

            {/* Verification Rules for this Source */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted block">ضوابط التحقق المعتمدة لهذا المرجع:</span>
              <div className="bg-page p-3.5 rounded-lg border border-hairline text-xs text-ink/85 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <span className="leading-relaxed">{selectedSource.rules}</span>
              </div>
            </div>

            {/* License and Date */}
            <div className="pt-3 border-t border-hairline flex flex-wrap items-center justify-between text-xs text-faint">
              <span>تاريخ التثبيت والاعتماد: {selectedSource.access_date}</span>
              {selectedSource.license && <span>الترخيص: {selectedSource.license}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE DORAR SEARCH & MCP PROTOCOL SHOWCASE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Box 1: Interactive Live Dorar.net API Search */}
        <div className="bento-card border border-emerald-500/30 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-brand font-bold text-sm">
                API
              </div>
              <div>
                <h3 className="font-bold text-ink font-display text-base">
                  البحث المباشر في منصة الدرر السنية (Live Dorar API)
                </h3>
                <p className="text-xs text-muted">
                  ربط برمجى مباشر مع مصدر حديثي معتمد عبر استعلام مباشر من منصة dorar.net
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-emerald-900/40 text-brand border border-emerald-500/30 px-2 py-0.5 rounded-full">
              متصل حيّاً ✓
            </span>
          </div>

          <DorarLiveSearchTester />
        </div>

        {/* Box 2: Model Context Protocol (MCP) Server Integration */}
        <div className="bento-card border border-indigo-500/30 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-center text-refer font-bold text-sm">
                MCP
              </div>
              <div>
                <h3 className="font-bold text-ink font-display text-base">
                  خادم بروتوكول سياق النماذج (Baseera MCP Server)
                </h3>
                <p className="text-xs text-muted">
                  معيار MCP المفتوح لتمكين نماذج الذكاء الاصطناعي من استرجاع مصادر البحث والتوثيق
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-indigo-900/40 text-refer border border-indigo-500/30 px-2 py-0.5 rounded-full">
              JSON-RPC 2.0
            </span>
          </div>

          <p className="text-xs text-ink/85 leading-relaxed">
            يوفّر مشروع بصيرة خادم <code className="text-refer font-mono bg-page px-1 py-0.5 rounded">mcp-server.ts</code> جاهزاً للاستخدام المباشر في بيئات التطوير والوكلاء الأذكياء (Claude Desktop, Cursor, VS Code).
          </p>

          <div className="bg-black/50 border border-hairline rounded-xl p-3 text-[11px] font-mono space-y-2 text-ink/85">
            <div className="text-muted font-bold">أدوات MCP المتاحة:</div>
            <div className="space-y-1 text-ink/85">
              <div>• <span className="text-brand font-semibold">search_dorar_hadith:</span> بحث مباشر في الدرر السنية للأحاديث</div>
              <div>• <span className="text-brand font-semibold">verify_quran_verse:</span> فحص النص القرآني في قاعدة القرآن المعتمدة</div>
              <div>• <span className="text-brand font-semibold">lookup_jamhara_term:</span> كشف اختزال المصطلحات في موسوعة الجمهرة</div>
              <div>• <span className="text-brand font-semibold">check_fiqh_ruling:</span> ضوابط شجرة الفقه والإحالة للمختصين</div>
            </div>
          </div>

          <div className="bg-canvas-soft border border-indigo-500/20 rounded-xl p-3 text-[11px] font-mono text-muted">
            <div className="text-refer font-bold mb-1">إعداد Claude Desktop / Cursor:</div>
            <pre className="text-[10px] text-ink/85 overflow-x-auto whitespace-pre">
{`{
  "mcpServers": {
    "baseera": {
      "command": "npx",
      "args": ["tsx", "mcp-server.ts"]
    }
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponent for interactive live testing of Dorar API
const DorarLiveSearchTester: React.FC = () => {
  const [query, setQuery] = useState('حب الوطن من الإيمان');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchTerm?: string) => {
    const q = searchTerm || query;
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dorar/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setError(data.error || 'لم يتم العثور على نتائج');
      }
    } catch (e: any) {
      setError(e.message || 'فشل الاتصال بمنصة الدرر السنية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن حديث (مثال: طلب العلم فريضة)..."
          className="flex-1 bg-page border border-hairline-strong rounded-lg px-3 py-2 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-gold/70"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="px-4 py-2 bg-gold-strong hover:bg-[#c96a12] text-ink rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'جارٍ البحث...' : 'بحث في الدرر'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="text-muted">أمثلة سريعة:</span>
        {['حب الوطن من الإيمان', 'إنما الأعمال بالنيات', 'صوموا تصحوا', 'اطلبوا العلم ولو بالصين'].map((example) => (
          <button
            key={example}
            onClick={() => {
              setQuery(example);
              handleSearch(example);
            }}
            className="text-brand hover:underline bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20"
          >
            {example}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {results.slice(0, 3).map((h, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-page border border-hairline text-xs space-y-1">
              <div className="text-ink font-medium leading-relaxed">{h.text}</div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted pt-1 border-t border-hairline">
                {h.rawi && <span>الراوي: <strong className="text-ink/85">{h.rawi}</strong></span>}
                {h.muhaddith && <span>المحدث: <strong className="text-ink/85">{h.muhaddith}</strong></span>}
                {h.book && <span>المصدر: <strong className="text-ink/85">{h.book}</strong></span>}
                {h.grade && (
                  <span className={`px-1.5 py-0.2 rounded font-semibold ${
                    h.gradeCategory === 'sahih' || h.gradeCategory === 'hasan'
                      ? 'bg-emerald-950 text-brand border border-emerald-500/30'
                      : h.gradeCategory === 'fabricated'
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-950 text-gold border border-amber-500/30'
                  }`}>
                    الحكم: {h.grade}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="text-[10px] text-faint text-center">
            تم جلب {results.length} نتائج مباشرة من dorar.net/dorar_api.json
          </div>
        </div>
      )}
    </div>
  );
};

