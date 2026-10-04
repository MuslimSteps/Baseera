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
  CheckCircle
} from 'lucide-react';

interface Level {
  id: string;
  label: string;
  tag: string;
  accent: string;
  card: string;
  chip: string;
  scope: string;
  rule: string;
}

const LEVELS: Level[] = [
  {
    id: 'A',
    label: 'المستوى أ',
    tag: 'معلومة مستقرة',
    accent: 'text-brand-soft',
    card: 'bento-card--brand',
    chip: 'badge-matched',
    scope: 'أصول الدين، أركان الإسلام، النصوص القرآنية القطعية، وإجماع الأمة المتيقن.',
    rule: 'إجابة موثقة ومباشرة مع إسناد الدليل الصريح من المصدر المعتمد.'
  },
  {
    id: 'B',
    label: 'المستوى ب',
    tag: 'شرح واستدلال',
    accent: 'text-info',
    card: 'bento-card--ai',
    chip: 'badge-refer',
    scope: 'معاني المصطلحات، سياقات التفسير، والأحاديث النبوية ودرجات ثبوتها.',
    rule: 'شرح من المادة المعتمدة مع إظهار المرجع وتجنب القطع فيما يحتمل الخلاف.'
  },
  {
    id: 'C',
    label: 'المستوى ج',
    tag: 'خلاف سائغ',
    accent: 'text-gold',
    card: 'bento-card--gold',
    chip: 'badge-gold',
    scope: 'المسائل الفقهية الخلافية بين المذاهب الأربعة المعتمدة.',
    rule: 'عرض الخلاف عرضاً حيادياً مقارناً دون ترجيح آلي، وإحالة النوازل الشخصية.'
  },
  {
    id: 'D',
    label: 'المستوى د',
    tag: 'فتوى شخصية',
    accent: 'text-danger',
    card: '',
    chip: 'badge-danger',
    scope: 'الفتاوى الشخصية (طلاق، نزاعات أسرية، معاملات مالية خاصة، قضايا دقيقة).',
    rule: 'الامتناع القاطع عن الفتوى والإحالة فوراً إلى دور الإفتاء والهيئات الرسمية.'
  }
];

export const GovernanceView: React.FC = () => {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Bento Hero */}
      <section className="bento reveal">
        <div className="bento-card bento-card--gold bento-accent-top col-span-12 p-6 sm:p-8 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="eyebrow">الحوكمة والامتثال</span>
            <span aria-hidden="true" className="eyebrow-sep">·</span>
            <span className="text-muted">المسار الرابع: أدوات المعرفة والتحقق</span>
          </div>
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            حوكمة المنظومة و<span className="gradient-text">بروتوكول المراجعة</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            تلتزم «بصيرة» بأعلى معايير الانضباط العلمي والشرعي والأمني دون تهاون أو استبدال للمصادر.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="badge badge-gold">سياسة مراجعة بشرية</span>
            <span className="badge badge-matched">توثيق الإصدار</span>
            <span className="badge badge-ai">معالجة مؤقتة</span>
          </div>
        </div>

        <div className="bento-card col-span-12 flex flex-col justify-between gap-4 p-6 lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Scale className="h-4 w-4 text-gold" />
            <span>مصفوفة مستويات القرار</span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            أربعة مستويات تحدّد كيف يتصرّف النظام: من الإجابة الموثقة إلى الامتناع والإحالة للمختص.
          </p>
          <div className="grid grid-cols-4 gap-2 border-t border-hairline pt-3 text-center">
            {LEVELS.map((l) => (
              <div key={l.id}>
                <div className={`font-mono-numbers text-lg font-bold ${l.accent}`}>{l.id}</div>
                <div className="text-[10px] text-faint">{l.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Levels Bento */}
      <section className="bento">
        {LEVELS.map((lvl, i) => (
          <div
            key={lvl.id}
            className={`bento-card ${lvl.card} col-span-12 space-y-2 p-5 md:col-span-6 lg:col-span-3 reveal reveal-${i + 1}`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
              <span className={`text-sm font-bold ${lvl.accent}`}>{lvl.label} (Level {lvl.id})</span>
              <span className={`badge ${lvl.chip}`}>{lvl.tag}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              <strong className="text-ink">النطاق:</strong> {lvl.scope}
            </p>
            <p className="text-xs leading-relaxed text-faint">
              <strong className="text-muted">قاعدة القرار:</strong> {lvl.rule}
            </p>
          </div>
        ))}
      </section>

      {/* Protocols Bento */}
      <section className="bento">
        <div className="bento-card col-span-12 space-y-4 p-6 lg:col-span-6 reveal">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Users className="h-5 w-5 text-gold" />
            <span>بروتوكول المراجعة البشرية المزدوجة</span>
          </h3>
          <ul className="space-y-2 text-xs text-muted">
            <li className="flex items-start gap-2 rounded-xl border border-hairline bg-black/20 p-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" />
              <span><strong className="text-ink">المراجعة الشرعية:</strong> لا تُعتمد أي إضافة إلى سجل المصادر إلا بمراجعة محقق متخصص في علوم القرآن أو الحديث.</span>
            </li>
            <li className="flex items-start gap-2 rounded-xl border border-hairline bg-black/20 p-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" />
              <span><strong className="text-ink">المراجعة التقنية المزدوجة:</strong> التحقق من سلامة نصوص التخريج وحظر أي تعديل غير مصرح به على ملفات الحزمة.</span>
            </li>
            <li className="flex items-start gap-2 rounded-xl border border-hairline bg-black/20 p-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-soft" />
              <span><strong className="text-ink">توثيق الإصدار:</strong> ملفات المصادر تحمل الإصدار وتاريخ الاعتماد، بينما لا يدّعي التطبيق وجود سجل تشغيل دائم غير قابل للتلاعب.</span>
            </li>
          </ul>
        </div>

        <div className="bento-card col-span-12 space-y-4 p-6 lg:col-span-6 reveal reveal-1">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Lock className="h-5 w-5 text-info" />
            <span>سياسة الخصوصية وأخلاقيات البيانات</span>
          </h3>
          <ul className="space-y-2 text-xs text-muted">
            <li className="flex items-start gap-2 rounded-xl border border-hairline bg-black/20 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <span><strong className="text-ink">حظر التنميط الديني والمذهبي:</strong> المنظومة تفحص النصوص المجردة ولا تحلل الميول الدينية للمستخدمين.</span>
            </li>
            <li className="flex items-start gap-2 rounded-xl border border-hairline bg-black/20 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <span><strong className="text-ink">المعالجة اللحظية العابرة:</strong> لا يتعمد التطبيق حفظ النصوص أو الصور بعد الفحص، مع احتمال وجود بيانات مؤقتة في ذاكرة التشغيل أثناء الطلب.</span>
            </li>
            <li className="flex items-start gap-2 rounded-xl border border-hairline bg-black/20 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <span><strong className="text-ink">حدود مزودات الذكاء الاصطناعي:</strong> عند استخدام Gemini تُرسل المدخلات إلى Google، وتخضع معالجة البيانات لسياسة المزود وإعداداته.</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};