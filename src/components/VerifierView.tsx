/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  Globe,
  Image,
  Link2,
  Mic,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

import { AnalysisReport } from '../types/baseera.ts';
import { VerificationCard } from './VerificationCard.tsx';
import { extractItemsRuleBased } from '../lib/extractor.ts';
import { verifyExtractedItems } from '../lib/decisionEngine.ts';
import { apiFetch, API_BASE_URL } from '../lib/apiClient.ts';

type InputKind = 'text' | 'url' | 'image' | 'audio';

const EXAMPLES = [
  {
    label: 'آية تحتاج تحققًا',
    tone: 'green',
    text: '«اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ» [البقرة: 255]'
  },
  {
    label: 'حديث',
    tone: 'blue',
    text: 'قال رسول الله ﷺ: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»'
  },
  {
    label: 'عزو يحتاج فحصًا',
    tone: 'gold',
    text: 'قال رسول الله ﷺ: «لا إكراه في الدين قد تبين الرشد من الغي»'
  },
  {
    label: 'مسألة فقهية',
    tone: 'violet',
    text: 'ما حكم نقض الوضوء بلمس المرأة الأجنبية بغير شهوة؟'
  }
];

const INPUTS: Array<{ id: InputKind; label: string; icon: React.ReactNode }> = [
  { id: 'text', label: 'نص', icon: <FileText /> },
  { id: 'url', label: 'رابط', icon: <Link2 /> },
  { id: 'image', label: 'صورة', icon: <Image /> },
  { id: 'audio', label: 'صوت', icon: <Mic /> }
];

const STATUS_SUMMARY: Record<string, { title: string; description: string }> = {
  MATCHED: {
    title: 'وجدنا تطابقًا موثّقًا',
    description: 'العنصر مرتبط بمادة من المصدر المعتمد ويمكنك فتح الأصل ومراجعته.'
  },
  NEEDS_REVIEW: {
    title: 'وجدنا مادة تحتاج مراجعة',
    description: 'هناك مرجع ذو صلة، لكن النتيجة لا تعني تلقائيًا صحة كل ما ورد في النص.'
  },
  REFER_TO_SPECIALIST: {
    title: 'الأفضل الرجوع إلى مختص',
    description: 'المسألة حساسة أو شخصية؛ يعرض لك النظام مسار المرجع دون إصدار فتوى شخصية.'
  },
  NOT_FOUND_IN_CHECKED_SOURCES: {
    title: 'لم نجد تطابقًا موثوقًا',
    description: 'لم يظهر دليل كافٍ في المراجع التي جرى فحصها، لذلك لا نخمن النتيجة.'
  }
};

export const VerifierView: React.FC = () => {
  const [inputType, setInputType] = useState<InputKind>('text');
  const [inputText, setInputText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [ocrEngineUsed, setOcrEngineUsed] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; text_model?: string } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/ai-status')
      .then(async res => res.ok ? await res.json() : null)
      .then(data => {
        if (mounted && data) setAiStatus(data);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const chooseType = (type: InputKind) => {
    setInputType(type);
    setReport(null);
    setErrorMsg(null);
    setInputText('');
    if (type !== 'url') setUrlInput('');
    if (type !== 'image' && type !== 'audio') {
      setMediaPreview(null);
      setOcrEngineUsed(null);
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const useExample = (text: string) => {
    setInputType('text');
    setInputText(text);
    setReport(null);
    setErrorMsg(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      setErrorMsg('أدخل رابطًا أولًا.');
      return;
    }
    setIsFetchingUrl(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data?.text) throw new Error(data?.error || 'تعذر استخراج نص من الرابط.');
      setInputText(data.text);
      setReport(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر جلب محتوى الرابط.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      setMediaPreview(data);
      if (inputType === 'image') processImage(data, file.type || 'image/jpeg');
      if (inputType === 'audio') processAudio(data, file.type || 'audio/mpeg');
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64Data: string, mimeType: string) => {
    setIsProcessingOcr(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaBase64: base64Data, mediaMimeType: mimeType })
      });
      const data = await res.json();
      if (!res.ok || !data?.text) throw new Error(data?.error || 'تعذر قراءة النص من الصورة.');
      setInputText(data.text);
      setOcrEngineUsed(data.method || null);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر استخراج النص من الصورة.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const processAudio = async (base64Data: string, mimeType: string) => {
    setIsProcessingAudio(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaBase64: base64Data, mediaMimeType: mimeType })
      });
      const data = await res.json();
      if (!res.ok || !data?.text) throw new Error(data?.error || 'تعذر تحويل الصوت إلى نص.');
      setInputText(data.text);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تحويل الصوت إلى نص.');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleVerify = async () => {
    if (!inputText.trim()) {
      setErrorMsg(
        inputType === 'url'
          ? 'أدخل رابطًا ثم اضغط «جلب المحتوى»، أو الصق النص مباشرة.'
          : inputType === 'image'
            ? 'ارفع صورة تحتوي على نص واضح.'
            : inputType === 'audio'
              ? 'ارفع تسجيلًا صوتيًا واضحًا.'
              : 'الصق النص الذي تريد فحصه.'
      );
      inputRef.current?.focus();
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await apiFetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType,
          text: inputText,
          url: inputType === 'url' ? urlInput : undefined,
          mediaBase64: (inputType === 'image' || inputType === 'audio') ? mediaPreview : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data?.report) {
        throw new Error(data?.error || 'لم يُرجع الخادم تقرير تحقق صالحًا.');
      }
      setReport(data.report);
    } catch (err: any) {
      // No silent downgrade to a local result for live-source paths.
      const localItems = extractItemsRuleBased(inputText);
      const needsLive = localItems.some(item =>
        item.type === 'fiqh_question' ||
        item.type === 'tafsir_question' ||
        item.type === 'aqeedah_question'
      );

      if (needsLive) {
        setErrorMsg(err.message || 'تعذر الاتصال بخادم التحقق المباشر. لم نصدر نتيجة بديلة.');
      } else {
        try {
          const localItems = extractItemsRuleBased(inputText);
          setReport(verifyExtractedItems(localItems, inputText, inputType));
        } catch {
          setErrorMsg(err.message || 'حدث خطأ أثناء الفحص.');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setInputText('');
    setReport(null);
    setErrorMsg(null);
    setMediaPreview(null);
    setOcrEngineUsed(null);
    inputRef.current?.focus();
  };

  const reportStatus = report ? STATUS_SUMMARY[report.overall_status] || STATUS_SUMMARY.NOT_FOUND_IN_CHECKED_SOURCES : null;

  return (
    <div className="page-shell">
      <section className="mx-auto max-w-[1380px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        <div className="workspace-intro">
          <div>
            <div className="eyebrow">فاحص المحتوى</div>
            <h1 className="mt-2 max-w-3xl font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[44px]">
              اسأل عن النص. وسنأخذك إلى أصله.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted sm:text-base">
              الصق ما تريد التحقق منه، أو استخدم رابطًا أو صورة أو تسجيلًا.
              تبدأ بصيرة بفهم المحتوى، ثم تبحث في المراجع المرتبطة به، وتفصل بين ما تم إثباته وما يحتاج مراجعة.
            </p>
          </div>

          <div className="mini-trust-card">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <span className="trust-icon"><ShieldCheck className="h-4 w-4" /></span>
              كيف تعمل بصيرة؟
            </div>
            <div className="mt-3 space-y-2 text-xs leading-5 text-muted">
              <div><b>01</b> فهم النص والعزو والسياق</div>
              <div><b>02</b> البحث في المرجع المناسب</div>
              <div><b>03</b> عرض الدليل والامتناع عند نقصه</div>
            </div>
          </div>
        </div>

        <div className="verifier-layout mt-7">
          <div className="tool-card">
            <div className="tool-card-head">
              <div>
                <div className="text-sm font-bold text-ink">ما الذي تريد فحصه؟</div>
                <div className="mt-1 text-xs text-muted">ابدأ من النص؛ ويمكنك تغيير نوع الإدخال متى احتجت.</div>
              </div>
              {aiStatus?.enabled && (
                <div className="ai-pill">
                  <Sparkles className="h-3.5 w-3.5" />
                  تحليل مساعد بالذكاء الاصطناعي
                </div>
              )}
            </div>

            <div className="input-tabs" role="tablist" aria-label="نوع الإدخال">
              {INPUTS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={inputType === item.id}
                  onClick={() => chooseType(item.id)}
                  className={`input-tab ${inputType === item.id ? 'input-tab-active' : ''}`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {inputType === 'url' && (
              <div className="input-row">
                <label className="sr-only" htmlFor="baseera-url">رابط الصفحة</label>
                <div className="input-with-icon">
                  <Globe className="h-4 w-4" />
                  <input
                    id="baseera-url"
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="ألصق رابط المقال أو الصفحة هنا"
                  />
                </div>
                <button type="button" onClick={handleFetchUrl} disabled={isFetchingUrl} className="btn btn-secondary min-h-11 px-4">
                  {isFetchingUrl ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  جلب النص
                </button>
              </div>
            )}

            {(inputType === 'image' || inputType === 'audio') && (
              <label className="upload-zone">
                <input
                  type="file"
                  accept={inputType === 'image' ? 'image/*' : 'audio/*'}
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <span className="upload-icon" aria-hidden="true">
                  <Upload className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-ink">
                  {inputType === 'image' ? 'ارفع صورة تحتوي على نص' : 'ارفع تسجيلًا صوتيًا'}
                </span>
                <span className="text-xs text-muted">
                  {inputType === 'image'
                    ? (isProcessingOcr ? 'جارٍ استخراج النص…' : (ocrEngineUsed ? `تم الاستخراج عبر ${ocrEngineUsed}` : 'ثم راجع النص قبل الفحص'))
                    : (isProcessingAudio ? 'جارٍ تحويل الصوت…' : 'سيُحوّل التسجيل إلى نص أولًا')}
                </span>
              </label>
            )}

            <div className="textarea-wrap">
              <label htmlFor="baseera-input" className="sr-only">النص المراد فحصه</label>
              <textarea
                id="baseera-input"
                ref={inputRef}
                rows={8}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="الصق هنا الآية، الحديث، النص، أو السؤال الذي تريد التحقق منه…"
                className="main-textarea"
              />
              {inputText && (
                <button type="button" className="clear-input" onClick={clearAll} aria-label="مسح النص">
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="textarea-meta">
                <span>{inputText.length.toLocaleString('ar-EG')} حرف</span>
                <span>لا تُصدر بصيرة حكمًا اعتمادًا على معرفة النموذج وحدها.</span>
              </div>
            </div>

            {errorMsg && (
              <div className="error-box" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleVerify}
              disabled={isProcessing || isProcessingOcr || isProcessingAudio || isFetchingUrl || !inputText.trim()}
              className="verify-cta"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  جارٍ فحص المحتوى…
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  تحقّق من النص
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          <aside className="side-column">
            <div className="side-card">
              <div className="eyebrow">أمثلة جاهزة</div>
              <p className="mt-2 text-xs leading-6 text-muted">
                جرّب حالات مختلفة لترى كيف تُعرض النتيجة، ثم استبدلها بنصك.
              </p>
              <div className="mt-4 space-y-2">
                {EXAMPLES.map(example => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => useExample(example.text)}
                    className={`example-item example-${example.tone}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="example-dot" aria-hidden="true" />
                      <span className="truncate">{example.label}</span>
                    </span>
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="side-card side-card-muted">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand" />
                ماذا نتحقق منه؟
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-semibold text-muted">
                {['الآيات', 'الأحاديث', 'المصطلحات', 'المسائل الفقهية'].map(item => (
                  <div key={item} className="scope-chip">{item}</div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {report && (
          <section className="mt-9" aria-live="polite">
            <div className="result-summary-card">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="eyebrow">تقرير التحقق · #{report.id.slice(-6)}</div>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                    {reportStatus?.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
                    {reportStatus?.description}
                  </p>
                </div>
                <div className="result-counts">
                  <span><b>{report.verifier_stats.matched_count}</b> مطابق</span>
                  <span><b>{report.verifier_stats.needs_review_count}</b> مراجعة</span>
                  <span><b>{report.verifier_stats.not_found_count}</b> بلا تطابق</span>
                </div>
              </div>

              <div className="summary-strip mt-5">
                <span className="summary-status-dot" aria-hidden="true" />
                <span>{report.summary_ar}</span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {report.verifications.map((item, index) => (
                <VerificationCard key={item.id || index} result={item} index={index} viewMode="simple" />
              ))}
            </div>
          </section>
        )}

        {!report && !isProcessing && (
          <section className="how-it-works mt-14">
            <div className="eyebrow">رحلة الفحص</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink">ثلاث خطوات يفهمها أي مستخدم.</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                ['01', 'أدخل المحتوى', 'الصق النص أو أدخل الصفحة أو ارفع صورة أو صوتًا.'],
                ['02', 'دع بصيرة تبحث', 'الذكاء الاصطناعي يساعد في فهم النص، والمصدر يزوّدنا بالمادة.'],
                ['03', 'اقرأ النتيجة', 'ترى الحالة، الدليل، والرابط الأصلي — أو امتناعًا واضحًا عندما لا يكفي الدليل.']
              ].map(([number, title, text]) => (
                <div key={number} className="how-card">
                  <span className="step-number step-number-large">{number}</span>
                  <div className="mt-4 font-bold text-ink">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
};
