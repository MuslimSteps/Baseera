/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SSRF-safe remote fetching for user-supplied URLs.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 3;

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(Number.isNaN)) return true;
  const [a,b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && b >= 18 && b <= 19) ||
    a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  const normalized = ip.toLowerCase().split('%')[0];
  const family = net.isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family !== 6) return true;

  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true;
  }

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export async function validateRemoteUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('الرابط غير صالح.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('يُسمح فقط بروابط HTTP وHTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('الروابط التي تتضمن بيانات دخول مضمّنة غير مسموحة.');
  }
  if (parsed.port && !['80', '443'].includes(parsed.port)) {
    throw new Error('المنفذ المخصص غير مسموح.');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata'
  ) {
    throw new Error('الوصول إلى العناوين المحلية أو الداخلية غير مسموح.');
  }

  const ip = net.isIP(hostname);
  const addresses = ip
    ? [hostname]
    : (await dns.lookup(hostname, { all: true, verbatim: true })).map(r => r.address);

  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new Error('الوصول إلى عنوان داخلي أو خاص غير مسموح.');
  }

  return parsed;
}

export async function fetchRemoteSafely(
  rawUrl: string,
  init: RequestInit = {}
): Promise<Response> {
  let current = await validateRemoteUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(current, {
      ...init,
      redirect: 'manual'
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('أعاد الخادم إعادة توجيه غير صالحة.');
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new Error('تجاوز الرابط الحد المسموح لإعادة التوجيه.');
    }

    current = await validateRemoteUrl(new URL(location, current).toString());
  }

  throw new Error('تعذر الوصول إلى الرابط بأمان.');
}

export async function readTextWithLimit(response: Response, maxBytes = 1_500_000): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new Error('حجم الصفحة أكبر من الحد المسموح للمعالجة.');
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error('حجم الصفحة أكبر من الحد المسموح للمعالجة.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function readBytesWithLimit(response: Response, maxBytes = 10_000_000): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new Error('حجم الملف أكبر من الحد المسموح للمعالجة.');
  }

  if (!response.body) {
    return Buffer.from(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error('حجم الملف أكبر من الحد المسموح للمعالجة.');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
