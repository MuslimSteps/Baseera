#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dorar.net Fiqh Encyclopedia Live Connector
الموسوعة الفقهية المقارنة — الدرر السنية
Fetches search results AND the detailed authentic ruling text directly from dorar.net/feqhia
"""

import urllib.request
import urllib.parse
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en;q=0.9'
}

def clean_query(raw_text):
    q = re.sub(r'^(ما\s+حكم|هل\s+يجوز|ما\s+رأي\s+الشرع\s+في|ما\s+هو\s+حكم|حكم|ماذا\s+عن)\s*', '', raw_text.strip(), flags=re.I)
    q = re.sub(r'[؟?!.]', '', q).strip()
    return q if len(q) >= 2 else raw_text.strip()

def fetch_article_ruling_details(article_url):
    """
    Fetches the actual ruling, explanation, and evidence from the specific article page on dorar.net/feqhia/{id}
    """
    try:
        req = urllib.request.Request(article_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as res:
            html = res.read().decode('utf-8', errors='ignore')

        # Find the main ruling container <div ... class="...w-100 mt-4...">
        pos = html.find('w-100 mt-4')
        if pos != -1:
            chunk = html[pos:pos+5000]
            # Strip footnote popups: <span class="tip">...</span>
            chunk = re.sub(r'<span class="tip"[^>]*>[\s\S]*?</span>', '', chunk)
            # Remove all HTML tags
            clean = re.sub(r'<[^>]+>', ' ', chunk)
            clean = re.sub(r'\s+', ' ', clean).strip()
            # Clean leading artifacts
            clean = re.sub(r'^w-100 mt-4\s*["\'>\s]*', '', clean)
            # Stop before "المادة في سؤال وجواب" or "انظر أيضا" if present
            end_markers = ['المادة في سؤال وجواب', 'انظر أيضا', 'الرابط المختصر']
            for marker in end_markers:
                m_idx = clean.find(marker)
                if m_idx != -1 and m_idx > 100:
                    clean = clean[:m_idx].strip()

            if len(clean) > 40:
                return clean[:1200]
    except Exception as e:
        pass
    return None

def norm_ar(s):
    if not s:
        return ''
    s = re.sub(r'[\u064B-\u065F\u0670]', '', s)
    s = re.sub(r'[إأآا]', 'ا', s)
    s = s.replace('ى', 'ي').replace('ة', 'ه')
    return s

def extract_query_keywords(raw_text):
    q = clean_query(raw_text)
    stop_words = {'في', 'من', 'على', 'عن', 'إلى', 'مع', 'بعد', 'قبل', 'أن', 'إن', 'ما', 'لا', 'هل', 'هو', 'هي', 'حكم', 'شرع', 'الشرع', 'يجوز', 'يصح'}
    words = [w.strip() for w in q.split() if len(w.strip()) >= 3 and w.strip() not in stop_words]
    # Remove leading 'ال' from words for stemming comparison
    stems = []
    for w in words:
        clean_w = re.sub(r'^ال', '', w)
        if len(clean_w) >= 3:
            stems.append(clean_w)
    return stems

def search_dorar_feqhia(query):
    clean_q = clean_query(query)
    search_url = 'https://dorar.net/feqhia/search?q=' + urllib.parse.quote(clean_q)
    query_stems = extract_query_keywords(clean_q)

    try:
        req = urllib.request.Request(search_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')

        articles = re.findall(r'<article[^>]*>([\s\S]*?)</article>', html)
        candidates = []

        for art in articles[:10]:
            link = re.search(r'href="([^"]*)"', art)
            title = re.search(r'<h[1-6][^>]*>([\s\S]*?)</h[1-6]>', art)

            clean_title = re.sub(r'<[^>]+>', '', title.group(1)).strip() if title else ''
            clean_text = re.sub(r'<[^>]+>', ' ', art)
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()

            rel_link = link.group(1) if link else ''
            full_link = rel_link if rel_link.startswith('http') else ('https://dorar.net' + rel_link)

            # Clean leading numbering like "1 - "
            clean_title = re.sub(r'^\d+\s*[-–]\s*', '', clean_title).strip()

            if not clean_title and len(clean_text) < 20:
                continue

            # Strict Relevance Guard:
            norm_title = norm_ar(clean_title)
            norm_article_text = norm_ar(clean_text)

            score = 0
            title_stem_matches = 0
            text_stem_matches = 0

            for stem in query_stems:
                norm_stem = norm_ar(stem)
                if norm_stem in norm_title:
                    score += 10
                    title_stem_matches += 1
                elif norm_stem in norm_article_text:
                    score += 3
                    text_stem_matches += 1

            # Discard any article that has ZERO stem matches to the core question
            if score == 0:
                continue

            # If the query had 2 or more distinct keywords (e.g. صيام + شعبان, or نكاح + دبر):
            # The article MUST match at least 1 keyword in its title OR match at least 2 in the body
            if len(query_stems) >= 2 and title_stem_matches == 0 and text_stem_matches < 2:
                continue

            # If query had specifically fasting + sha'ban, prevent matching "دية نساء أهل الكتاب"
            if 'شعبان' in norm_ar(clean_q) and 'شعبان' not in norm_title and 'شعبان' not in norm_article_text:
                continue

            candidates.append({
                'title': clean_title,
                'text': clean_text,
                'url': full_link,
                'score': score
            })

        # Sort candidates by relevance score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)

        # Deep fetch: Retrieve the full ruling text from the top validated article page!
        top_detailed_ruling = None
        results = []
        if candidates:
            top_detailed_ruling = fetch_article_ruling_details(candidates[0]['url'])
            for c in candidates:
                item = {
                    'title': c['title'],
                    'text': c['text'],
                    'url': c['url']
                }
                if c == candidates[0] and top_detailed_ruling:
                    item['detailed_ruling'] = top_detailed_ruling
                results.append(item)

        return {
            'success': True,
            'found': len(results) > 0,
            'query_used': clean_q,
            'search_url': search_url,
            'count': len(results),
            'top_detailed_ruling': top_detailed_ruling,
            'results': results
        }
    except Exception as e:
        return {
            'success': False,
            'found': False,
            'query_used': clean_q,
            'search_url': search_url,
            'error': str(e),
            'count': 0,
            'results': []
        }

if __name__ == '__main__':
    query = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else 'حكم النكاح من الدبر'
    res = search_dorar_feqhia(query)
    print(json.dumps(res, ensure_ascii=False))
