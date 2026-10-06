import React from 'react';
import { ArrowLeft, BookOpenCheck, FileSearch, Layers3, ShieldCheck, Sparkles, Quote } from 'lucide-react';

type TabId = 'home' | 'verifier' | 'dawah' | 'extension' | 'sources' | 'benchmark' | 'governance';

interface LandingPageViewProps { onNavigate: (tab: TabId) => void; }

const TOOLS = [
  { id: 'verifier' as const, number: '01', icon: FileSearch, title: 'فحص النص', text: 'تحقّق من الآيات والأحاديث والأسئلة الدينية، مع إظهار المصدر والدليل.', action: 'ابدأ الفحص', tone: 'green' },
  { id: 'dawah' as const, number: '02', icon: Sparkles, title: 'إعداد المحتوى', text: 'حوّل فكرتك إلى محتوى قابل للمراجعة، مع إبقاء الشواهد والمصادر واضحة.', action: 'ابدأ الإعداد', tone: 'gold' },
  { id: 'extension' as const, number: '03', icon: Layers3, title: 'بصيرة أثناء التصفح', text: 'افحص نصًا تراه على الويب دون نسخه إلى مكان آخر أو مغادرة الصفحة.', action: 'استكشف الإضافة', tone: 'blue' },
  { id: 'sources' as const, number: '04', icon: BookOpenCheck, title: 'المراجع المعتمدة', text: 'تعرّف إلى المصادر التي تعتمد عليها بصيرة وكيف تُعرض الأدلة للمستخدم.', action: 'استعرض المراجع', tone: 'sand' },
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => (
  <div className="page-shell baseera-home">
    <section className="home-hero home-hero-editorial">
      <div className="home-hero-pattern" aria-hidden="true" />
      <div className="home-hero-inner home-reveal">
        <div className="home-kicker">
          <span className="home-kicker-mark"><span /></span>
          <span>بصيرة · للتحقق من المحتوى الإسلامي</span>
        </div>
        <p className="home-arabic-motto">وَقُلْ رَبِّ زِدْنِي عِلْمًا</p>
        <h1 className="mt-4 text-balance font-display text-[42px] font-bold leading-[1.22] tracking-tight text-ink sm:text-[62px]">تحقّق قبل أن تنسب</h1>
        <p className="home-hero-subcopy mt-5 max-w-2xl text-pretty text-[17px] leading-8 text-muted sm:text-[19px]">
          افحص آية أو حديثًا أو نصًا دينيًا، واعرف النتيجة من المصدر والدليل قبل أن تستخدمه أو تنشره.
        </p>
        <div className="home-hero-actions">
          <button type="button" onClick={() => onNavigate('verifier')} className="btn btn-primary home-hero-action min-h-12 px-7">
            <ShieldCheck className="h-5 w-5" /> ابدأ الفحص <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onNavigate('sources')} className="btn btn-secondary home-hero-secondary min-h-12 px-6">كيف نتحقق؟</button>
        </div>
        <div className="home-trust-line">
          <span><ShieldCheck className="h-4 w-4" /> المصدر أولًا</span>
          <span><ShieldCheck className="h-4 w-4" /> الدليل ظاهر</span>
          <span><ShieldCheck className="h-4 w-4" /> الذكاء الاصطناعي مساعد لا مصدر</span>
        </div>
      </div>
    </section>

    <section className="home-tools-section" aria-labelledby="baseera-tools-title">
      <div className="home-section-heading">
        <div>
          <div className="eyebrow">أدوات بصيرة</div>
          <h2 id="baseera-tools-title" className="mt-1 font-display text-[28px] font-bold leading-tight text-ink sm:text-[34px]">كل ما تحتاجه للمراجعة في مكان واحد</h2>
        </div>
        <p>ابدأ بالأداة المناسبة لما تريد التحقق منه أو إعداده.</p>
      </div>
      <div className="home-tools-grid">
        {TOOLS.map((item, index) => {
          const Icon = item.icon;
          return (
            <article key={item.id} className={'home-tool-card home-tool-card-' + item.tone + ' home-reveal'} style={{ animationDelay: (index * 70) + 'ms' }}>
              <div className="home-tool-top"><span className="home-tool-number">{item.number}</span><span className="home-tool-icon" aria-hidden="true"><Icon /></span></div>
              <div className="home-tool-copy">
                <h3 className="font-display text-[24px] font-bold leading-tight text-ink">{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <button type="button" onClick={() => onNavigate(item.id)} className="home-tool-action">{item.action}<ArrowLeft className="h-4 w-4" /></button>
            </article>
          );
        })}
      </div>
    </section>

    <section className="home-evidence-section" aria-labelledby="baseera-evidence-title">
      <div className="home-evidence-copy">
        <div className="eyebrow">الدليل قبل الانطباع</div>
        <h2 id="baseera-evidence-title" className="mt-2 font-display text-[27px] font-bold leading-tight text-ink sm:text-[32px]">النتيجة ليست كافية. اقرأ ما وراءها.</h2>
        <p className="mt-3 text-sm leading-7 text-muted sm:text-[15px]">تعرض بصيرة النص الذي وجدته في المصدر، وبياناته الأساسية، ورابطه؛ لتتمكن من المراجعة بنفسك.</p>
        <button type="button" onClick={() => onNavigate('verifier')} className="home-inline-link">جرّب التحقق الآن <ArrowLeft className="h-4 w-4" /></button>
      </div>
      <div className="home-evidence-card">
        <div className="home-evidence-label"><Quote className="h-4 w-4" /> مثال على الدليل</div>
        <blockquote className="home-evidence-quote">«إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى»</blockquote>
        <div className="home-evidence-meta"><span>حديث</span><span>صحيح</span><span>المصدر المعتمد</span></div>
        <div className="home-evidence-source">عرض المصدر والتخريج من داخل نتيجة الفحص</div>
      </div>
    </section>

    <section className="home-boundary">
      <div className="home-boundary-icon"><ShieldCheck className="h-5 w-5" /></div>
      <div>
        <div className="eyebrow">مبدأ بصيرة</div>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">لا تجعل الذكاء الاصطناعي هو المرجع</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted">الذكاء الاصطناعي يساعد في الفهم والتصنيف، أما الحكم النهائي فيرتبط بالمصدر الموثوق والدليل المعروض.</p>
      </div>
    </section>
    <div className="mx-auto max-w-[1120px] px-4 pb-12 pt-8 text-center text-xs text-faint sm:px-6">راجع المصدر بنفسك، ثم قرّر.</div>
  </div>
);