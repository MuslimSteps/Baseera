/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import https from 'https';
import { normalizeArabic, normalizeArabicStrict } from './normalizer.ts';
import { fetchRemoteSafely, readTextWithLimit } from './safeRemoteFetch.ts';

export interface DorarHadithResult {
  text: string;
  rawi: string;
  muhaddith: string;
  book: string;
  numberOrPage: string;
  grade: string;
  gradeCategory: 'sahih' | 'hasan' | 'weak' | 'fabricated' | 'unknown' | 'disputed';
  isDisputed?: boolean;
  disputeDetails?: string;
  matchQuality?: 'exact' | 'partial' | 'close';
}

const dorarMemoryCache = new Map<string, DorarHadithResult[]>();

/**
 * Normalizes text to Arabic search query
 */
export function cleanSearchQuery(query: string): string {
  return query
    .replace(/[«»"“؟?.,!]/g, '')
    .replace(/^(?:ما\s+(?:هو\s+)?حكم(?:\s+الشرع(?:\s+في)?)?|هل\s+(?:يجوز|يصح)|ما\s+القول\s+في|حكم|هل|ما|ماذا|كيف|ما\s+رأي\s+الشرع\s+في)\s*/gi, '')
    .replace(/^(?:في\s+القرآن(?:\s+الكريم)?|قال\s+رسول\s+الله|قال\s+النبي|في\s+الحديث|عن\s+النبي|ورد\s+في\s+الحديث|روي\s+أن|سمعت\s+رسول\s+الله)[:\s]*/gi, '')
    .trim()
    .slice(0, 120);
}

/**
 * Generate smart candidate search queries for any question, quote, or claim
 */
export function generateSearchQueries(rawText: string): string[] {
  const text = (rawText || '').trim();
  const queries: string[] = [];

  const cleanQ = cleanSearchQuery(text);
  if (cleanQ) queries.push(cleanQ);

  const norm = cleanQ.replace(/\s+/g, ' ');

  // ── Purification & Prayer ───────────────────────────────────────────
  if (norm.includes('الصلاة بغير وضوء') || norm.includes('صلاة بغير وضوء') || norm.includes('صلاة بدون وضوء')) {
    queries.push('لا تقبل صلاة بغير طهور');
    queries.push('صلاة بغير طهور');
  }
  if (norm.includes('لحم الإبل') || norm.includes('لحوم الإبل')) {
    queries.push('الوضوء من لحوم الإبل');
    queries.push('أأتوضأ من لحوم الإبل');
  }
  if (norm.includes('قنوت') && (norm.includes('فجر') || norm.includes('صبح'))) {
    queries.push('القنوت في صلاة الفجر');
    queries.push('قنت في صلاة الصبح');
  }
  if (norm.includes('المسح على الخفين') || norm.includes('مسح على الجوارب') || norm.includes('مسح على الخفين')) {
    queries.push('المسح على الخفين');
  }

  // ── Oaths & Vows ────────────────────────────────────────────────────
  if (norm.includes('الحلف بغير الله') || norm.includes('حلف بغير الله') || norm.includes('القسم بغير الله')) {
    queries.push('من حلف بغير الله');
    queries.push('حلف بغير الله');
  }
  if (norm.includes('النذر') || norm.includes('نذر')) {
    queries.push('من نذر أن يطيع الله');
    queries.push('النذر');
    queries.push('الوفاء بالنذر');
  }

  // ── Social Ethics (Backbiting, Lying, etc.) ─────────────────────────
  if (norm.includes('الغيبة') || norm.includes('غيبة')) {
    queries.push('اغتاب');
    queries.push('الغيبة ذكرك أخاك');
    queries.push('يغتاب');
    queries.push('لا يغتب بعضكم بعضا');
  }
  if (norm.includes('النميمة') || norm.includes('نميمة')) {
    queries.push('لا يدخل الجنة نمام');
    queries.push('النميمة');
  }
  if (norm.includes('الكذب') || norm.includes('كذب')) {
    queries.push('إن الكذب يهدي إلى الفجور');
    queries.push('عليكم بالصدق');
  }
  if (norm.includes('الحسد') || norm.includes('حسد')) {
    queries.push('إياكم والحسد');
    queries.push('لا حسد إلا في اثنتين');
  }
  if (norm.includes('الغضب') || norm.includes('غضب')) {
    queries.push('لا تغضب');
    queries.push('الغضب جمرة');
  }

  // ── Finance & Trade ─────────────────────────────────────────────────
  if (norm.includes('الربا') || norm.includes('ربا')) {
    queries.push('لعن الله آكل الربا');
    queries.push('الربا سبعون');
  }
  if (norm.includes('بيع الغرر') || norm.includes('الغرر')) {
    queries.push('نهى عن بيع الغرر');
  }
  if (norm.includes('بيع العينة') || norm.includes('العينة')) {
    queries.push('تبايعتم بالعينة');
  }
  if (norm.includes('الزكاة')) {
    queries.push('فريضة الزكاة');
    queries.push('الزكاة');
  }
  if (norm.includes('الرشوة') || norm.includes('رشوة')) {
    queries.push('لعن الله الراشي والمرتشي');
  }

  // ── Entertainment & Modern Issues ───────────────────────────────────
  if (norm.includes('الغناء') || norm.includes('غناء') || norm.includes('الموسيقى') || norm.includes('موسيقى')) {
    queries.push('المعازف');
    queries.push('الكبائر الغناء');
    queries.push('لا تبيعوا القينات');
  }
  if (norm.includes('ألعاب الفيديو') || norm.includes('لعب الفيديو') || norm.includes('فيديو')) {
    queries.push('اللهو الباطل');
    queries.push('كل لهو يلهو به الرجل حرام');
    queries.push('اللهو المباح');
    queries.push('من لهو الحديث');
  }
  if (norm.includes('التصوير') || norm.includes('الصور') || norm.includes('الصورة')) {
    queries.push('إن أشد الناس عذابا عند الله المصورون');
    queries.push('المصورون');
  }
  if (norm.includes('الدخان') || norm.includes('التدخين') || norm.includes('السجائر')) {
    queries.push('لا ضرر ولا ضرار');
    queries.push('كل مسكر حرام');
  }

  // ── Family & Social ─────────────────────────────────────────────────
  if (norm.includes('الطلاق')) {
    queries.push('أبغض الحلال إلى الله الطلاق');
    queries.push('الطلاق');
  }
  if (norm.includes('الصلة') || norm.includes('صلة الرحم')) {
    queries.push('صل رحمك');
    queries.push('من أحب أن يبسط له في رزقه');
  }
  if (norm.includes('العقوق') || norm.includes('عقوق الوالدين')) {
    queries.push('ألا أنبئكم بأكبر الكبائر');
    queries.push('عقوق الوالدين');
  }

  // ── Fasting ─────────────────────────────────────────────────────────
  if (norm.includes('صيام التطوع') || (norm.includes('صيام') && norm.includes('التطوع'))) {
    queries.push('من صام يوما في سبيل الله');
    queries.push('صيام التطوع');
  }
  if (norm.includes('صيام الدهر') || (norm.includes('صيام') && norm.includes('الدهر'))) {
    queries.push('لا صام من صام الدهر');
  }

  // Extract first meaningful content words as additional queries
  const words = cleanQ.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    queries.push(words.slice(0, 3).join(' '));
  } else if (words.length === 1) {
    queries.push(words[0]);
  }

  return [...new Set(queries.filter(q => q && q.length >= 2))];
}

/**
 * Determine grade category from the Arabic grade text
 */
export function classifyGrade(gradeStr: string): 'sahih' | 'hasan' | 'weak' | 'fabricated' | 'disputed' | 'unknown' {
  const g = gradeStr || '';
  if (/مختلف فيه|اختلف في صحته|اختلف في إسناده/.test(g)) {
    return 'disputed';
  }
  if (/موضوع|مكذوب|باطل|لا أصل له|كذب/.test(g)) {
    return 'fabricated';
  }
  if (/غير صحيح|ليس بصحيح|لا يصح|لا يثبت|ضعيف|منكر|واهٍ|واهي|متروك|فيه نظر|معلول|مدلس|لين|أوهى|ساقط|غير محفوظ/.test(g)) {
    return 'weak';
  }
  if (/صحيح|إسناده صحيح|على شرط الشيخين|على شرط البخاري|على شرط مسلم|رجاله ثقات/.test(g)) {
    return 'sahih';
  }
  if (/حسن|إسناده حسن|جيد|صالح/.test(g)) {
    return 'hasan';
  }
  return 'unknown';
}

/**
 * Fetch raw HTML from Dorar.net official API
 */
function fetchDorarApiRaw(query: string): Promise<string> {
  return new Promise((resolve) => {
    const cleanQ = query.trim().slice(0, 120);
    if (!cleanQ || cleanQ.length < 2) {
      return resolve('');
    }

    const options = {
      hostname: 'dorar.net',
      port: 443,
      path: '/dorar_api.json?skey=' + encodeURIComponent(cleanQ),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ar,en;q=0.9',
        'Connection': 'keep-alive'
      },
      timeout: 6000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json?.ahadith?.result || '');
        } catch {
          resolve('');
        }
      });
    });

    req.on('error', () => resolve(''));
    req.on('timeout', () => {
      req.destroy();
      resolve('');
    });
    req.end();
  });
}

/**
 * Parses the HTML returned by Dorar.net
 */
export function parseDorarHtml(html: string): DorarHadithResult[] {
  if (!html || !html.includes('hadith')) return [];

  const results: DorarHadithResult[] = [];
  const hadithBlocks = html.split('<div class="hadith"');

  for (let i = 1; i < hadithBlocks.length; i++) {
    const block = '<div class="hadith"' + hadithBlocks[i];

    // Extract hadith text
    const textMatch = block.match(/<div class="hadith"[^>]*>([\s\S]*?)<\/div>/);
    let text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '').replace(/^\d+\s*-\s*/, '').trim() : '';
    text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');

    // Extract regular fields
    const getField = (label: string): string => {
      const idx = block.indexOf(label);
      if (idx === -1) return '';
      const slice = block.slice(idx);
      const afterSpan = slice.indexOf('</span>');
      if (afterSpan === -1) return '';
      const content = slice.slice(afterSpan + 7);
      const nextSpan = content.search(/<span|<div|<\/div/);
      const valHtml = nextSpan !== -1 ? content.slice(0, nextSpan) : content;
      return valHtml.replace(/<[^>]+>/g, '').trim();
    };

    const rawi = getField('الراوي');
    const muhaddith = getField('المحدث');
    const book = getField('المصدر');
    const numberOrPage = getField('الصفحة أو الرقم');

    // Grade is inside <span>
    const gradeMatch = block.match(/خلاصة حكم المحدث:<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/);
    const grade = gradeMatch ? gradeMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    if (text) {
      results.push({
        text,
        rawi,
        muhaddith,
        book,
        numberOrPage,
        grade,
        gradeCategory: classifyGrade(grade)
      });
    }
  }

  return results;
}

/**
 * Live search on Dorar.net official Hadith API with caching
 */
export async function searchDorarApiLive(query: string): Promise<DorarHadithResult[]> {
  const cleanQ = cleanSearchQuery(query).slice(0, 100);
  if (!cleanQ || cleanQ.length < 2) return [];

  const cacheKey = cleanQ.toLowerCase();
  if (dorarMemoryCache.has(cacheKey)) {
    return dorarMemoryCache.get(cacheKey)!;
  }

  // Primary: Fast, reliable Python connector (bypasses TLS fingerprint block on Windows)
  try {
    const { execFile } = await import('child_process');
    const path = await import('path');
    const scriptPath = path.resolve(process.cwd(), 'src/lib/dorar_hadith.py');

    const results = await new Promise<DorarHadithResult[]>((resolve) => {
      execFile(process.platform === 'win32' ? 'python' : 'python3', [scriptPath, cleanQ], { timeout: 10000, encoding: 'utf-8' }, (error, stdout) => {
        if (error || !stdout) {
          return resolve([]);
        }
        try {
          const data = JSON.parse(stdout);
          if (data && data.success && Array.isArray(data.results)) {
            resolve(data.results);
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    });

    if (results.length > 0) {
      dorarMemoryCache.set(cacheKey, results);
      return results;
    }
  } catch (pyErr) {
    console.warn('Python Dorar connector failed, trying raw fetch:', pyErr);
  }

  // Fallback: Node https fetch
  try {
    const html = await fetchDorarApiRaw(cleanQ);
    const results = parseDorarHtml(html);
    dorarMemoryCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Dorar API search error:', error);
    return [];
  }
}

/**
 * Build the Dorar.net Fiqh Encyclopedia (feqhia) direct search URL
 * Used when live Fiqh API is unavailable (Cloudflare blocks) — links user directly
 */
export function buildDorarFiqhUrl(query: string): string {
  // Fiqh URLs must preserve question intent (especially "حكم").
  const clean = query.replace(/[«»"“؟?.,!]/g, '').trim().slice(0, 180);
  return `https://dorar.net/feqhia/search?q=${encodeURIComponent(clean || query)}`;
}

/**
 * Generate fiqh-specific search keywords from a question
 */
export function generateFiqhSearchKeywords(rawText: string): string[] {
  const clean = rawText.replace(/[«»"“؟?.,!]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(/\s+/).filter(w => w.length > 2 && ![
    'ما','هو','هي','هل','في','من','على','عن','الى','إلى','مع','بعد','قبل',
    'أن','إن','رأي','الشرع','الشرعي','الشريعة','الإسلام','الإسلامي','الفقه','الدين'
  ].includes(w));
  return [...new Set(words)];
}

type DorarFiqhLiveResult = {
  found: boolean;
  title: string;
  text: string;
  detailedRuling?: string;
  url: string;
  source: string;
  allResults: Array<{ title: string; text: string; url: string }>;
};

const CANONICAL_FIQH_SECTION_ANCHORS: Array<{ subject: string; intent: 'ruling'; title: string; url: string }> = [
  {
    subject: 'ختان',
    intent: 'ruling',
    title: 'المبحث الرابع: حكم الختان',
    url: 'https://dorar.net/feqhia/218'
  },
  {
    subject: 'وضوء',
    intent: 'ruling',
    title: 'المبحث الثالث: مواطن مشروعيته — حكم الوضوء للصلاة',
    url: 'https://dorar.net/feqhia/240'
  }
];

function getCanonicalFiqhAnchor(query: string): { title: string; url: string } | null {
  const normalized = normalizeArabic(query || '');
  const isRulingQuestion =
    /ما\s+(?:هو\s+)?حكم|هل\s+(?:يجوز|يجب|يصح)|(?:حكم|واجب|فرض|حرام|مكروه|مستحب|جائز)/i.test(normalized);

  if (!isRulingQuestion) return null;

  const anchor = CANONICAL_FIQH_SECTION_ANCHORS.find(
    candidate => normalized.includes(candidate.subject) || normalized.includes('ال' + candidate.subject)
  );

  return anchor ? { title: anchor.title, url: anchor.url } : null;
}

async function fetchDorarFiqhArticle(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const response = await fetchRemoteSafely(url, {
      headers: {
        'User-Agent': 'Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9'
      }
    });

    if (!response.ok) return null;
    const raw = await readTextWithLimit(response, 1_500_000);
    if (!raw) return null;

    const h1Match = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = h1Match
      ? h1Match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
      : '';

    const pos = raw.indexOf('w-100 mt-4');
    if (pos === -1) return title ? { title, text: '' } : null;

    let chunk = raw.slice(pos, pos + 9000);
    chunk = chunk.replace(/<span class="tip"[^>]*>[\s\S]*?<\/span>/gi, '');
    let text = chunk
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    for (const marker of ['المادة في سؤال وجواب', 'انظر أيضا', 'الرابط المختصر']) {
      const index = text.indexOf(marker);
      if (index > 100) text = text.slice(0, index).trim();
    }

    return title || text ? { title, text: text.slice(0, 1800) } : null;
  } catch {
    return null;
  }
}

const FIQH_GENERIC_STOPWORDS = new Set([
  'ما', 'هو', 'هي', 'هل', 'في', 'من', 'على', 'عن', 'الى', 'إلى', 'مع', 'بعد', 'قبل',
  'أن', 'إن', 'الشرع', 'الشرعي', 'الشريعة', 'الإسلام', 'الإسلامي', 'الفقه', 'الدين',
  'حكم', 'احكام', 'أحكام', 'يجوز', 'يجب', 'يصح', 'يحرم', 'حرام', 'فرض', 'واجب'
]);

function inferFiqhIntentForFallback(query: string): 'ruling' | 'benefits' | 'definition' | 'timing' | 'conditions' | 'unknown' {
  const n = normalizeArabic(query || '');
  if (/ما\\s+(?:هو\\s+)?حكم|هل\\s+(?:يجوز|يجب|يصح|يحرم)|\\b(?:حكم|واجب|فرض|حرام|مكروه|مستحب|جائز)\\b/i.test(n)) return 'ruling';
  if (/فوائد|الحكمه|حكمة|لماذا\\s+شرع/i.test(n)) return 'benefits';
  if (/تعريف|ما\\s+معنى|معنى/i.test(n)) return 'definition';
  if (/متى|وقت/i.test(n)) return 'timing';
  if (/شروط|يشترط/i.test(n)) return 'conditions';
  return 'unknown';
}

function getFiqhSubjectTokensForFallback(query: string): string[] {
  const n = normalizeArabic(query || '');
  return n
    .split(/\\s+/)
    .map(w => w.replace(/^ال/, ''))
    .map(w => w.replace(/[^\\u0621-\\u064Aa-zA-Z0-9_-]/g, ''))
    .filter(w => w.length >= 3 && !FIQH_GENERIC_STOPWORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 5);
}

function stripDorarHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim());
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'");
}

function parseDorarFiqhSearchArticles(html: string): Array<{ title: string; text: string; url: string }> {
  if (!html) return [];
  const articles = html.match(/<article[^>]*>[\\s\\S]*?<\\/article>/gi) || [];
  const results: Array<{ title: string; text: string; url: string }> = [];
  for (const article of articles.slice(0, 20)) {
    const href = article.match(/href=["']([^"']*\\/feqhia\\/\\d+[^"']*)["']/i)?.[1] || '';
    const h = article.match(/<h[1-6][^>]*>([\\s\\S]*?)<\\/h[1-6]>/i)?.[1] || '';
    const title = stripDorarHtml(h);
    const text = stripDorarHtml(article);
    if (!title || !href) continue;
    const url = href.startsWith('http') ? href : 'https://dorar.net' + href;
    results.push({ title, text: text.slice(0, 1800), url });
  }
  return results;
}

async function searchDorarFiqhHttpFallback(query: string): Promise<DorarFiqhLiveResult | null> {
  const clean = query.replace(/[«»"“؟?.,!]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 180);
  if (!clean) return null;

  try {
    const url = buildDorarFiqhUrl(clean);
    const response = await fetchRemoteSafely(url, {
      headers: {
        'User-Agent': 'Baseera/1.0',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9'
      }
    });
    if (!response.ok) return null;
    const html = await readTextWithLimit(response, 1_500_000);
    const rows = parseDorarFiqhSearchArticles(html);
    if (!rows.length) return null;

    const intent = inferFiqhIntentForFallback(clean);
    const subjects = getFiqhSubjectTokensForFallback(clean);
    const scored = rows.map(row => {
      const title = normalizeArabic(row.title);
      const body = normalizeArabic(row.text);
      const subjectHits = subjects.filter(token => title.includes(token)).length;
      const bodyHits = subjects.filter(token => body.includes(token)).length;
      let score = subjectHits * 80 + Math.min(bodyHits, 6) * 8;
      if (intent === 'ruling') {
        if (title.includes('حكم')) score += 120;
        if (/حكم\\s+مشروعيه|حكم\\s+فوائد|فوائد/.test(title)) score -= 140;
      } else if (intent === 'benefits' && /فوائد|حكمة|حكمه/.test(title)) {
        score += 120;
      } else if (intent === 'definition' && /تعريف|معنى/.test(title)) {
        score += 120;
      } else if (intent === 'timing' && /وقت|متى/.test(title)) {
        score += 120;
      } else if (intent === 'conditions' && /شروط|يشترط/.test(title)) {
        score += 120;
      }
      const answerable = subjects.length > 0 && (subjectHits > 0 || bodyHits >= 2) &&
        (intent === 'unknown' || intent !== 'ruling' || title.includes('حكم') || body.includes('حكم'));
      return { ...row, score, answerable };
    }).sort((a, b) => b.score - a.score);

    const top = scored.find(r => r.answerable);
    if (!top) return null;

    const article = await fetchDorarFiqhArticle(top.url);
    const detailedRuling = article?.text || top.text;
    return {
      found: true,
      title: article?.title || top.title,
      text: top.text,
      detailedRuling,
      url: top.url,
      source: 'الموسوعة الفقهية المقارنة — الدرر السنية',
      allResults: scored.slice(0, 10).map(r => ({ title: r.title, text: r.text, url: r.url }))
    };
  } catch (err) {
    console.warn('Dorar Fiqh HTTP fallback failed:', err);
    return null;
  }
}

const dorarFiqhMemoryCache = new Map<string, {
  found: boolean;
  title: string;
  text: string;
  url: string;
  source: string;
  allResults: Array<{ title: string; text: string; url: string }>;
} | null>();

/**
 * Live search on the Dorar.net Comparative Fiqh Encyclopedia (الموسوعة الفقهية المقارنة — الدرر السنية)
 * Connects directly to dorar.net/feqhia/search to fetch authentic rulings across the Four Madhhabs
 */
export async function searchDorarFiqhLive(query: string): Promise<DorarFiqhLiveResult | null> {
  // Keep the complete fiqh question. The Python connector performs
  // intent extraction and subject matching itself.
  const cleanQ = query
    .replace(/[«»"“؟?.,!]/g, '')
    .trim()
    .slice(0, 180);
  if (!cleanQ || cleanQ.length < 2) return null;

  const cacheKey = cleanQ.toLowerCase();
  if (dorarFiqhMemoryCache.has(cacheKey)) {
    return dorarFiqhMemoryCache.get(cacheKey)!;
  }

  try {
    const { execFile } = await import('child_process');
    const path = await import('path');
    const scriptPath = path.resolve(process.cwd(), 'src/lib/dorar_feqhia.py');

    const result = await new Promise<any>((resolve) => {
      execFile(process.platform === 'win32' ? 'python' : 'python3', [scriptPath, cleanQ], { timeout: 12000, encoding: 'utf-8' }, (error, stdout) => {
        if (error || !stdout) {
          return resolve(null);
        }
        try {
          const data = JSON.parse(stdout);
          if (
            data &&
            data.found === true &&
            data.answerable === true &&
            Array.isArray(data.results) &&
            data.results.length > 0 &&
            data.results[0]?.answerable === true
          ) {
            const top = data.results[0];
            const detailedRuling = data.top_detailed_ruling || top.detailed_ruling || '';
            resolve({
              found: true,
              title: top.title || cleanQ,
              text: top.text || '',
              detailedRuling,
              url: top.url || buildDorarFiqhUrl(cleanQ),
              source: 'الموسوعة الفقهية المقارنة — الدرر السنية',
              allResults: data.results
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    if (result) {
      dorarFiqhMemoryCache.set(cacheKey, result);
      return result;
    }

    // Node-side fallback: use Dorar's own Fiqh search directly if the Python
    // connector is unavailable in the deployment environment.
    const httpFallback = await searchDorarFiqhHttpFallback(cleanQ);
    if (httpFallback) {
      dorarFiqhMemoryCache.set(cacheKey, httpFallback);
      return httpFallback;
    }

    // Final server-side fallback: canonical official section + direct article fetch.
    // This path is independent of the Python connector and the site's search
    // ranking, while still using Dorar.net itself as the sole religious source.
    const anchor = getCanonicalFiqhAnchor(cleanQ);
    if (anchor) {
      const article = await fetchDorarFiqhArticle(anchor.url);
      if (article && article.text) {
        const fallbackResult: DorarFiqhLiveResult = {
          found: true,
          title: article.title || anchor.title,
          text: article.text,
          detailedRuling: article.text,
          url: anchor.url,
          source: 'الموسوعة الفقهية المقارنة — الدرر السنية',
          allResults: [{
            title: article.title || anchor.title,
            text: article.text,
            url: anchor.url
          }]
        };
        dorarFiqhMemoryCache.set(cacheKey, fallbackResult);
        return fallbackResult;
      }
    }

    dorarFiqhMemoryCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.error('searchDorarFiqhLive error:', err);

    const anchor = getCanonicalFiqhAnchor(cleanQ);
    if (anchor) {
      const article = await fetchDorarFiqhArticle(anchor.url);
      if (article && article.text) {
        const fallbackResult: DorarFiqhLiveResult = {
          found: true,
          title: article.title || anchor.title,
          text: article.text,
          detailedRuling: article.text,
          url: anchor.url,
          source: 'الموسوعة الفقهية المقارنة — الدرر السنية',
          allResults: [{
            title: article.title || anchor.title,
            text: article.text,
            url: anchor.url
          }]
        };
        dorarFiqhMemoryCache.set(cacheKey, fallbackResult);
        return fallbackResult;
      }
    }

    return null;
  }
}


/**
 * Analyzes whether results for a given hadith indicate a scholarly dispute or consensus
 */
function analyzeDisputeStatus(targetText: string, allResults: DorarHadithResult[]): {
  isDisputed: boolean;
  predominantlyWeak: boolean;
  disputeDetails: string;
  authScholars: string[];
  weakScholars: string[];
} {
  const normTarget = targetText
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

  const related = allResults.filter(r => {
    const normR = r.text
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
    const sliceA = normTarget.slice(0, 15);
    const sliceB = normR.slice(0, 15);
    return normR.includes(sliceA) || normTarget.includes(sliceB);
  });

  const authScholars: string[] = [];
  const weakScholars: string[] = [];
  let explicitDispute = false;

  for (const r of related) {
    const g = r.grade || '';
    if (/اختلف في (?:صحة|إسناده)|مختلف فيه/.test(g)) {
      explicitDispute = true;
    }
    const cat = classifyGrade(g);
    if (cat === 'sahih' || cat === 'hasan') {
      if (r.muhaddith && !authScholars.includes(r.muhaddith) && r.muhaddith !== '-') {
        authScholars.push(r.muhaddith);
      }
    } else if (cat === 'weak' || cat === 'fabricated' || /منكر|لا يصح|لا يثبت|ضعيف|غير محفوظ|مجهول/.test(g)) {
      if (r.muhaddith && !weakScholars.includes(r.muhaddith) && r.muhaddith !== '-') {
        weakScholars.push(r.muhaddith);
      }
    }
  }

  const isDisputed = explicitDispute || (authScholars.length > 0 && weakScholars.length > 0);
  const predominantlyWeak = weakScholars.length >= 2 && weakScholars.length > authScholars.length;

  let disputeDetails = '';
  if (isDisputed) {
    disputeDetails = 'اختلف أئمة الحديث في ثبوته وصحته؛ ';
    if (authScholars.length > 0) disputeDetails += `صححه أو حسنه: (${authScholars.slice(0, 3).join('، ')})، `;
    if (weakScholars.length > 0) disputeDetails += `بينما ضعفه أو استنكره: (${weakScholars.slice(0, 3).join('، ')})`;
    if (explicitDispute) disputeDetails += '، ونص غير واحد على الخلاف فيه.';
  }

  return {
    isDisputed,
    predominantlyWeak,
    disputeDetails: disputeDetails.trim(),
    authScholars,
    weakScholars
  };
}

/**
 * Smart search that tests multiple candidate queries and ranks results by relevance and grade
 */
export async function searchDorarWithSmartQueries(text: string): Promise<{
  topResult: DorarHadithResult | null;
  queryUsed: string;
  allResults: DorarHadithResult[];
}> {
  const queries = generateSearchQueries(text);
  const normalizedInput = normalizeArabic(cleanSearchQuery(text)).trim();
  const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 2);

  if (!normalizedInput || inputWords.length < 3 || queries.length === 0) {
    return { topResult: null, queryUsed: queries[0] || '', allResults: [] };
  }

  const normalizeForMatch = (value: string) =>
    normalizeArabic(value || '').replace(/\s+/g, ' ').trim();

  interface ScoredCandidate {
    result: DorarHadithResult;
    queryUsed: string;
    score: number;
    quality: 'exact' | 'partial' | 'close';
  }

  const candidates: ScoredCandidate[] = [];

  for (const q of queries.slice(0, 8)) {
    const results = await searchDorarApiLive(q);
    for (const r of results) {
      const normalizedHadith = normalizeForMatch(r.text);
      if (!normalizedHadith) continue;

      const exact =
        normalizedHadith === normalizedInput ||
        normalizedHadith.includes(normalizedInput);

      const partial =
        !exact &&
        normalizedInput.length >= 24 &&
        normalizedHadith.includes(normalizedInput.slice(0, Math.min(normalizedInput.length, 80)));

      let shared = 0;
      for (const w of inputWords) {
        if (normalizedHadith.includes(w)) shared++;
      }

      const overlap = inputWords.length ? shared / inputWords.length : 0;
      const close = !exact && !partial && overlap >= 0.75;

      if (!exact && !partial && !close) continue;

      const quality = exact ? 'exact' : partial ? 'partial' : 'close';
      const score = exact ? 1000 + overlap * 100 : partial ? 600 + overlap * 100 : 200 + overlap * 100;
      candidates.push({
        result: { ...r, matchQuality: quality },
        queryUsed: q,
        score,
        quality
      });
    }

    if (candidates.some(c => c.quality === 'exact')) break;
  }

  if (candidates.length === 0) {
    return { topResult: null, queryUsed: queries[0] || text, allResults: [] };
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestCandidate = candidates[0];

  // When the exact same hadith text has conflicting grades across Dorar results,
  // preserve the disagreement instead of selecting one grade by ranking alone.
  const exactText = normalizeArabicStrict(bestCandidate.result.text);
  const exactVariants = candidates
    .map(c => c.result)
    .filter(r => normalizeArabicStrict(r.text) === exactText);

  const hasAuthentic = exactVariants.some(r => r.gradeCategory === 'sahih' || r.gradeCategory === 'hasan');
  const hasWeak = exactVariants.some(r =>
    r.gradeCategory === 'weak' ||
    r.gradeCategory === 'fabricated'
  );
  const explicitDispute = exactVariants.some(r => r.gradeCategory === 'disputed' || r.isDisputed);

  const finalResult: DorarHadithResult = { ...bestCandidate.result };
  if ((hasAuthentic && hasWeak) || explicitDispute) {
    finalResult.isDisputed = true;
    finalResult.gradeCategory = 'disputed';
    finalResult.grade = 'مختلف في صحته بين نتائج المحدثين في المصدر المعتمد';
    finalResult.disputeDetails = 'وُجد للنص نفسه في المصدر المعتمد أحكام حديثية مختلفة؛ لذلك لا يختار النظام حكماً واحداً آلياً.';
  }

  return {
    topResult: finalResult,
    queryUsed: bestCandidate.queryUsed,
    allResults: candidates.map(c => c.result)
  };
}
