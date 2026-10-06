import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Image,
  LoaderCircle,
  Mic,
  Search,
  Upload,
  BookOpen,
  ScrollText,
  Languages,
  Scale,
  X
} from 'lucide-react';
import { AnalysisReport } from '../types/baseera.ts';
import { VerificationCard } from './VerificationCard.tsx';
import { apiFetch } from '../lib/apiClient.ts';

type InputKind = 'text' | 'image' | 'audio';
type VerifyCategory = 'ayah' | 'hadith' | 'term' | 'fiqh_question';

const CATEGORIES: Array<{ id: VerifyCategory; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'ayah', label: 'القرآن', hint: 'المصحف', icon: <BookOpen /> },
  { id: 'hadith', label: 'الحديث', hint: 'الدرر السنية', icon: <ScrollText /> },
  { id: 'term', label: 'مصطلح', hint: 'الجمهرة', icon: <Languages /> },
  { id: 'fiqh_question', label: 'فقه', hint: 'الموسوعة الفقهية', icon: <Scale /> }
];

const INPUTS: Array<{ id: InputKind; label: string; icon: React.ReactNode }> = [
  { id: 'text', label: 'نص', icon: <FileText /> },
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
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
    setReport(null);
    setErrorMsg(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const clearAll = () => {
    setInputText('');
    setMediaPreview(null);
    setReport(null);
    setErrorMsg(null);
    inputRef.current?.focus();
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
        inputType === 'image'
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
    !isProcessingOcr &&
    !isProcessingAudio;

  return (
    <div className="page-shell">
      <section className="mx-auto max-w-[980px] px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-4">
          <div className="eyebrow">بصيرة · التحقق</div>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[38px]">
            تحقّق من المحتوى
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            اختر نوع المحتوى، ثم ألصق النص أو ارفع صورة أو تسجيلًا للفحص.
          </p>
        </div>

        <div className="tool-card p-4 sm:p-5">
          {/* شريط اختيار نوع المحتوى وطريقة الإدخال مدمج وملتصق مباشرة بصندوق الكتابة */}
          {/* خيارات نوع المحتوى ووسيلة الإدخال في سطرين مستقلين ومنظمين */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-line">
            {/* السطر الأول: نوع المحتوى */}
            <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="نوع المحتوى">
              <span className="text-xs font-bold text-ink shrink-0">نوع المحتوى:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
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
            </div>

            {/* السطر الثاني: وسيلة الإدخال */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-line/60">
              <span className="text-xs font-bold text-ink shrink-0">وسيلة الإدخال:</span>
              <div className="input-tabs" role="tablist" aria-label="وسيلة الإدخال">
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

          {/* رفع الصور والتسجيلات الصوتية */}
          {(inputType === 'image' || inputType === 'audio') && (
            <div className="space-y-3">
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
                  {inputType === 'image'
                    ? (mediaPreview ? 'تغيير الصورة المرفوعة' : 'اختر صورة لفحصها')
                    : (mediaPreview ? 'تغيير التسجيل الصوتي' : 'اختر تسجيلًا صوتيًا')}
                </span>
                <span className="text-xs text-muted">
                  {inputType === 'image'
                    ? (isProcessingOcr ? 'جارٍ استخراج النص بالتعرف الضوئي…' : (inputText ? 'تم استخراج النص بنجاح' : 'سنحوّل الصورة إلى نص بدقة أولاً'))
                    : (isProcessingAudio ? 'جارٍ تحويل الصوت إلى نص…' : (inputText ? 'تم تحويل الصوت إلى نص بنجاح' : 'سنحوّل التسجيل إلى نص بدقة أولاً'))}
                </span>
              </label>
              {inputText && (
                <div className="textarea-wrap">
                  <div className="mb-1 text-xs font-semibold text-muted">
                    {inputType === 'image' ? 'النص المستخرج من الصورة:' : 'النص المستخرج من التسجيل الصوتي:'}
                  </div>
                  <textarea
                    rows={3}
                    value={inputText}
                    onChange={e => {
                      setInputText(e.target.value);
                      if (report) setReport(null);
                    }}
                    className="main-textarea"
                  />
                </div>
              )}
            </div>
          )}

          {/* صندوق كتابة النص المباشر — يظهر فقط عند اختيار "نص" */}
          {inputType === 'text' && (
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
                      ? 'ألصق الآية أو جزءًا منها، وسنبحث عنها في المصحف المعتمد…'
                      : category === 'hadith'
                        ? 'ألصق نص الحديث كما ورد لديك…'
                        : category === 'term'
                          ? 'اكتب المصطلح الذي تريد التحقق منه…'
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
          )}

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
                ابدأ التحقق
              </>
            )}
          </button>

          {!inputText && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted">ابدأ بمثال:</span>
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