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
    if re.search(r'موضوع|مكذوب|باطل|لا أصل له|كذب', g):
        return 'fabricated'
    if re.search(r'غير صحيح|ليس بصحيح|لا يصح|لا يثبت|ضعيف|منكر|واهٍ|واهي|متروك|فيه نظر|معلول|مدلس|لين|أوهى|ساقط', g):
        return 'weak'
    if re.search(r'صحيح|إسناده صحيح|على شرط الشيخين|على شرط البخاري|على شرط مسلم|رجاله ثقات', g):
        return 'sahih'
    if re.search(r'حسن|إسناده حسن|جيد|صالح', g):
        return 'hasan'
    return 'unknown'

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
                text = re.sub(r'\s+', ' ', text).strip()

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
                results.append({
                    'text': text,
                    'rawi': rawi,
                    'muhaddith': muhaddith,
                    'book': book,
                    'numberOrPage': page,
                    'grade': grade,
                    'gradeCategory': classify_grade(grade)
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
