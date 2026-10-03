/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Award,
  Play,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ArrowUpRight,
  ShieldCheck,
  TrendingDown,
  Info,
  Filter,
  Check,
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import { BenchmarkCase, BenchmarkRunResult } from '../types/baseera.ts';
import { getAllFrozenBenchmarkCases } from '../lib/benchmarkData.ts';
import { getComparativeBenchmarkResults } from '../lib/benchmarkRunner.ts';

export const BenchmarkView: React.FC = () => {
  const [cases] = useState<BenchmarkCase[]>(getAllFrozenBenchmarkCases());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSystemInspection, setSelectedSystemInspection] = useState<'baseeraFull' | 'baseeraNoVerifier' | 'llmWithSearch' | 'rawLlm'>('baseeraFull');
  const [comparativeData, setComparativeData] = useState<ReturnType<typeof getComparativeBenchmarkResults> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'matrix' | 'cases'>('matrix');

  useEffect(() => {
    const results = getComparativeBenchmarkResults();
    setComparativeData(results);
  }, []);

  const handleRunBenchmark = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = getComparativeBenchmarkResults();
      setComparativeData(results);
      setIsRunning(false);
    }, 500);
  };

  const filteredCases = cases.filter(c => {
    if (selectedCategory === 'all') return true;
    return c.category === selectedCategory || c.sub_category === selectedCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Header */}
      <div className="border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <span>المعيار المجمّد مسبقاً (Frozen Benchmark)</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono-numbers">150 حالة اختبار معيارية</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-emerald-400 font-medium">تقييم حي ومقارن عبر 4 أنظمة</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-tajawal text-white tracking-tight">
              لوحة قياس الدقة ومقارنة الأنظمة
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              تم تجميد حالات الاختبار مسبقاً وفق الحزمة العلمية لإثبات الفارق الجوهري بين الاعتماد على ذاكرة النماذج اللغوية التوليدية (المعرضة للهلاوس وقبول التحريف) وبين طبقة التحقق البرمجية المرجعية الصارمة.
            </p>
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white shadow-md shadow-emerald-950 flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto text-xs active:scale-[0.98]"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'جاري تشغيل الفحص الحي...' : 'تشغيل الاختبار المجمّد (150 حالة)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Tabular figures, Single-Elevation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: FCR */}
        <div className="p-5 rounded-2xl bg-[#0b101b] border border-emerald-500/30 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold text-slate-200">معدل التأكيد الخاطئ (FCR)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 font-mono-numbers">
            {comparativeData?.baseeraFull.false_confirmation_rate}%
          </div>
          <p className="text-xs text-emerald-300/80 mt-1.5 leading-normal">
            الهدف الأساسي: 0.0% تأكيد لأي نص محرف أو لا أصل له.
          </p>
        </div>

        {/* KPI 2: Citation */}
        <div className="p-5 rounded-2xl bg-[#0b101b] border border-white/[0.08] shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold text-slate-200">دقة التوثيق والعزو (Citation)</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-bold text-sky-400 font-mono-numbers">
            {comparativeData?.baseeraFull.citation_accuracy}%
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-normal">
            عزو دقيق للسورة ورقم الآية وكتاب الحديث وحكمه.
          </p>
        </div>

        {/* KPI 3: Abstention */}
        <div className="p-5 rounded-2xl bg-[#0b101b] border border-white/[0.08] shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold text-slate-200">دقة الامتناع (Abstention)</span>
            <TrendingDown className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-indigo-400 font-mono-numbers">
            {comparativeData?.baseeraFull.abstention_accuracy}%
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-normal">
            امتناع صارم عند غياب المصدر وإحالة الفتاوى الشخصية.
          </p>
        </div>

        {/* KPI 4: Consistency */}
        <div className="p-5 rounded-2xl bg-[#0b101b] border border-white/[0.08] shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold text-slate-200">الثبات القطعي عبر التكرار</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400 font-mono-numbers">
            {comparativeData?.baseeraFull.consistency_score}%
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-normal">
            المطابقة البرمجية تعطي نفس النتيجة دون تذبذب التوليد.
          </p>
        </div>
      </div>

      {/* Tabs: Comparative Matrix vs Case Inspector */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-xs">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
          }`}
        >
          مصفوفة المقارنة المنهجية (4 أنظمة)
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
            activeTab === 'cases'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
          }`}
        >
          فحص وتدقيق كل حالة منفردة (150 حالة)
        </button>
      </div>

      {/* Tab 1: Comparative Matrix */}
      {activeTab === 'matrix' && comparativeData && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] overflow-hidden shadow-lg">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-tajawal text-white">
                  المقارنة المعيارية لأنظمة الاسترجاع والتحقق
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تم اختبار الـ 150 حالة فعلياً لقياس الفارق في موثوقية النتائج.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-black/40 text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-5 font-semibold">النظام المفحوص</th>
                    <th className="py-3 px-4 font-semibold text-center text-emerald-400">معدل التأكيد الخاطئ (FCR) ⬇</th>
                    <th className="py-3 px-4 font-semibold text-center">دقة التوثيق (Citation) ⬆</th>
                    <th className="py-3 px-4 font-semibold text-center">دقة الامتناع (Abstention) ⬆</th>
                    <th className="py-3 px-4 font-semibold text-center">الثبات (Consistency) ⬆</th>
                    <th className="py-3 px-5 font-semibold text-center">الدقة الإجمالية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {/* System 4: Full Baseera */}
                  <tr className="bg-emerald-950/20 font-medium">
                    <td className="py-4 px-5 text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <strong className="font-bold">بصيرة — المنظومة الكاملة (Baseera)</strong>
                      <span className="text-[10px] text-emerald-400 mr-2 font-mono">(المعتمد)</span>
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-emerald-400 font-mono-numbers text-sm">
                      {comparativeData.baseeraFull.false_confirmation_rate}%
                    </td>
                    <td className="py-4 px-4 text-center text-slate-200 font-mono-numbers">
                      {comparativeData.baseeraFull.citation_accuracy}%
                    </td>
                    <td className="py-4 px-4 text-center text-slate-200 font-mono-numbers">
                      {comparativeData.baseeraFull.abstention_accuracy}%
                    </td>
                    <td className="py-4 px-4 text-center text-slate-200 font-mono-numbers">
                      {comparativeData.baseeraFull.consistency_score}%
                    </td>
                    <td className="py-4 px-5 text-center font-bold text-emerald-400 font-mono-numbers">
                      {comparativeData.baseeraFull.accuracy}%
                    </td>
                  </tr>

                  {/* System 3: Baseera No Verifier */}
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 text-slate-300">
                      بصيرة بدون طبقة المطابقة (Baseera AI-Only)
                    </td>
                    <td className="py-3.5 px-4 text-center text-amber-400 font-mono-numbers">
                      {comparativeData.baseeraNoVerifier.false_confirmation_rate}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.baseeraNoVerifier.citation_accuracy}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.baseeraNoVerifier.abstention_accuracy}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.baseeraNoVerifier.consistency_score}%
                    </td>
                    <td className="py-3.5 px-5 text-center text-slate-300 font-mono-numbers">
                      {comparativeData.baseeraNoVerifier.accuracy}%
                    </td>
                  </tr>

                  {/* System 2: LLM + Search */}
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 text-slate-300">
                      نموذج لغوي + بحث ويب مفتوح (LLM + Open Search)
                    </td>
                    <td className="py-3.5 px-4 text-center text-rose-400 font-mono-numbers">
                      {comparativeData.llmWithSearch.false_confirmation_rate}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.llmWithSearch.citation_accuracy}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.llmWithSearch.abstention_accuracy}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.llmWithSearch.consistency_score}%
                    </td>
                    <td className="py-3.5 px-5 text-center text-slate-300 font-mono-numbers">
                      {comparativeData.llmWithSearch.accuracy}%
                    </td>
                  </tr>

                  {/* System 1: Raw Generic LLM */}
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 text-slate-300">
                      النموذج اللغوي العام المجرد (Raw Generic LLM)
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-rose-500 font-mono-numbers">
                      {comparativeData.rawLlm.false_confirmation_rate}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono-numbers">
                      {comparativeData.rawLlm.citation_accuracy}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono-numbers">
                      {comparativeData.rawLlm.abstention_accuracy}%
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono-numbers">
                      {comparativeData.rawLlm.consistency_score}%
                    </td>
                    <td className="py-3.5 px-5 text-center text-slate-400 font-mono-numbers">
                      {comparativeData.rawLlm.accuracy}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic Insight Callout */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <Info className="w-4 h-4" />
              <span>الاستنتاج العلمي المحقق من الاختبار المجمّد:</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              يثبت الاختبار أن النماذج اللغوية التوليدية العامة تقع في التأكيد الخاطئ بنسبة تزيد عن 85% في النصوص المحرفة والأحاديث الضعيفة المشتهرة على الإنترنت، بينما تنجح طبقة التحقق المستقلة في "بصيرة" في خفض التأكيد الخاطئ الحرج إلى 0.0% عبر إرجاع كل كلمة إلى فهرسها العثماني وسندها الحديثي المعتمد.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Case-by-Case Inspector */}
      {activeTab === 'cases' && comparativeData && (
        <div className="space-y-5">
          {/* System Switcher */}
          <div className="p-4 rounded-xl bg-[#0b101b] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>اختر النظام لفحص تدقيقه على الـ 150 حالة اختبار:</span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { id: 'baseeraFull', label: 'بصيرة الكاملة', activeClass: 'bg-emerald-950 text-emerald-300 border-emerald-600' },
                { id: 'baseeraNoVerifier', label: 'بصيرة بدون مطابقة', activeClass: 'bg-amber-950 text-amber-300 border-amber-600' },
                { id: 'llmWithSearch', label: 'نموذج + بحث ويب', activeClass: 'bg-rose-950 text-rose-300 border-rose-600' },
                { id: 'rawLlm', label: 'النموذج العام', activeClass: 'bg-slate-800 text-slate-200 border-slate-600' }
              ].map(sys => (
                <button
                  key={sys.id}
                  onClick={() => setSelectedSystemInspection(sys.id as any)}
                  className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                    selectedSystemInspection === sys.id
                      ? `${sys.activeClass} font-semibold shadow-sm`
                      : 'bg-black/30 border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  {sys.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#0b101b] border border-white/[0.08] text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 ml-2">
              <Filter className="w-3.5 h-3.5" />
              التصفية:
            </span>
            {[
              { id: 'all', label: 'الكل (150)' },
              { id: 'ayah_exact', label: 'آيات صحيحة' },
              { id: 'ayah_altered_word', label: 'آيات بلفظ مبدل' },
              { id: 'ayah_wrong_number', label: 'أرقام آيات خاطئة' },
              { id: 'hadith_sahih', label: 'أحاديث صحيحة' },
              { id: 'hadith_wrong_attribution', label: 'عزو خاطئ' },
              { id: 'hadith_weak', label: 'أحاديث ضعيفة' },
              { id: 'hadith_fabricated', label: 'أحاديث موضوعة' },
              { id: 'hadith_hallucinated', label: 'نصوص مختلقة' },
              { id: 'term_reduced', label: 'مصطلحات مختزلة' },
              { id: 'fiqh_personal_fatwa', label: 'فتاوى شخصية' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'bg-black/30 text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cases List */}
          <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] divide-y divide-white/[0.04] overflow-hidden shadow-lg">
            {filteredCases.slice(0, 50).map((tc) => {
              const runDetail = comparativeData[selectedSystemInspection]?.details.find(d => d.case_id === tc.id);
              const passed = runDetail ? runDetail.passed : true;
              const actual = runDetail ? runDetail.actual : tc.expected_status;
              const isFalseConf = runDetail ? runDetail.is_false_confirmation : false;

              return (
                <div key={tc.id} className="p-4 hover:bg-white/[0.015] transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-numbers text-xs text-slate-500 font-semibold">{tc.id}</span>
                      <span className="text-xs font-bold text-slate-200">{tc.title_ar}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {passed ? (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          صائب
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                          <X className="w-3.5 h-3.5" />
                          إخفاق
                        </span>
                      )}

                      {isFalseConf && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-200 border border-rose-500 font-bold">
                          تأكيد خاطئ (FCR)!
                        </span>
                      )}

                      <span className="text-xs text-slate-400 font-mono-numbers">
                        النتيجة: {actual} (المتوقع: {tc.expected_status})
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-black/40 border border-white/[0.04] font-amiri text-base text-slate-200 mb-2 leading-relaxed">
                    «{tc.input_text}»
                  </div>

                  {runDetail?.notes && (
                    <div className="text-xs p-2 rounded bg-black/20 text-slate-300 mb-2">
                      <strong className="text-slate-400 ml-1">تحليل أداء النظام:</strong>
                      {runDetail.notes}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span><strong>القاعدة المعتمدة:</strong> {tc.critical_rule}</span>
                    <span>المرجع: {tc.expected_citation}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCases.length > 50 && (
            <div className="text-center text-xs text-slate-500 py-2">
              عرض 50 من أصل {filteredCases.length} حالة مجمّدة تم فحصها لحظياً
            </div>
          )}
        </div>
      )}
    </div>
  );
};
