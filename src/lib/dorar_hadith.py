#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dorar.net Hadith Encyclopedia Live Connector
الموسوعة الحديثية — الدرر السنية
Fetches real-time authentic hadith verification directly from dorar.net/dorar_api.json
"""

import urllib.request
import urllib.parse
import json
import re
import sys

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ar,en;q=0.9',
    'Connection': 'close'
}

def classify_grade(grade_str):
    g = grade_str or ''
    if re.search(r'مختلف فيه|اختلف في صحته|اختلف في إسناده', g):
        return 'disputed'
    if re.search(r'موضوع|مكذوب|باطل|لا أصل له|كذب|مختلق', g):
        return 'fabricated'
    if re.search(r'غير صحيح|ليس بصحيح|لا يصح|لا يثبت|ضعيف|منكر|واهٍ|واهي|متروك|فيه نظر|معلول|مدلس|لين|أوهى|ساقط|غير محفوظ|وهم|خطأ|أخطأ', g):
        return 'weak'
    if re.search(r'صحيح|إسناده صحيح|على شرط الشيخين|على شرط البخاري|على شرط مسلم|رجاله ثقات|المجمع على صحته|مجمع على صحته|مشهور بالصحة|متفق عليه|رواية صحيحة|صحاح الأحاديث|ثبت في الحديث|ثابت', g):
        return 'sahih'
    if re.search(r'حسن|إسناده حسن|إسنادها حسن|إسناده جيد|إسنادها جيد|(?:\s|^)جيد(?:\s|$)|(?:\s|^)صالح(?:\s|$)', g):
        return 'hasan'
    return 'unknown'

def _norm_key(book, number):
    """Stable join key across the JSON API and the HTML search page."""
    def clean(s):
        s = s or ''
        s = re.sub(r'[\u064B-\u065F\u0670\u0640]', '', s)  # strip tashkeel/tatweel
        s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي')
        s = re.sub(r'[\s/\\|.:،-]+', '', s)
        return s.strip()
    return clean(book) + '#' + clean(number)


def fetch_html_permalinks(clean_q, timeout=10):
    """
    Fetch the Dorar HTML search page and build a map:
        (normalized book + number) -> hadith permalink id (/h/<id>)

    The JSON API (dorar_api.json) intentionally omits the hadith permalink, so
    the only way to cite the real source page (not a search URL) is to join the
    API records with the HTML search page on (book, number).
    """
    try:
        url = 'https://dorar.net/hadith/search?q=' + urllib.parse.quote(clean_q[:100])
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as res:
            html = res.read().decode('utf-8', errors='ignore')

        mapping = {}
        # Each result exposes a copy-btn whose <ref> holds: الراوي | المحدث
        # المصدر | الصفحة أو الرقم | خلاصة حكم المحدث, immediately followed by
        # the permalink tag/href (/h/<id>).
        for seg in html.split('data-clipboard-text="<ref>')[1:]:
            ref = seg.split('</ref>')[0]

            def refval(key):
                m = re.search(re.escape(key) + r':\s*(.*?)(?:<br>|\||</ref>)', ref)
                return re.sub(r'\s+', ' ', m.group(1)).strip() if m else ''

            book = refval('المصدر')
            number = refval('الصفحة أو الرقم')
            m_id = re.search(r'href="https://dorar\.net/h/([A-Za-z0-9]+)"', seg[:600])
            if book and m_id:
                mapping[_norm_key(book, number)] = m_id.group(1)
                # weaker fallback: book alone
                mapping.setdefault(_norm_key(book, ''), m_id.group(1))
        return mapping
    except Exception:
        return {}


def search_dorar_hadith(query):
    clean_q = query.strip()
    # Strip typical prefixes
    clean_q = re.sub(r'^(?:قال رسول الله|قال النبي|في الحديث|عن النبي|روي أن|سمعت رسول الله|حديث)[:\s«"]*', '', clean_q, flags=re.I)
    clean_q = re.sub(r'[«»"“؟?.,!]', '', clean_q).strip()

    if not clean_q or len(clean_q) < 2:
        return {'success': False, 'results': [], 'count': 0}

    url = 'https://dorar.net/dorar_api.json?skey=' + urllib.parse.quote(clean_q[:100])
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as res:
            raw_json = res.read().decode('utf-8', errors='ignore')
            data = json.loads(raw_json)
            html = data.get('ahadith', {}).get('result', '')

        if not html or 'hadith' not in html:
            return {'success': True, 'results': [], 'count': 0, 'query': clean_q}

        # The JSON API omits permalinks; join with the HTML search page so every
        # result can cite its real source page (https://dorar.net/h/<id>).
        permalinks = fetch_html_permalinks(clean_q)

        results = []
        blocks = html.split('<div class="hadith"')

        for b in blocks[1:]:
            block = '<div class="hadith"' + b

            # Hadith text
            m_text = re.search(r'<div class="hadith"[^>]*>([\s\S]*?)</div>', block)
            text = ''
            if m_text:
                text = re.sub(r'<[^>]+>', '', m_text.group(1))
                text = re.sub(r'^\d+\s*[-–]\s*', '', text)
                # Dorar snippets separate matched keys with ". . ." artifacts
                text = re.sub(r'(?:\s*\.\s*){2,}', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip().rstrip('.')

            def get_field(lbl):
                pos = block.find(lbl)
                if pos == -1:
                    return ''
                sub = block[pos:]
                span_end = sub.find('</span>')
                if span_end == -1:
                    return ''
                content = sub[span_end + 7:]
                next_tag = re.search(r'<span|<div|</div', content)
                val = content[:next_tag.start()] if next_tag else content
                return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', val)).strip()

            rawi = get_field('الراوي:')
            muhaddith = get_field('المحدث:')
            book = get_field('المصدر:')
            page = get_field('الصفحة أو الرقم:')

            m_grade = re.search(r'خلاصة حكم المحدث:</span>\s*<span[^>]*>([\s\S]*?)</span>', block)
            grade = ''
            if m_grade:
                grade = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m_grade.group(1))).strip()

            if text:
                hid = permalinks.get(_norm_key(book, page)) or permalinks.get(_norm_key(book, ''))
                results.append({
                    'text': text,
                    'rawi': rawi,
                    'muhaddith': muhaddith,
                    'book': book,
                    'numberOrPage': page,
                    'grade': grade,
                    'gradeCategory': classify_grade(grade),
                    'id': hid,
                    'url': ('https://dorar.net/h/' + hid) if hid else None
                })

        return {
            'success': True,
            'results': results,
            'count': len(results),
            'query': clean_q
        }
    except Exception as e:
        return {'success': False, 'error': str(e), 'results': [], 'count': 0, 'query': clean_q}

if __name__ == '__main__':
    q = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else 'طلب العلم فريضة'
    res = search_dorar_hadith(q)
    print(json.dumps(res, ensure_ascii=False))
