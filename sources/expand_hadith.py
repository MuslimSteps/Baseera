#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Approved-source-only hadith importer for Baseera.

The official scientific package permits Dorar.net and approved Sunnah editions.
This helper deliberately uses Dorar.net only and does not import third-party
mirrors or assign grades without a source-provided grade.
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DORAR_API = "https://dorar.net/dorar_api.json?skey="

def normalize(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()

def fetch(query):
    url = DORAR_API + urllib.parse.quote(query[:120])
    req = urllib.request.Request(url, headers={"User-Agent": "Baseera-Dorar-Importer/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        payload = json.loads(r.read().decode("utf-8", errors="ignore"))
    html = payload.get("ahadith", {}).get("result", "")
    out = []
    for block in html.split('<div class="hadith"')[1:]:
        block = '<div class="hadith"' + block
        tm = re.search(r'<div class="hadith"[^>]*>([\s\S]*?)</div>', block)
        gm = re.search(r'خلاصة حكم المحدث:</span>\s*<span[^>]*>([\s\S]*?)</span>', block)
        text = normalize(tm.group(1)) if tm else ""
        grade = normalize(gm.group(1)) if gm else ""
        if text and grade:
            out.append({"text_full": text, "text_clean": text, "grade": grade, "dorar_url": "https://dorar.net/hadith"})
    return out

if __name__ == "__main__":
    target = Path(__file__).with_name("hadith.json")
    data = json.loads(target.read_text(encoding="utf-8"))
    seen = {h.get("text_clean") for h in data.get("hadiths", [])}
    queries = sys.argv[1:] or ["إنما الأعمال بالنيات"]
    for q in queries:
        for h in fetch(q):
            if h["text_clean"] in seen:
                continue
            h["id"] = f"hadith-{len(data['hadiths']) + 1}"
            data["hadiths"].append(h)
            seen.add(h["text_clean"])
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
