#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dorar.net Comparative Fiqh live connector.

Safety boundary:
- The user's question intent is preserved (especially "ما حكم...").
- Retrieval is ranked by BOTH subject and question intent.
- A related article is NOT considered an answer if its section answers a
  different intent (for example "حكم مشروعية الختان وفوائده الصحية" is not
  the same as the legal-ruling section "حكم الختان").
- The script never invents a ruling; it only returns source text.
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

GENERIC_STOP_WORDS = {
    "ما", "هو", "هي", "في", "من", "على", "عن", "الى", "إلى", "مع", "بعد",
    "قبل", "ان", "إن", "هل", "لا", "أن", "يكون", "تكون", "الشرع", "شرع",
    "الشرعي", "الشريعة", "الإسلام", "الإسلامي", "الفقه", "الدين", "رأي",
}

INTENT_PATTERNS = [
    ("benefits", [
        r"فوائد", r"الفائدة", r"الفوائد", r"الحكمه", r"حكمه",
        r"لماذاs+شرع", r"لماذاs+شرع", r"سببs+(?:مشروعيه|مشروعيّة|تشريع)",
    ]),
    ("ruling", [
        r"ماs+(?:هوs+)?حكم", r"حكم(?:ه)?(?:s+الشرعي)?",
        r"هلs+(?:يجوز|يجب|يصح)", r"ماs+القولs+في",
        r"(?:واجب|فرض|حرام|مكروه|مستحب|جائز)",
    ]),
    ("definition", [
        r"ماs+(?:هو|هي)s+", r"ماs+معنى", r"معنى", r"تعريف",
    ]),
    ("legitimacy", [
        r"مشروعيه", r"مشروعية", r"مشروع", r"هلs+شرع",
    ]),
    ("timing", [
        r"متى", r"وقت", r"متىs+w+",
    ]),
    ("conditions", [
        r"شروط", r"يشترط", r"شرط(?:ه|ها)?",
    ]),
    ("exceptions", [
        r"استثناء", r"يسقط", r"لاs+يقوى", r"عاجز", r"العجز", r"ضرر",
        r"الضرر", r"متىs+يسقط",
    ]),
    ("evidence", [
        r"دليل", r"الدليل", r"أدلة", r"ادله", r"منs+السنة", r"منs+القرآن",
    ]),
    ("comparison", [
        r"المذاهب", r"الحنفي", r"المالكي", r"الشافعي", r"الحنبلي",
        r"قولs+(?:العلماء|الفقهاء)", r"الأقوال",
    ]),
]

INTENT_SEARCH_TERMS = {
    "ruling": "حكم",
    "definition": "تعريف",
    "legitimacy": "مشروعية",
    "timing": "وقت",
    "conditions": "شروط",
    "exceptions": "استثناء",
    "evidence": "دليل",
    "comparison": "المذاهب",
    "benefits": "فوائد",
}

def norm_ar(value):
    if not value:
        return ""
    value = html_lib.unescape(str(value))
    value = re.sub(r"[ً-ٰٟ]", "", value)
    value = re.sub(r"[إأآا]", "ا", value)
    value = value.replace("ى", "ي").replace("ة", "ه")
    value = re.sub(r"\s+", " ", value).strip()
    return value

def clean_raw_query(raw_text):
    value = re.sub(r"[«»"“؟?.,!؛،]", " ", raw_text or "")
    return re.sub(r"\s+", " ", value).strip()[:180]

def infer_intent(raw_text):
    normalized = norm_ar(raw_text)
    for intent, patterns in INTENT_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, normalized, flags=re.I):
                return intent
    return "unknown"

def extract_subject_tokens(raw_text, intent):
    normalized = norm_ar(raw_text)
    # Remove interrogative framing, but DO NOT remove the intent before it is used.
    framing = [
        r"^ماs+(?:هوs+)?", r"^هلs+", r"^ماذاs+", r"^كيفs+",
        r"^ماs+القولs+فيs+", r"^ماs+رأيs+الشرعs+فيs+",
        r"^فيs+القرآنs+(?:الكريمs+)?", r"^فيs+الحديثs+",
        r"^قالs+رسولs+اللهs+", r"^قالs+النبيs+",
    ]
    for pattern in framing:
        normalized = re.sub(pattern, "", normalized, count=1)
    # Remove intent phrases from the subject.
    intent_removals = [
        r"حكم(?:ه)?(?:s+الشرعي)?", r"يجوز", r"يجب", r"يصح",
        r"مشروعيه", r"مشروع", r"فوائد", r"الفوائد", r"الفائده",
        r"الحكمه", r"حكمه", r"تعريف", r"معنى", r"متى", r"وقت",
        r"شروط", r"يشترط", r"شرط", r"استثناء", r"يسقط", r"لاs+يقوى",
        r"ضرر", r"الضرر", r"دليل", r"الدليل", r"أدلة", r"ادله",
        r"المذاهب", r"الحنفي", r"المالكي", r"الشافعي", r"الحنبلي",
        r"واجب", r"فرض", r"حرام", r"مكروه", r"مستحب", r"جائز",
    ]
    for pattern in intent_removals:
        normalized = re.sub(pattern, " ", normalized)
    tokens = []
    for raw in normalized.split():
        token = re.sub(r"^ال", "", raw)
        token = re.sub(r"[^\u0621-\u064Aa-zA-Z0-9_-]", "", token)
        if len(token) >= 3 and token not in GENERIC_STOP_WORDS and token not in tokens:
            tokens.append(token)
    return tokens

def title_intent_fit(title, intent, subject_tokens):
    t = norm_ar(title)
    if intent == "unknown":
        return 0

    if intent == "ruling":
        # Critical distinction:
        # "حكم مشروعية الختان وفوائده" is a wisdom/benefits section, not the
        # legal-ruling section "حكم الختان".
        if re.search(r"حكم\s+مشروعيه|حكم\s+فوائد|الحكمه|حكم\s+فوائده", t):
            return -120
        if "حكم" in t:
            score = 100
            if subject_tokens and any(token in t for token in subject_tokens):
                score += 50
            exact_phrase = "حكم " + " ".join(subject_tokens[:2])
            if len(subject_tokens) >= 1 and exact_phrase in t:
                score += 120
            return score
        return -80

    if intent == "benefits":
        if "فوائد" in t or "الحكمه" in t or "حكم مشروعيه" in t:
            return 130
        return -60

    checks = {
        "definition": ["تعريف", "معنى"],
        "legitimacy": ["مشروعيه", "مشروع"],
        "timing": ["وقت"],
        "conditions": ["شروط", "يشترط"],
        "exceptions": ["يسقط", "لا يقوى", "ضرر", "عجز", "العجز"],
        "evidence": ["دليل", "ادله"],
        "comparison": ["المذاهب", "الحنفي", "المالكي", "الشافعي", "الحنبلي"],
    }
    terms = checks.get(intent, [])
    if any(term in t for term in terms):
        return 120
    return -50

def score_candidate(title, text, intent, subject_tokens):
    norm_title = norm_ar(title)
    norm_text = norm_ar(text)
    title_hits = sum(1 for token in subject_tokens if token and token in norm_title)
    text_hits = sum(1 for token in subject_tokens if token and token in norm_text)
    score = title_hits * 35 + min(text_hits, 5) * 3
    score += title_intent_fit(title, intent, subject_tokens)

    # Stronger subject anchoring.
    if subject_tokens and all(token in norm_title for token in subject_tokens):
        score += 80

    # Generic topic words alone are not enough.
    answerable = (
        (intent == "unknown" and title_hits > 0) or
        (intent != "unknown" and title_hits > 0 and title_intent_fit(title, intent, subject_tokens) >= 60)
    )
    return score, answerable, title_hits, text_hits

def extract_article_fields(art):
    link = re.search(r'href="([^"]*)"', art, flags=re.I)
    title_match = re.search(r"<h[1-6][^>]*>([\s\S]*?)</h[1-6]>", art, flags=re.I)

    title = html_lib.unescape(re.sub(r"<[^>]+>", "", title_match.group(1)).strip()) if title_match else ""
    text = html_lib.unescape(re.sub(r"<[^>]+>", " ", art))
    text = re.sub(r"\s+", " ", text).strip()

    rel_link = link.group(1) if link else ""
    full_link = rel_link if rel_link.startswith("http") else ("https://dorar.net" + rel_link)
    title = re.sub(r"^\d+\s*[-–]\s*", "", title).strip()

    return title, text, full_link

def fetch_article_details(article_url):
    """Fetch the source article itself; never generate or paraphrase its content."""
    try:
        req = urllib.request.Request(article_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as response:
            source_html = response.read().decode("utf-8", errors="ignore")

        pos = source_html.find("w-100 mt-4")
        if pos == -1:
            return None

        chunk = source_html[pos:pos + 7000]
        chunk = re.sub(r'<span class="tip"[^>]*>[\s\S]*?</span>', "", chunk)
        clean = re.sub(r"<[^>]+>", " ", chunk)
        clean = html_lib.unescape(re.sub(r"\s+", " ", clean)).strip()
        clean = re.sub(r'^w-100 mt-4\s*["\'>\s]*', "", clean)

        for marker in ["المادة في سؤال وجواب", "انظر أيضا", "الرابط المختصر"]:
            idx = clean.find(marker)
            if idx != -1 and idx > 100:
                clean = clean[:idx].strip()

        return clean[:1600] if len(clean) > 40 else None
    except Exception:
        return None

def build_queries(raw_query, intent, subject_tokens):
    queries = []
    primary = clean_raw_query(raw_query)
    if primary:
        queries.append(primary)

    subject = " ".join(subject_tokens)
    if subject:
        if intent != "unknown":
            intent_term = INTENT_SEARCH_TERMS.get(intent, "")
            if intent_term:
                queries.append(f"{intent_term} {subject}")
        queries.append(subject)

    if intent == "ruling" and subject:
        queries.extend([
            f"حكم {subject}",
            f"ما حكم {subject}",
        ])

    return list(dict.fromkeys(q for q in queries if len(q) >= 2))

def search_once(query):
    search_url = "https://dorar.net/feqhia/search?q=" + urllib.parse.quote(query)
    req = urllib.request.Request(search_url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as response:
        source_html = response.read().decode("utf-8", errors="ignore")

    articles = re.findall(r"<article[^>]*>([\s\S]*?)</article>", source_html, flags=re.I)
    return [
        extract_article_fields(art)
        for art in articles[:15]
    ]

def search_dorar_feqhia(raw_query):
    query = clean_raw_query(raw_query)
    if len(query) < 2:
        return {
            "success": False,
            "found": False,
            "answerable": False,
            "query_used": query,
            "results": [],
        }

    intent = infer_intent(query)
    subject_tokens = extract_subject_tokens(query, intent)
    queries = build_queries(query, intent, subject_tokens)

    # A candidate may appear under several query variants. Keep the strongest score.
    best_by_url = {}
    first_search_url = "https://dorar.net/feqhia/search?q=" + urllib.parse.quote(query)

    try:
        for search_query in queries[:6]:
            try:
                rows = search_once(search_query)
            except Exception:
                continue

            for title, text, url in rows:
                if not title and len(text) < 20:
                    continue
                score, answerable, title_hits, text_hits = score_candidate(
                    title, text, intent, subject_tokens
                )
                current = best_by_url.get(url)
                candidate = {
                    "title": title,
                    "text": text,
                    "url": url,
                    "score": score,
                    "answerable": answerable,
                    "title_subject_hits": title_hits,
                    "text_subject_hits": text_hits,
                    "intent": intent,
                }
                if current is None or score > current["score"]:
                    best_by_url[url] = candidate

            # Once an answer-bearing candidate is found for an explicit intent,
            # further broad queries are unnecessary and may introduce noise.
            if any(
                c["answerable"] for c in best_by_url.values()
                if c["intent"] == intent
            ):
                # Do one more query only for explicit ruling to ensure a precise
                # ruling section outranks a "wisdom/benefits" section.
                if intent != "ruling" or len(queries) <= 2:
                    break

        candidates = sorted(
            best_by_url.values(),
            key=lambda item: item["score"],
            reverse=True,
        )

        answer_candidates = [c for c in candidates if c["answerable"]]
        if not answer_candidates:
            return {
                "success": True,
                "found": False,
                "answerable": False,
                "intent": intent,
                "subject_tokens": subject_tokens,
                "query_used": query,
                "search_url": first_search_url,
                "count": len(candidates),
                "results": candidates[:10],
            }

        top = answer_candidates[0]
        detailed = fetch_article_details(top["url"])
        if detailed:
            top["detailed_ruling"] = detailed

        # Never expose a "found" result unless it passed intent + subject gates.
        public_results = []
        for candidate in candidates[:10]:
            public_results.append({
                "title": candidate["title"],
                "text": candidate["text"],
                "url": candidate["url"],
                "score": candidate["score"],
                "answerable": candidate["answerable"],
                "intent": candidate["intent"],
            })
            if candidate["url"] == top["url"] and detailed:
                public_results[-1]["detailed_ruling"] = detailed

        return {
            "success": True,
            "found": True,
            "answerable": True,
            "intent": intent,
            "subject_tokens": subject_tokens,
            "query_used": query,
            "search_url": first_search_url,
            "count": len(public_results),
            "relevance_score": top["score"],
            "matched_title": top["title"],
            "results": public_results,
            "top_detailed_ruling": detailed or "",
        }

    except Exception as exc:
        return {
            "success": False,
            "found": False,
            "answerable": False,
            "intent": intent,
            "subject_tokens": subject_tokens,
            "query_used": query,
            "search_url": first_search_url,
            "error": str(exc),
            "count": 0,
            "results": [],
        }

def run_self_test():
    intent = infer_intent("ما حكم الختان؟")
    assert intent == "ruling", intent
    subject = extract_subject_tokens("ما حكم الختان؟", intent)
    assert subject == ["ختان"], subject

    ruling_score, ruling_ok, *_ = score_candidate(
        "المبحث الرابع: حكم الختان",
        "حكم الختان",
        "ruling",
        ["ختان"],
    )
    benefits_score, benefits_ok, *_ = score_candidate(
        "المبحث الثالث: من حكم مشروعية الختان وفوائده الصحية",
        "فوائد الختان",
        "ruling",
        ["ختان"],
    )
    assert ruling_ok is True and ruling_score > benefits_score, (ruling_score, benefits_score)
    assert benefits_ok is False

    assert infer_intent("ما فوائد الختان؟") == "benefits"
    assert infer_intent("متى يختتن الطفل؟") == "timing"
    assert infer_intent("ما تعريف الختان؟") == "definition"
    assert infer_intent("هل الختان مشروع؟") == "legitimacy"

    print("dorar_feqhia self-test: PASS")

if __name__ == "__main__":
    if "--self-test" in sys.argv:
        run_self_test()
    else:
        query = " ".join(arg for arg in sys.argv[1:] if not arg.startswith("--"))
        if not query:
            query = "ما حكم النكاح من الدبر"
        print(json.dumps(search_dorar_feqhia(query), ensure_ascii=False))
