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
    eyebrow: '01 · فحص المحتوى',
    title: 'فحص الآيات والأحاديث',
    text: 'آية أو حديث أو نص ديني.',
    action: 'ابدأ الفحص'
  },
  {
    id: 'dawah' as const,
    icon: <Sparkles />,
    eyebrow: '02 · إعداد المحتوى',
    title: 'إعداد المحتوى',
    text: 'خطبة أو مقال مع الشواهد.',
    action: 'إعداد المحتوى'
  },
  {
    id: 'extension' as const,
    icon: <Layers3 />,
    eyebrow: '03 · أثناء التصفح',
    title: 'تحقق داخل الصفحة',
    text: 'افحص النص دون مغادرة الصفحة.',
    action: 'استكشف الإضافة'
  },
  {
    id: 'sources' as const,
    icon: <BookOpenCheck />,
    eyebrow: '04 · المراجع',
    title: 'المراجع المعتمدة',
    text: 'المصدر هو أساس النتيجة.',
    action: 'شاهد المراجع'
  }
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => (
  <div className="page-shell overflow-hidden">
    <section className="home-hero">
      <div className="home-hero-inner home-reveal">
        <div className="eyebrow-badge">
          <span className="status-dot" aria-hidden="true" />
          بصير · للتحقق من المحتوى الإسلامي
        </div>

        <h1 className="mt-6 text-balance font-display text-[40px] font-bold leading-[1.18] tracking-tight text-ink sm:text-[58px]">
          تحقّق قبل أن تنشر
        </h1>

        <p className="home-hero-subcopy mt-5 max-w-2xl text-pretty text-[17px] leading-8 text-muted sm:text-[19px]">
          افحص آية أو حديثًا أو نصًا دينيًا واعرف النتيجة من المصدر المعتمد.
        </p>

        <button
          type="button"
          onClick={() => onNavigate('verifier')}
          className="btn btn-primary home-hero-action mt-8 min-h-12 px-7"
        >
          <ShieldCheck className="h-5 w-5" />
          ابدأ الفحص
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="home-trust-line">
          <span><ShieldCheck className="h-4 w-4" /> المصدر المعتمد</span>
          <span><ShieldCheck className="h-4 w-4" /> النتيجة واضحة</span>
          <span><ShieldCheck className="h-4 w-4" /> الدليل ظاهر</span>
        </div>

        <div className="home-flow" aria-label="طريقة عمل بصير">
          <div className="home-flow-step">
            <span>01</span>
            <strong>أدخل النص</strong>
          </div>
          <div className="home-flow-line" aria-hidden="true" />
          <div className="home-flow-step">
            <span>02</span>
            <strong>نفحص المصدر</strong>
          </div>
          <div className="home-flow-line" aria-hidden="true" />
          <div className="home-flow-step">
            <span>03</span>
            <strong>تظهر النتيجة</strong>
          </div>
        </div>
      </div>
    </section>

    <section className="home-sections" aria-label="أدوات بصير">
      {SECTIONS.map((item, index) => (
        <article
          key={item.id}
          className="home-feature home-reveal"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="home-feature-art" aria-hidden="true">
            <div className="home-feature-number">{item.eyebrow.slice(0, 2)}</div>
            <div className="home-feature-icon">{item.icon}</div>
          </div>

          <div className="home-feature-copy">
            <div className="eyebrow home-feature-eyebrow">{item.eyebrow}</div>
            <h2 className="home-feature-title font-display font-bold text-ink">
              {item.title}
            </h2>
            <p className="home-feature-text">{item.text}</p>
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
        <div className="eyebrow">بصير</div>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          النتيجة ومعها الدليل
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          راجع المصدر بنفسك قبل الاعتماد على المحتوى.
        </p>
      </div>
    </section>

    <div className="mx-auto max-w-[760px] px-4 pb-10 text-center text-[11px] text-faint sm:px-6">
      التحقق واضح، والمراجع أمامك.
    </div>
  </div>
);