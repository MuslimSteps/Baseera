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
  gradeCategory: 'sahih' | 'hasan' | 'weak' | 'fabricated' | 'unknown';
}

/**
 * Normalizes text to Arabic search query
 */
function cleanSearchQuery(query: string): string {
  return query
    .replace(/[«»"“]/g, '')
    .replace(/^قال\s+(?:رسول\s+الله|النبي|عليكم|سمعت)[^:]*[:\s]*/g, '')
    .trim()
    .slice(0, 120);
}

/**
 * Determine grade category from the Arabic grade text
 */
export function classifyGrade(gradeStr: string): 'sahih' | 'hasan' | 'weak' | 'fabricated' | 'unknown' {
  const g = gradeStr || '';
  if (/موضوع|مكذوب|باطل|لا أصل له|كذب/.test(g)) {
    return 'fabricated';
  }
  if (/ضعيف|منكر|واهٍ|واهي|متروك|فيه نظر|لا يصح|معلول|مدلس/.test(g)) {
    return 'weak';
  }
  if (/صحيح|إسناده صحيح|على شرط الشيخين|على شرط البخاري|على شرط مسلم|رجاله ثقات/.test(g)) {
    return 'sahih';
  }
  if (/حسن|إسناده حسن|جيد/.test(g)) {
    return 'hasan';
  }
  return 'unknown';
}

/**
 * Fetch raw HTML from Dorar.net official API
 */
function fetchDorarApiRaw(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanQ = cleanSearchQuery(query);
    if (!cleanQ || cleanQ.length < 2) {
      return resolve('');
    }

    const options = {
      hostname: 'dorar.net',
      port: 443,
      path: '/dorar_api.json?skey=' + encodeURIComponent(cleanQ),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ar,en;q=0.9',
        'Connection': 'keep-alive'
      },
      timeout: 8000
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
 * Live search on Dorar.net official Hadith API
 */
export async function searchDorarApiLive(query: string): Promise<DorarHadithResult[]> {
  try {
    const html = await fetchDorarApiRaw(query);
    return parseDorarHtml(html);
  } catch (error) {
    console.error('Dorar API search error:', error);
    return [];
  }
}
