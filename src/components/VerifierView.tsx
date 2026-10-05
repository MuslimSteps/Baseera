import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Globe,
  Image,
  Link2,
  LoaderCircle,
  Mic,
  Search,
  ShieldCheck,
  Upload,
  X
} from 'lucide-react';
import { AnalysisReport } from '../types/baseera.ts';
import { VerificationCard } from './VerificationCard.tsx';
import { apiFetch } from '../lib/apiClient.ts';

type InputKind = 'text' | 'url' | 'image' | 'audio';

const INPUTS: Array<{ id: InputKind; label: string; icon: React.ReactNode }> = [
  { id: 'text', label: 'نص', icon: <FileText /> },
  { id: 'url', label: 'رابط', icon: <Link2 /> },
  { id: 'image', label: 'صورة', icon: <Image /> },
  { id: 'audio', label: 'صوت', icon: <Mic /> }
];

const EXAMPLES = [
  { label: 'آية', text: 'مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ' },
  { label: 'حديث', text: 'قال رسول الله ﷺ: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»' },
  { label: 'نص دعوي', text: 'قال الله تعالى: «وَقُلْ رَبِّ زِدْنِي عِلْمًا»' }
];

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const chooseType = (type: InputKind) => {
    setInputType(type);
    setReport(null);
    setErrorMsg(null);
    setInputText('');
    setUrlInput('');
    setMediaPreview(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const useExample = (text: string) => {
    setInputType('text');
    setInputText(text);
    setUrlInput('');
    setReport(null);
    setErrorMsg(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const clearAll = () => {
    setInputText('');
    setUrlInput('');
    setMediaPreview(null);
    setReport(null);
    setErrorMsg(null);
    inputRef.current?.focus();
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      setErrorMsg('ألصق الرابط أولاً.');
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
      if (!res.ok || !data?.text) throw new Error(data?.error || 'تعذر قراءة محتوى الرابط.');
      setInputText(data.text);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error: any) {
      setErrorMsg(error?.message || 'تعذر جلب محتوى الرابط.');
    } finally {
      setIsFetchingUrl(false);
    }
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
    } catch (error: any) {
      setErrorMsg(error?.message || 'تعذر استخراج النص من الصورة.');
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
    } catch (error: any) {
      setErrorMsg(error?.message || 'تعذر تحويل الصوت إلى نص.');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      setMediaPreview(data);
      if (inputType === 'image') void processImage(data, file.type || 'image/jpeg');
      if (inputType === 'audio') void processAudio(data, file.type || 'audio/mpeg');
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = '';
  };

  const handleVerify = async () => {
    if (!inputText.trim()) {
      setErrorMsg(
        inputType === 'url'
          ? 'ألصق رابطًا ثم اجلب محتواه.'
          : inputType === 'image'
            ? 'ارفع صورة تحتوي على النص.'
            : inputType === 'audio'
              ? 'ارفع تسجيلًا صوتيًا واضحًا.'
              : 'ألصق النص الذي تريد فحصه.'
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
      if (!res.ok || !data?.report) throw new Error(data?.error || 'تعذر إرجاع نتيجة تحقق.');
      setReport(data.report);
      window.setTimeout(() => document.getElementById('baseera-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    } catch (error: any) {
      setErrorMsg(error?.message || 'حدث خطأ أثناء الفحص.');
    } finally {
      setIsProcessing(false);
    }
  };

  const canVerify = Boolean(inputText.trim()) &&
    !isProcessing &&
    !isFetchingUrl &&
    !isProcessingOcr &&
    !isProcessingAudio;

  return (
    <div className="page-shell">
      <section className="mx-auto max-w-[980px] px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-5">
          <div className="eyebrow">بصيرة · التحقق</div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]">
            تحقق قبل أن تنشر
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            الصق النص أو أدخل رابطًا أو ارفع صورة أو تسجيلًا، ثم اقرأ النتيجة ودليلها من المصدر.
          </p>
        </div>

        <div className="tool-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="trust-icon"><ShieldCheck className="h-4 w-4" /></span>
              <span className="text-sm font-bold text-ink">فحص المحتوى</span>
            </div>
            <span className="text-[11px] font-semibold text-muted">المصادر المرجعية هي الأساس</span>
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
              <label className="sr-only" htmlFor="baseera-url">الرابط</label>
              <div className="input-with-icon">
                <Globe className="h-4 w-4" />
                <input
                  id="baseera-url"
                  type="url"
                  dir="ltr"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/..."
                />
              </div>
              <button type="button" onClick={() => void handleFetchUrl()} disabled={isFetchingUrl} className="btn btn-secondary min-h-11 px-4">
                {isFetchingUrl ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                قراءة الرابط
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
                {inputType === 'image' ? 'اختر صورة' : 'اختر تسجيلًا صوتيًا'}
              </span>
              <span className="text-xs text-muted">
                {inputType === 'image'
                  ? (isProcessingOcr ? 'جارٍ استخراج النص…' : (inputText ? 'تم استخراج النص' : 'سنحوّل الصورة إلى نص أولًا'))
                  : (isProcessingAudio ? 'جارٍ تحويل الصوت…' : (inputText ? 'تم تحويل التسجيل إلى نص' : 'سنحوّل التسجيل إلى نص أولًا'))}
              </span>
            </label>
          )}

          <div className="textarea-wrap">
            <label htmlFor="baseera-input" className="sr-only">النص المراد فحصه</label>
            <textarea
              id="baseera-input"
              ref={inputRef}
              rows={6}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                if (report) setReport(null);
              }}
              placeholder="ألصق النص هنا…"
              className="main-textarea"
            />
            {inputText && (
              <button type="button" className="clear-input" onClick={clearAll} aria-label="مسح النص">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="error-box" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={!canVerify}
            className="verify-cta"
          >
            {isProcessing ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                جارٍ التحقق…
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                فحص الآن
              </>
            )}
          </button>

          {!inputText && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted">جرّب:</span>
              {EXAMPLES.map(example => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => useExample(example.text)}
                  className="example-item !min-h-9 !w-auto !justify-start !rounded-full !px-3"
                >
                  <span className="example-dot" />
                  {example.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {report && (
          <section id="baseera-results" className="mt-8" aria-live="polite">
            {report.verifications.length > 1 && (
              <div className="mb-3 text-xs font-semibold text-muted">
                تم فحص {report.verifications.length.toLocaleString('ar-EG')} عناصر
              </div>
            )}
            <div className="space-y-4">
              {report.verifications.map((item, index) => (
                <VerificationCard key={item.id || index} result={item} index={index} viewMode="simple" />
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
};