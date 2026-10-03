/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Scale,
  Users,
  ShieldCheck,
  Lock,
  AlertOctagon,
  FileCheck,
  CheckCircle,
  HelpCircle,
  ArrowUpRight
} from 'lucide-react';

export const GovernanceView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Header */}
      <div className="border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <span>الحوكمة والمراجعة والامتثال</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>المسار الرابع: أدوات المعرفة والتحقق</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-emerald-400 font-medium">وثيقة الضوابط الرسمية</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-tajawal text-white tracking-tight">
              حوكمة المنظومة، بروتوكول المراجعة، وسياسة الخصوصية
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              تلتزم «بصيرة» بأعلى معايير الانضباط العلمي والشرعي والأمني بما يحقق مستهدفات تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي دون تهاون أو استبدال للمصادر.
            </p>
          </div>
        </div>
      </div>

      {/* Levels A, B, C, D Architecture */}
      <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-6 shadow-lg space-y-4">
        <h3 className="text-lg font-bold font-tajawal text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-400" />
          <span>مصفوفة مستويات اتخاذ القرار الشرعي في بصيرة (Levels A - D)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Level A */}
          <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="font-bold text-emerald-400 text-sm">المستوى أ (Level A)</span>
              <span className="text-[11px] text-emerald-300 font-medium">معلومة مستقرة</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>النطاق:</strong> أصول الدين، أركان الإسلام، النصوص القرآنية القطعية، وإجماع الأمة المتيقن.
            </p>
            <p className="text-slate-400 leading-normal">
              <strong>قاعدة القرار:</strong> إجابة موثقة ومباشرة مع إسناد الدليل الصريح من المصدر المعتمد.
            </p>
          </div>

          {/* Level B */}
          <div className="p-4 rounded-xl bg-black/40 border border-sky-500/30 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="font-bold text-sky-400 text-sm">المستوى ب (Level B)</span>
              <span className="text-[11px] text-sky-300 font-medium">شرح واستدلال</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>النطاق:</strong> معاني المصطلحات، سياقات التفسير، والأحاديث النبوية ودرجات ثبوتها.
            </p>
            <p className="text-slate-400 leading-normal">
              <strong>قاعدة القرار:</strong> شرح من المادة المعتمدة مع إظهار المرجع وتجنب القطع فيما يحتمل الخلاف.
            </p>
          </div>

          {/* Level C */}
          <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="font-bold text-amber-400 text-sm">المستوى ج (Level C)</span>
              <span className="text-[11px] text-amber-300 font-medium">مسائل خلافية</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>النطاق:</strong> الفروع الفقهية السائغة بين أئمة المذاهب الأربعة (حنفية، مالكية، شافعية، حنابلة).
            </p>
            <p className="text-slate-400 leading-normal">
              <strong>قاعدة القرار:</strong> عرض أقوال المذاهب بأدلتها بتجرد تام، مع المنع الصارم لأي ترجيح آلي بين الأئمة.
            </p>
          </div>

          {/* Level D */}
          <div className="p-4 rounded-xl bg-black/40 border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="font-bold text-indigo-400 text-sm">المستوى د (Level D)</span>
              <span className="text-[11px] text-indigo-300 font-medium">فتوى ونوازل</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>النطاق:</strong> الفتاوى الشخصية (طلاق، نزاعات أسرية، معاملات مالية خاصة، قضايا دقيقة).
            </p>
            <p className="text-slate-400 leading-normal">
              <strong>قاعدة القرار:</strong> الامتناع القاطع عن الفتوى والإحالة فوراً إلى دور الإفتاء والهيئات الرسمية.
            </p>
          </div>
        </div>
      </div>

      {/* Protocols Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Human-in-the-Loop Protocol */}
        <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-6 shadow-lg space-y-4">
          <h3 className="text-base font-bold font-tajawal text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>بروتوكول المراجعة البشرية المزدوجة (Dual-Human Review)</span>
          </h3>

          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>المراجعة الشرعية:</strong> لا تُعتمد أي إضافة إلى سجل المصادر إلا بمراجعة محقق متخصص في علوم القرآن أو الحديث.</span>
            </li>

            <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>المراجعة التقنية المزدوجة:</strong> التحقق من سلامة نصوص التخريج وحظر إمكانية التعديل غير المصرح به على ملفات الحزمة.</span>
            </li>

            <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>سجل التدقيق غير القابل للتلاعب (Audit Log):</strong> تسجيل رقم الإصدار والتاريخ لكل عملية تدقيق مرجعي في المنظومة.</span>
            </li>
          </ul>
        </div>

        {/* Privacy Policy */}
        <div className="rounded-2xl bg-[#0b101b] border border-white/[0.08] p-6 shadow-lg space-y-4">
          <h3 className="text-base font-bold font-tajawal text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-sky-400" />
            <span>سياسة الخصوصية وأخلاقيات البيانات</span>
          </h3>

          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span><strong>حظر التنميط الديني والمذهبي:</strong> المنظومة تفحص النصوص المجردة ولا تسجل أو تحلل الميول المذهبية أو الدينية للمستخدمين.</span>
            </li>

            <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span><strong>المعالجة اللحظية العابرة (Ephemeral Processing):</strong> لا يتم حفظ النصوص الخاصة أو الصور المرفوعة بعد اكتمال الفحص.</span>
            </li>

            <li className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span><strong>عدم إعادة تدريب النماذج على محادثات المستخدمين:</strong> مدخلات القارئ لا تُستخدم في تدريب أي نماذج خارجية.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
