#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dorar Tafsir, Aqeedah, and Jamhara Terminology live connector.
Bypasses Node.js Cloudflare TLS fingerprint blocks by using standard python urllib.
"""

import html as html_lib
import json
import re
import sys
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Baseera/1.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,en;q=0.9",
}

def clean_html(raw):
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", " ", raw)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()

def extract_dorar_article_content(html):
    # Strip methodology popup modal which also has 'amiri_custom_content'
    cleaned = re.sub(r'<div[^>]*id=[\x27\x22]accordionEx[\x27\x22][^>]*>[\s\S]*?<!--\s*Card\s*-->', '', html)
    cleaned = re.sub(r'منهج العمل في الموسوعة[\s\S]*?أستاذ التفسير', '', cleaned)

    # 1. Try w-100 mt-4 (standard Dorar encyclopedia content box)
    pos = cleaned.find('w-100 mt-4')
    if pos != -1:
        chunk = cleaned[pos:pos+7000]
        chunk = re.sub(r'<span class=[\x27\x22]tip[\x27\x22][^>]*>[\s\S]*?</span>', '', chunk)
        clean = clean_html(chunk)
        clean = re.sub(r'^w-100 mt-4\s*["\'>\s]*', '', clean)
        for stop_marker in ["انظر أيضا", "انظر أيضاً", "عرض الهوامش", "السابق التالي", "إضافة تعليق", "الرابط المختصر"]:
            idx = clean.find(stop_marker)
            if idx > 40:
                clean = clean[:idx].strip()
        if len(clean) > 50 and 'منهج العمل في الموسوعة' not in clean:
            return clean[:1800]

    # 2. Try row amiri_custom_content (Tafseer content container)
    pos = cleaned.find('row  amiri_custom_content')
    if pos == -1:
        pos = cleaned.find('amiri_custom_content')
    if pos != -1:
        chunk = cleaned[pos:pos+7000]
        chunk = re.sub(r'<span class=[\x27\x22]tip[\x27\x22][^>]*>[\s\S]*?</span>', '', chunk)
        clean = clean_html(chunk)
        clean = re.sub(r'^(?:row\s+)?amiri_custom_content\s*["\'>\s]*', '', clean).strip()
        for stop_marker in ["انظر أيضا", "انظر أيضاً", "عرض الهوامش", "السابق التالي", "إضافة تعليق", "الرابط المختصر"]:
            idx = clean.find(stop_marker)
            if idx > 40:
                clean = clean[:idx].strip()
        if len(clean) > 50 and 'منهج العمل في الموسوعة' not in clean:
            return clean[:1800]

    # 3. Try meta og:description or description
    m = re.search(r'<meta\s+(?:property|name)=[\x27\x22](?:og:)?description[\x27\x22]\s+content=[\x27\x22]([^\x27\x22]+)[\x27\x22]', cleaned)
    if m:
        meta_desc = clean_html(m.group(1))
        for stop_marker in ["انظر أيضا", "انظر أيضاً", "عرض الهوامش", "السابق التالي", "إضافة تعليق", "الرابط المختصر"]:
            idx = meta_desc.find(stop_marker)
            if idx > 40:
                meta_desc = meta_desc[:idx].strip()
        if len(meta_desc) > 30 and not meta_desc.startswith("موسوعة") and 'منهج العمل' not in meta_desc:
            return meta_desc
        if len(meta_desc) > 30 and not meta_desc.startswith("موسوعة") and 'منهج العمل' not in meta_desc:
            return meta_desc

    return ""

def extract_tafsir_keywords(query):
    q_clean = re.sub(r'[«»"“؟?.,!:]', ' ', query)
    cleaned = re.sub(r'^(?:ما\s+(?:هي\s+)?(?:الآية|الاية)\s+(?:التي\s+)?(?:تقول\s+)?(?:إن|ان)?|ما\s+معنى\s+(?:الآية|الاية)|أين\s+(?:ورد|ذكرت)|تفسير\s+آية|ما\s+تفسير|معنى\s+قوله\s+تعالى|في\s+القرآن(?:\s+الكريم)?|ما\s+حكم|هل)\s*', '', q_clean).strip()
    words = [w for w in re.split(r'\s+', cleaned) if len(w) >= 3 and w not in ('الذي', 'التي', 'الذين', 'تقول', 'الله', 'تعالى', 'عز', 'وجل', 'قال', 'كان')]
    return words, cleaned

def search_tafsir(query):
    keywords, clean_q = extract_tafsir_keywords(query)
    search_terms = ' '.join(keywords[:3]) if len(keywords) >= 2 else (clean_q if clean_q else query.strip())
    url = "https://dorar.net/tafseer/search?q=" + urllib.parse.quote(search_terms)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")

    articles = re.findall(r'<article[^>]*>([\s\S]*?)</article>', html)
    candidates = []
    for art in articles:
        link_m = re.search(r'href=[\x27\x22]([^\x27\x22]+)[\x27\x22]', art)
        if not link_m:
            continue
        href = link_m.group(1)
        if not ("/tafseer/" in href and not href.endswith("/search")):
            continue
        full_url = href if href.startswith("http") else ("https://dorar.net" + href)
        snippet = clean_html(art)
        # Clean leading numbers like "1 - "
        snippet = re.sub(r'^\d+\s*[-–]\s*', '', snippet).strip()
        score = 0
        norm_snip = re.sub(r'[^\w\s]', '', snippet)
        for kw in keywords:
            if kw in norm_snip or kw in snippet:
                score += 10
        candidates.append({"url": full_url, "snippet": snippet, "score": score})
        if len(candidates) >= 15:
            break

    if not candidates:
        return {"found": False}

    candidates.sort(key=lambda c: c["score"], reverse=True)
    best = candidates[0]

    if keywords and best["score"] == 0:
        return {"found": False}

    text = ""
    try:
        art_req = urllib.request.Request(best["url"], headers=HEADERS)
        with urllib.request.urlopen(art_req, timeout=10) as art_res:
            art_html = art_res.read().decode("utf-8", errors="ignore")
        text = extract_dorar_article_content(art_html)
    except Exception:
        pass

    if not text or len(text) < 40:
        text = best["snippet"]

    title = best["snippet"].split('.')[0].strip() if '.' in best["snippet"] else best["snippet"][:120]

    return {
        "found": True,
        "title": title,
        "text": text,
        "url": best["url"],
        "source": "موسوعة التفسير — الدرر السنية"
    }

def search_aqeedah(query):
    url = "https://dorar.net/aqeeda/search?q=" + urllib.parse.quote(query.strip())
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")

    articles = re.findall(r'<article[^>]*>([\s\S]*?)</article>', html)
    candidates = []
    for art in articles:
        link_m = re.search(r'href=[\x27\x22]([^\x27\x22]+)[\x27\x22]', art)
        if not link_m:
            continue
        href = link_m.group(1)
        if not ("/aqeeda/" in href and not href.endswith("/search")):
            continue
        full_url = href if href.startswith("http") else ("https://dorar.net" + href)
        snippet = clean_html(art)
        snippet = re.sub(r'^\d+\s*[-–]\s*', '', snippet).strip()
        candidates.append({"url": full_url, "snippet": snippet})
        if len(candidates) >= 5:
            break

    if not candidates:
        return {"found": False}

    def aqeedah_candidate_score(cand):
        s = 0
        norm_snip = cand["snippet"]
        if "تعريف" in norm_snip or "معنى" in norm_snip:
            s += 60
        if "لغة" in norm_snip or "اصطلاح" in norm_snip:
            s += 50
        if "مؤلفات" in norm_snip or "كتب" in norm_snip:
            s -= 100
        if query.strip() in norm_snip:
            s += 30
        return s

    candidates.sort(key=aqeedah_candidate_score, reverse=True)
    best = candidates[0]
    text = ""
    # Try candidates in order if first candidate has no article body (e.g. index page)
    for cand in candidates[:3]:
        try:
            art_req = urllib.request.Request(cand["url"], headers=HEADERS)
            with urllib.request.urlopen(art_req, timeout=10) as art_res:
                art_html = art_res.read().decode("utf-8", errors="ignore")
            cand_text = extract_dorar_article_content(art_html)
            if cand_text and len(cand_text) > 80:
                best = cand
                text = cand_text
                break
        except Exception:
            continue

    if not text or len(text) < 40:
        text = best["snippet"]

    title = best["snippet"].split('.')[0].strip() if '.' in best["snippet"] else best["snippet"][:120]

    return {
        "found": True,
        "title": title,
        "text": text,
        "url": best["url"],
        "source": "الموسوعة العقدية — الدرر السنية"
    }

def search_term(query):
    url = "https://islamic-content.com/search?query=" + urllib.parse.quote(query.strip())
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")

    norm_q = re.sub(r"^[اآإأ]ل", "", query.strip())
    candidates = []

    # Look for search result links
    links = re.findall(r'<a\b[^>]*href=[\x27\x22]([^\x27\x22]+)[\x27\x22][^>]*>([\s\S]*?)</a>', html)
    for href, raw_title in links:
        title = clean_html(raw_title)
        if ("/t/" in href or "/dictionary/" in href) and len(title) >= 2 and not href.endswith("/search"):
            full_url = href if href.startswith("http") else ("https://islamic-content.com" + href)
            norm_t = re.sub(r"^[اآإأ]ل", "", title)
            exact = 100 if norm_t == norm_q else (50 if norm_q in norm_t or norm_t in norm_q else 0)
            if exact >= 50:
                candidates.append({"url": full_url, "title": title, "score": exact})

    if not candidates:
        return {"found": False}

    candidates.sort(key=lambda x: x["score"], reverse=True)
    best = candidates[0]
    text = ""

    try:
        art_req = urllib.request.Request(best["url"], headers=HEADERS)
        with urllib.request.urlopen(art_req, timeout=10) as art_res:
            art_html = art_res.read().decode("utf-8", errors="ignore")

        # Reject category index nodes that only list sub-terms without technical definition
        if "مفردات فرعية" in art_html and not ("التعريف اصطلاح" in art_html or "التعريف لغة" in art_html):
            return {"found": False}

        # 1. Search for explicit technical definition section (التعريف اصطلاحاً)
        pos = art_html.find("التعريف اصطلاح")
        if pos != -1:
            chunk = clean_html(art_html[pos:pos+2500])
            for stop in ["العلاقة بين التعريفين", "الأدلة", "القرآن الكريم", "السنة"]:
                idx = chunk.find(stop)
                if idx > 80:
                    chunk = chunk[:idx]
            if len(chunk) > 40:
                text = chunk[:1500]
        
        # 2. Search for linguistic definition section (التعريف لغة)
        if not text:
            pos = art_html.find("التعريف لغة")
            if pos != -1:
                chunk = clean_html(art_html[pos:pos+2500])
                for stop in ["العلاقة بين التعريفين", "الأدلة"]:
                    idx = chunk.find(stop)
                    if idx > 80:
                        chunk = chunk[:idx]
                if len(chunk) > 40:
                    text = chunk[:1500]
        
        # 3. Search for post-content containers only if relevant
        if not text:
            pos = art_html.find("post-content")
            if pos != -1:
                chunk = clean_html(art_html[pos:pos+2500])
                # Only accept if it contains a definition marker or the term itself
                if len(chunk) > 40 and not ("مفردات فرعية" in chunk) and (norm_q in chunk or "معنى" in chunk or "تعريف" in chunk):
                    text = chunk[:1500]
    except Exception:
        pass

    if not text or len(text) < 30:
        return {"found": False}

    return {
        "found": True,
        "title": best["title"],
        "text": text,
        "url": best["url"],
        "source": "موسوعة الجمهرة لمفردات المحتوى الإسلامي — islamic-content.com"
    }

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"found": False, "error": "Missing args"}))
        return
        
    kind = sys.argv[1].lower()
    query = sys.argv[2]
    
    if kind == "tafsir":
        res = search_tafsir(query)
    elif kind == "aqeedah":
        res = search_aqeedah(query)
    elif kind in ("term", "jamhara"):
        res = search_term(query)
    else:
        res = {"found": False, "error": "Unknown kind"}
        
    print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    main()
