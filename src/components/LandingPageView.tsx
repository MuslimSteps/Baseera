/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpenCheck,
  Check,
  FileSearch,
  Layers3,
  ShieldCheck,
  Sparkles,
  Waypoints
} from 'lucide-react';

type TabId =
  | 'home'
  | 'verifier'
  | 'dawah'
  | 'extension'
  | 'sources'
  | 'benchmark'
  | 'governance';

interface LandingPageViewProps {
  onNavigate: (tab: TabId) => void;
}

const WORKFLOWS = [
  {
    icon: <FileSearch className="h-5 w-5" />,
    title: 'تحقق من نص',
    description: 'ألصق آية أو حديثًا أو نصًا إسلاميًا، ودع بصيرة ترتّب عملية الفحص وتعرض لك ما وجدته في المرجع.'
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: 'اكتب محتوى موثّقًا',
    description: 'أنشئ مسودة لخطبة أو مقال بعد جمع الشواهد من المصادر، بدل الاعتماد على الذاكرة العامة للنموذج.'
  },
  {
    icon: <Layers3 className="h-5 w-5" />,
    title: 'تحقق أثناء التصفح',
    description: 'استخدم إضافة المتصفح لفحص اقتباس أو منشور دون مغادرة الصفحة التي تقرأها.'
  }
];

const PRINCIPLES = [
  ['يفهم', 'الذكاء الاصطناعي يساعد في فهم النص وصياغة البحث.'],
  ['يسترجع', 'المعلومة تُستخرج من المرجع المعتمد لا من ذاكرة النموذج.'],
  ['يوثّق', 'كل نتيجة لها أصل ورابط واضح عندما يتوافر الدليل.'],
  ['يمتنع', 'عند غياب الدليل، لا تُصنع إجابة بديلة لإكمال الشاشة.']
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => {
  return (
    <div className="page-shell overflow-hidden">
      <section className="mx-auto max-w-[1380px] px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pb-14">
        <div className="hero-grid">
          <div className="relative z-10 max-w-3xl">
            <div className="eyebrow-badge">
              <span className="status-dot" aria-hidden="true" />
              أداة تحقق معرفية للمحتوى الإسلامي
            </div>

            <h1 className="mt-6 text-balance font-display text-[38px] font-bold leading-[1.2] tracking-tight text-ink sm:text-[52px] lg:text-[64px]">
              لا تنشر النص لأنك{' '}
              <span className="text-brand">تتذكره.</span>
              <br />
              انشره لأنك عرفت أصله.
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-[17px] leading-8 text-muted sm:text-[19px]">
              بصيرة تساعدك على فحص الآيات والأحاديث والمصطلحات والمسائل التي تحتاج مراجعة،
              عبر مسار واضح: فهم للنص، بحث في المرجع، ثم عرض للدليل مع رابط المصدر.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onNavigate('verifier')}
                className="btn btn-primary min-h-12 px-6"
              >
                <ShieldCheck className="h-5 w-5" />
                ابدأ فحص نص
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('dawah')}
                className="btn btn-secondary min-h-12 px-6"
              >
                <Sparkles className="h-5 w-5" />
                جهّز خطبة أو مقالًا
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-brand" /> القرآن</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-brand" /> الحديث</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-brand" /> الفقه للمراجعة</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-brand" /> المصطلحات</span>
            </div>
          </div>

          <div className="hero-orbit" aria-hidden="true">
            <div className="hero-orbit-card hero-orbit-main">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
                <span>بنية التحقق</span>
                <span className="rounded-full bg-brand-soft px-2 py-1 text-brand-strong">مرجع أولًا</span>
              </div>
              <div className="mt-6 space-y-4">
                {PRINCIPLES.map(([title, text], index) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <div className="font-bold text-ink">{title}</div>
                      <div className="mt-1 text-xs leading-5 text-muted">{text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-line pt-4 text-xs text-faint">
                الذكاء الاصطناعي ليس المرجع؛ هو طبقة مساعدة داخل المسار.
              </div>
            </div>

            <div className="hero-orbit-card hero-orbit-small hero-orbit-top">
              <BookOpenCheck className="h-4 w-4 text-gold" />
              <div>
                <div className="text-xs font-bold text-ink">مرجع موثّق</div>
                <div className="text-[10px] text-muted">رابط الأصل ظاهر مع النتيجة</div>
              </div>
            </div>

            <div className="hero-orbit-card hero-orbit-small hero-orbit-bottom">
              <Waypoints className="h-4 w-4 text-brand" />
              <div>
                <div className="text-xs font-bold text-ink">امتناع ذكي</div>
                <div className="text-[10px] text-muted">غياب الدليل = لا تخمين</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1380px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="section-label">
          <span>ابدأ من المهمة التي تريد إنجازها</span>
          <span className="section-line" aria-hidden="true" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {WORKFLOWS.map((workflow, index) => (
            <button
              key={workflow.title}
              type="button"
              onClick={() => onNavigate(index === 0 ? 'verifier' : index === 1 ? 'dawah' : 'extension')}
              className="workflow-card text-right"
            >
              <span className="workflow-icon" aria-hidden="true">{workflow.icon}</span>
              <span className="mt-5 block text-base font-bold text-ink">{workflow.title}</span>
              <span className="mt-2 block text-sm leading-6 text-muted">{workflow.description}</span>
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-brand">
                افتح الأداة
                <ArrowLeft className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1380px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="eyebrow">لماذا تبدو بصيرة مختلفة؟</div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                الوضوح أهم من الإبهار.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                المستخدم لا يحتاج إلى شاشة مليئة بالمؤشرات. يحتاج أن يعرف ثلاثة أشياء بسرعة:
                ماذا وجد النظام؟ أين وُجد؟ وماذا يعني ذلك بالنسبة للنص الذي أمامه؟
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PRINCIPLES.map(([title, text], index) => (
                <div key={title} className={`principle-card ${index === 0 ? 'principle-card-featured' : ''}`}>
                  <div className="font-display text-lg font-bold text-ink">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1380px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-brand/15 bg-brand-soft/60 p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-brand-strong">
                <ShieldCheck className="h-4 w-4" />
                مبني حول فكرة واحدة
              </div>
              <h2 className="mt-3 max-w-3xl font-display text-2xl font-bold text-ink sm:text-3xl">
                المخرج ليس «إجابة جميلة». المخرج هو نتيجة يمكن تتبّعها.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                لذلك تفصل بصيرة بين فهم الذكاء الاصطناعي، واسترجاع المادة من المصدر،
                والنتيجة التي يراها المستخدم.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate('sources')} className="btn btn-dark min-h-12 px-5">
              <BookOpenCheck className="h-4 w-4" />
              استعرض المراجع
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1380px] px-4 pb-8 text-center text-[11px] text-faint sm:px-6 lg:px-8">
        صُممت الواجهة لتكون واضحة للزائر العادي، وقابلة للتدقيق للباحث والمحكّم.
      </div>
    </div>
  );
};
