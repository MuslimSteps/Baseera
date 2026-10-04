/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import https from 'https';

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
      execFile('python', [scriptPath, cleanQ], { timeout: 10000, encoding: 'utf-8' }, (error, stdout) => {
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
  const clean = cleanSearchQuery(query);
  return `https://dorar.net/feqhia/search?q=${encodeURIComponent(clean || query)}`;
}

/**
 * Generate fiqh-specific search keywords from a question
 */
export function generateFiqhSearchKeywords(rawText: string): string[] {
  const clean = cleanSearchQuery(rawText);
  const words = clean
    .split(/\s+/)
    .filter(w => w.length > 2 && !['حكم', 'شرع', 'ماذا', 'يجوز', 'يصح', 'رأي', 'الشريعة', 'في', 'من', 'على', 'عن', 'هل', 'ما'].includes(w));
  return [...new Set(words)];
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
export async function searchDorarFiqhLive(query: string): Promise<{
  found: boolean;
  title: string;
  text: string;
  detailedRuling?: string;
  url: string;
  source: string;
  allResults: Array<{ title: string; text: string; url: string }>;
} | null> {
  const cleanQ = cleanSearchQuery(query)
    .replace(/[؟?]/g, '')
    .replace(/^(ما\s+حكم|هل\s+يجوز|ما\s+رأي\s+الشرع\s+في|ما\s+هو\s+حكم|حكم)\s*/i, '')
    .trim();

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
      execFile('python', [scriptPath, cleanQ], { timeout: 12000, encoding: 'utf-8' }, (error, stdout) => {
        if (error || !stdout) {
          return resolve(null);
        }
        try {
          const data = JSON.parse(stdout);
          if (data && data.found && Array.isArray(data.results) && data.results.length > 0) {
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

    dorarFiqhMemoryCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('searchDorarFiqhLive error:', err);
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

  return {
    topResult: bestCandidate.result,
    queryUsed: bestCandidate.queryUsed,
    allResults: candidates.map(c => c.result)
  };
}
