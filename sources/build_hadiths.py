#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Safe hadith dataset maintenance helper.

This script only queries the approved Dorar.net Hadith Encyclopedia.
It must never import or merge hadiths from third-party mirrors.
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DORAR_URL = "https://dorar.net/dorar_api.json?skey="

def clean_text(value):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", value or "")).strip()

def classify_grade(grade):
    if re.search(r"موضوع|مكذوب|باطل|لا أصل له|كذب", grade or ""):
        return "fabricated"
    if re.search(r"غير صحيح|ليس بصحيح|لا يصح|لا يثبت|ضعيف|منكر|واهٍ|متروك|معلول|مدلس|لين", grade or ""):
        return "weak"
    if re.search(r"صحيح|إسناده صحيح|على شرط الشيخين|رجاله ثقات", grade or ""):
        return "sahih"
    if re.search(r"حسن|إسناده حسن|جيد|صالح", grade or ""):
        return "hasan"
    return "unknown"

def fetch_dorar(query):
    url = DORAR_URL + urllib.parse.quote(query[:120])
    req = urllib.request.Request(url, headers={"User-Agent": "Baseera-Dorar-Maintainer/1.0"})
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode("utf-8", errors="ignore"))
    html = data.get("ahadith", {}).get("result", "")
    blocks = html.split('<div class="hadith"')[1:]
    results = []
    for raw in blocks:
        block = '<div class="hadith"' + raw
        m = re.search(r'<div class="hadith"[^>]*>([\s\S]*?)</div>', block)
        text = clean_text(m.group(1)) if m else ""
        grade_m = re.search(r'خلاصة حكم المحدث:</span>\s*<span[^>]*>([\s\S]*?)</span>', block)
        grade = clean_text(grade_m.group(1)) if grade_m else ""
        if text:
            results.append({"text_full": text, "text_clean": text, "grade": grade,
                            "grade_category": classify_grade(grade),
                            "dorar_url": "https://dorar.net/hadith"})
    return results

if __name__ == "__main__":
    queries = sys.argv[1:] or ["إنما الأعمال بالنيات"]
    for query in queries:
        for item in fetch_dorar(query):
            print(json.dumps(item, ensure_ascii=False))
