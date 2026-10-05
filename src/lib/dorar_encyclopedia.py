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

def search_tafsir(query):
    url = "https://dorar.net/tafseer/search?q=" + urllib.parse.quote(query.strip())
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")
    
    links = re.findall(r'<a\b[^>]*href=[\x27\x22]([^\x27\x22]+)[\x27\x22][^>]*>([\s\S]*?)</a>', html)
    candidates = []
    for href, raw_title in links:
        title = clean_html(raw_title)
        if "/tafseer/" in href and not href.endswith("/search") and len(title) >= 2:
            full_url = href if href.startswith("http") else ("https://dorar.net" + href)
            candidates.append({"url": full_url, "title": title})
            if len(candidates) >= 5:
                break
    
    if not candidates:
        return {"found": False}
    
    best = candidates[0]
    # fetch article details
    try:
        art_req = urllib.request.Request(best["url"], headers=HEADERS)
        with urllib.request.urlopen(art_req, timeout=10) as art_res:
            art_html = art_res.read().decode("utf-8", errors="ignore")
        text = clean_html(art_html)[:1500]
    except Exception:
        text = best["title"]
        
    return {
        "found": True,
        "title": best["title"],
        "text": text,
        "url": best["url"],
        "source": "موسوعة التفسير — الدرر السنية"
    }

def search_aqeedah(query):
    url = "https://dorar.net/aqeeda/search?q=" + urllib.parse.quote(query.strip())
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")
        
    links = re.findall(r'<a\b[^>]*href=[\x27\x22]([^\x27\x22]+)[\x27\x22][^>]*>([\s\S]*?)</a>', html)
    candidates = []
    for href, raw_title in links:
        title = clean_html(raw_title)
        if "/aqeeda/" in href and not href.endswith("/search") and len(title) >= 2:
            full_url = href if href.startswith("http") else ("https://dorar.net" + href)
            candidates.append({"url": full_url, "title": title})
            if len(candidates) >= 5:
                break
                
    if not candidates:
        return {"found": False}
        
    best = candidates[0]
    try:
        art_req = urllib.request.Request(best["url"], headers=HEADERS)
        with urllib.request.urlopen(art_req, timeout=10) as art_res:
            art_html = art_res.read().decode("utf-8", errors="ignore")
        text = clean_html(art_html)[:1500]
    except Exception:
        text = best["title"]
        
    return {
        "found": True,
        "title": best["title"],
        "text": text,
        "url": best["url"],
        "source": "الموسوعة العقدية — الدرر السنية"
    }

def search_term(query):
    url = "https://islamic-content.com/search?query=" + urllib.parse.quote(query.strip())
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")
        
    links = re.findall(r'<a\b[^>]*href=[\x27\x22]([^\x27\x22]+)[\x27\x22][^>]*>([\s\S]*?)</a>', html)
    candidates = []
    norm_q = re.sub(r"^[اآإأ]ل", "", query.strip())
    
    for href, raw_title in links:
        title = clean_html(raw_title)
        if ("/t/" in href or "/dictionary/" in href) and len(title) >= 2 and not href.endswith("/search"):
            full_url = href if href.startswith("http") else ("https://islamic-content.com" + href)
            norm_t = re.sub(r"^[اآإأ]ل", "", title)
            exact = 100 if norm_t == norm_q else (50 if norm_q in norm_t else 10)
            candidates.append({"url": full_url, "title": title, "score": exact})
                
    if not candidates:
        return {"found": False}
        
    candidates.sort(key=lambda x: x["score"], reverse=True)
    best = candidates[0]
    try:
        art_req = urllib.request.Request(best["url"], headers=HEADERS)
        with urllib.request.urlopen(art_req, timeout=10) as art_res:
            art_html = art_res.read().decode("utf-8", errors="ignore")
        text = clean_html(art_html)[:1500]
    except Exception:
        text = best["title"]
        
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
    elif kind == "term":
        res = search_term(query)
    else:
        res = {"found": False, "error": "Unknown kind"}
        
    print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    main()
