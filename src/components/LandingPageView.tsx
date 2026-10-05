import React from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  FileSearch,
  Layers3,
  ShieldCheck,
  Sparkles
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

const SECTIONS = [
  {
    id: 'verifier' as const,
    icon: <FileSearch />,
    eyebrow: '01 · التحقق',
    title: 'تحقق من النص قبل أن تنسبه أو تنشره.',
    text: 'افحص آية أو حديثًا أو محتوى دينيًا، ثم شاهد الدليل والمصدر والاختلافات في مكان واحد.',
    action: 'ابدأ الفحص'
  },
  {
    id: 'dawah' as const,
    icon: <Sparkles />,
    eyebrow: '02 · إعداد المحتوى',
    title: 'حوّل الفكرة إلى محتوى جاهز للمراجعة.',
    text: 'أنشئ خطبة أو مقالًا أو بطاقة، مع إبقاء الشواهد والمراجع واضحة وقابلة للتتبع.',
    action: 'إعداد المحتوى'
  },
  {
    id: 'extension' as const,
    icon: <Layers3 />,
    eyebrow: '03 · أثناء التصفح',
    title: 'تحقق وأنت تتصفح.',
    text: 'افحص اقتباسًا أو منشورًا من داخل المتصفح دون نسخ المحتوى إلى أداة أخرى.',
    action: 'استكشف الإضافة'
  },
  {
    id: 'sources' as const,
    icon: <BookOpenCheck />,
    eyebrow: '04 · المراجع',
    title: 'المصدر ظاهر، والذكاء الاصطناعي ليس المرجع.',
    text: 'ترى الجهة التي بُنيت عليها النتيجة ورابطها، بينما يظل دور الذكاء الاصطناعي مساعدًا لا حاكمًا.',
    action: 'شاهد المراجع'
  }
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => (
  <div className="page-shell overflow-hidden">
    <section className="home-hero">
      <div className="home-hero-inner home-reveal">
        <div className="eyebrow-badge">
          <span className="status-dot" aria-hidden="true" />
          للتحقق من المحتوى الإسلامي
        </div>

        <h1 className="mt-6 text-balance font-display text-[40px] font-bold leading-[1.18] tracking-tight text-ink sm:text-[58px]">
          قبل أن تنشر،
          <span className="text-brand"> اعرف الأصل.</span>
        </h1>

        <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-8 text-muted sm:text-[19px]">
          بصيرة تفحص النص في مرجعه المعتمد، وتعرض لك الدليل بوضوح قبل أن تستخدمه أو تنشره.
        </p>

        <button
          type="button"
          onClick={() => onNavigate('verifier')}
          className="btn btn-primary home-hero-action mt-8 min-h-12 px-7"
        >
          <ShieldCheck className="h-5 w-5" />
          ابدأ التحقق
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="home-trust-line">
          <span><ShieldCheck className="h-4 w-4" /> المصدر أولًا</span>
          <span><ShieldCheck className="h-4 w-4" /> نتيجة واضحة</span>
          <span><ShieldCheck className="h-4 w-4" /> الدليل ظاهر</span>
        </div>

        <div className="home-flow" aria-label="طريقة عمل بصيرة">
          <div className="home-flow-step">
            <span>01</span>
            <strong>أدخل النص</strong>
          </div>
          <div className="home-flow-line" aria-hidden="true" />
          <div className="home-flow-step">
            <span>02</span>
            <strong>نرجع إلى المصدر</strong>
          </div>
          <div className="home-flow-line" aria-hidden="true" />
          <div className="home-flow-step">
            <span>03</span>
            <strong>تظهر النتيجة والدليل</strong>
          </div>
        </div>
      </div>
    </section>

    <section className="home-sections" aria-label="أدوات بصيرة">
      {SECTIONS.map((item, index) => (
        <article
          key={item.id}
          className="home-feature home-reveal"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="home-feature-icon" aria-hidden="true">{item.icon}</div>

          <div className="home-feature-copy">
            <div className="eyebrow">{item.eyebrow}</div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {item.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">
              {item.text}
            </p>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="home-feature-link"
            >
              {item.action}
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </section>

    <section className="home-bottom home-reveal">
      <div className="home-bottom-mark" aria-hidden="true">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div>
        <div className="eyebrow">بصيرة</div>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          لا تكتفِ بالنتيجة؛ تتبّع الأصل.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          صممت بصيرة لتكون سريعة في الاستخدام، واضحة في الحكم، وقابلة للمراجعة عندما تحتاج إلى التفاصيل.
        </p>
      </div>
    </section>

    <div className="mx-auto max-w-[760px] px-4 pb-10 text-center text-[11px] text-faint sm:px-6">
      صُممت بصيرة لتكون بسيطة عند الاستخدام وقابلة للتدقيق عند الحاجة.
    </div>
  </div>
);