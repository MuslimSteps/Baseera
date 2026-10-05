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
  BookOpen,
  ScrollText,
  Languages,
  Scale,
  BookOpenCheck,
  X
} from 'lucide-react';
import { AnalysisReport } from '../types/baseera.ts';
import { VerificationCard } from './VerificationCard.tsx';
import { apiFetch } from '../lib/apiClient.ts';

type InputKind = 'text' | 'url' | 'image' | 'audio';
type VerifyCategory = 'ayah' | 'hadith' | 'tafsir_question' | 'aqeedah_question' | 'term' | 'fiqh_question';

const CATEGORIES: Array<{ id: VerifyCategory; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'ayah', label: 'القرآن', hint: 'المصحف', icon: <BookOpen /> },
  { id: 'hadith', label: 'الحديث', hint: 'الدرر السنية', icon: <ScrollText /> },
  { id: 'tafsir_question', label: 'التفسير', hint: 'موسوعة التفسير', icon: <BookOpenCheck /> },
  { id: 'aqeedah_question', label: 'العقيدة', hint: 'الموسوعة العقدية', icon: <ShieldCheck /> },
  { id: 'term', label: 'مصطلح', hint: 'الجمهرة', icon: <Languages /> },
  { id: 'fiqh_question', label: 'فقه', hint: 'الموسوعة الفقهية', icon: <Scale /> }
];

const INPUTS: Array<{ id: InputKind; label: string; icon: React.ReactNode }> = [
  { id: 'text', label: 'نص', icon: <FileText /> },
  { id: 'url', label: 'رابط', icon: <Link2 /> },
  { id: 'image', label: 'صورة', icon: <Image /> },
  { id: 'audio', label: 'صوت', icon: <Mic /> }
];

const EXAMPLES: Array<{ label: string; category: VerifyCategory; text: string }> = [
  { label: 'آية قرآنية', category: 'ayah', text: 'مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ' },
  { label: 'حديث شريف', category: 'hadith', text: 'قال رسول الله ﷺ: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى»' },
  { label: 'سؤال فقهي', category: 'fiqh_question', text: 'هل الوضوء ينتقض بالنوم اليسير؟' }
];

export const VerifierView: React.FC = () => {
  const [inputType, setInputType] = useState<InputKind>('text');
  const [category, setCategory] = useState<VerifyCategory | null>(null);
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

  const chooseCategory = (value: VerifyCategory) => {
    setCategory(value);
    setReport(null);
    setErrorMsg(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const useExample = (cat: VerifyCategory, text: string) => {
    setCategory(cat);
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
          targetCategory: category || 'auto',
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

  const canVerify = Boolean(category && inputText.trim()) &&
    !isProcessing &&
    !isFetchingUrl &&
    !isProcessingOcr &&
    !isProcessingAudio;

  return (
    <div className="page-shell">
      <section className="mx-auto max-w-[980px] px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-4">
          <div className="eyebrow">بصيرة · التحقق</div>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[38px]">
            تحقق من المحتوى
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            اختر نوع المحتوى ثم أدخل النص المراد فحصه.
          </p>
        </div>

        <div className="tool-card p-4 sm:p-5">
          {/* شريط اختيار نوع المحتوى وطريقة الإدخال مدمج وملتصق مباشرة بصندوق الكتابة */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label="نوع المحتوى">
                <span className="text-xs font-bold text-ink ms-0.5">نوع المحتوى:</span>
                {CATEGORIES.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={category === item.id}
                    onClick={() => chooseCategory(item.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      category === item.id
                        ? 'bg-brand text-white shadow-sm ring-1 ring-brand'
                        : 'bg-page hover:bg-surface border border-line text-muted hover:text-ink'
                    }`}
                  >
                    <span className="h-3.5 w-3.5 flex items-center justify-center shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {category === item.id && (
                      <span className="text-[10px] opacity-85 font-normal">({item.hint})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="input-tabs" role="tablist" aria-label="طريقة الإدخال">
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
            </div>
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
              rows={3}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                if (report) setReport(null);
              }}
              placeholder={
                !category
                  ? 'اختر نوع المحتوى من الشريط أعلاه أولًا…'
                  : category === 'ayah'
                    ? 'ألصق الآية أو جزءًا منها…'
                    : category === 'hadith'
                      ? 'ألصق نص الحديث…'
                      : category === 'term'
                        ? 'اكتب المصطلح الذي تريد التحقق منه…'
                        : category === 'tafsir_question'
                          ? 'اكتب سؤالك في التفسير…'
                          : category === 'aqeedah_question'
                            ? 'اكتب سؤالك في العقيدة…'
                            : 'اكتب السؤال الفقهي…'
              }
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
                  onClick={() => useExample(example.category, example.text)}
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