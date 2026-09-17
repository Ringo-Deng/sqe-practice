"""Build the reusable FLK1 textbook corpus and question-to-page links.

The script reads the canonical PDFs materialised from the user's Library,
copies one copy of each textbook into the Site, extracts a page-level corpus,
and maps every current question to one Revise page and one Notes page.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from hashlib import sha256
import json
import math
from pathlib import Path
import re
from typing import Any, Iterable

import fitz


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "library-source" / "SQE"
PUBLIC = ROOT / "public" / "textbooks"
CORPUS_PATH = ROOT / "data" / "flk1-textbook-index.json"
CATALOG_PATH = ROOT / "lib" / "textbooks.json"
LINKS_PATH = ROOT / "lib" / "question-textbook-links.json"


@dataclass(frozen=True)
class BookSpec:
    id: str
    source: str
    title: str
    short_title: str
    subject_id: str
    kind: str


BOOKS = [
    BookSpec("revise-legal-system-services-2027", "01_Revise_SQE_2027_The_Legal_System_and_Services_of_England_and_Wales.pdf", "Revise SQE 2027 · The Legal System and Services of England and Wales", "Revise · 法律制度与服务", "legal-system", "revise"),
    BookSpec("revise-dispute-resolution-2027", "03_Revise_SQE_2027_Dispute_Resolution.pdf", "Revise SQE 2027 · Dispute Resolution", "Revise · 争议解决", "dispute", "revise"),
    BookSpec("revise-contract-2027", "06_Revise_SQE_2027_Contract_Law.pdf", "Revise SQE 2027 · Contract Law", "Revise · 合同法", "contract", "revise"),
    BookSpec("revise-constitutional-administrative-2027", "07_Revise_SQE_2027_Constitutional_and_Administrative_Law.pdf", "Revise SQE 2027 · Constitutional and Administrative Law", "Revise · 宪法与行政法", "legal-system", "revise"),
    BookSpec("revise-business-law-practice-2027", "08_Revise_SQE_2027_Business_Law_and_Practice.pdf", "Revise SQE 2027 · Business Law and Practice", "Revise · 商法与实务", "business", "revise"),
    BookSpec("revise-ethics-2027", "13_Revise_SQE_2027_Ethics_and_Professional_Conduct.pdf", "Revise SQE 2027 · Ethics and Professional Conduct", "Revise · 职业道德", "legal-services", "revise"),
    BookSpec("revise-tort-2027", "16_Revise_SQE_2027_Tort_Law.pdf", "Revise SQE 2027 · Tort Law", "Revise · 侵权法", "tort", "revise"),
    BookSpec("notes-business-law-26", "BLP-SQE-Notes-Brigittes-FLK-2024-hatqmb.pdf", "Business Law and Practice · SQE Notes（26页版）", "Notes · 商法", "business", "notes"),
    BookSpec("notes-business-tax-13", "Business-Tax-SQE-Notes-Brigittes-FLK-2024-3vdl7l.pdf", "Business Tax · SQE Notes（13页版）", "Notes · 商业税", "business", "notes"),
    BookSpec("notes-contract-16", "Contract-law-SQE-Notes-sltvu3.pdf", "Contract Law · SQE Notes（16页版）", "Notes · 合同法16页", "contract", "notes"),
    BookSpec("notes-contract-30", "Contract-law-SQE-Prep-Notes-wyf2ss.pdf", "Contract Law · SQE Prep Notes（30页版）", "Notes · 合同法30页", "contract", "notes"),
    BookSpec("notes-dispute-resolution-25", "Dispute-Resolution-SQE-notes-dcy9yf.pdf", "Dispute Resolution · SQE Notes（25页版）", "Notes · 争议解决25页", "dispute", "notes"),
    BookSpec("notes-dispute-resolution-prep-39", "Dispute-Resolution-SQE-Prep-Notes-tmibmc.pdf", "Dispute Resolution · SQE Prep Notes（39页版）", "Notes · 争议解决39页", "dispute", "notes"),
    BookSpec("notes-ethics-9", "Ethics-and-Professional-Conduct-Rules-SQE-Notes-Brigittes-FLK-2024-uwisov.pdf", "Ethics and Professional Conduct · SQE Notes（9页版）", "Notes · 职业道德", "legal-services", "notes"),
    BookSpec("notes-legal-services-10", "Legal-Services-SQE-Notes-Brigittes-FLK-2024-e7kqsy.pdf", "Legal Services · SQE Notes（10页版）", "Notes · 法律服务", "legal-services", "notes"),
    BookSpec("notes-legal-system-14", "The-Legal-System-and-Services-of-England-and-Wales-SQE-Notes-Brigittes-FLK-2024-nyjeoq.pdf", "The Legal System and Services of England and Wales · SQE Notes（14页版）", "Notes · 法律制度", "legal-system", "notes"),
    BookSpec("notes-tort-14", "Tort-law-SQE-Notes-s5j7kn.pdf", "Tort Law · SQE Notes（14页版）", "Notes · 侵权法14页", "tort", "notes"),
    BookSpec("notes-tort-prep-27", "Tort-law-SQE-Prep-notes-kwfeiq.pdf", "Tort Law · SQE Prep Notes（27页版）", "Notes · 侵权法27页", "tort", "notes"),
]


PRIMARY_BY_SUBJECT = {
    "business": ["revise-business-law-practice-2027"],
    "contract": ["revise-contract-2027"],
    "dispute": ["revise-dispute-resolution-2027"],
    "tort": ["revise-tort-2027"],
    "legal-system": ["revise-legal-system-services-2027", "revise-constitutional-administrative-2027"],
    "legal-services": ["revise-legal-system-services-2027", "revise-ethics-2027"],
}

NOTES_BY_SUBJECT = {
    "business": ["notes-business-law-26", "notes-business-tax-13"],
    "contract": ["notes-contract-16", "notes-contract-30"],
    "dispute": ["notes-dispute-resolution-25", "notes-dispute-resolution-prep-39"],
    "tort": ["notes-tort-14", "notes-tort-prep-27"],
    "legal-system": ["notes-legal-system-14"],
    "legal-services": ["notes-legal-services-10", "notes-ethics-9"],
}

CHAPTER_PREFIXES = {
    ("revise-business-law-practice-2027", "business"): "business",
    ("revise-dispute-resolution-2027", "dispute"): "dispute",
    ("revise-contract-2027", "contract"): "contract",
    ("revise-tort-2027", "tort"): "tort",
    ("revise-legal-system-services-2027", "legal-system"): "legal-system-lss",
    ("revise-constitutional-administrative-2027", "legal-system"): "legal-system-cal",
    ("revise-legal-system-services-2027", "legal-services"): "legal-services-lss",
    ("revise-ethics-2027", "legal-services"): "legal-services-ethics",
}

PUBLISHER_BOOKS = {
    "the legal system and services of england and wales": "revise-legal-system-services-2027",
    "legal system and services of england and wales": "revise-legal-system-services-2027",
    "dispute resolution": "revise-dispute-resolution-2027",
    "contract law": "revise-contract-2027",
    "constitutional and administrative law": "revise-constitutional-administrative-2027",
    "business law and practice": "revise-business-law-practice-2027",
    "ethics and professional conduct": "revise-ethics-2027",
    "tort law": "revise-tort-2027",
}

STOP_WORDS = {
    "a", "about", "after", "again", "against", "all", "also", "am", "an", "and", "any", "are", "as", "at", "be", "because", "been", "before", "being", "best", "between", "both", "but", "by", "can", "client", "correct", "court", "could", "did", "do", "does", "each", "following", "for", "from", "had", "has", "have", "he", "her", "here", "hers", "him", "his", "how", "if", "in", "into", "is", "it", "its", "law", "legal", "may", "more", "most", "must", "no", "not", "of", "on", "one", "only", "or", "other", "our", "out", "over", "person", "question", "said", "same", "she", "should", "so", "some", "statement", "such", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "through", "to", "under", "up", "was", "were", "what", "when", "which", "who", "why", "will", "with", "would", "year", "years", "you", "your",
}

TOKEN_RE = re.compile(r"[a-z][a-z0-9’'-]{1,}|\b(?:s|ss)\.?\s*\d+[a-z]?\b", re.I)


def normalise_text(value: str) -> str:
    value = value.replace("\u00ad", "").replace("\u2019", "'")
    value = re.sub(r"(?<=\w)-\n(?=\w)", "", value)
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def tokens(value: str) -> list[str]:
    result: list[str] = []
    for raw in TOKEN_RE.findall(value.lower()):
        token = re.sub(r"\s+", "", raw).replace(".", "")
        if token in STOP_WORDS or len(token) < 2:
            continue
        result.append(token)
    result.extend(f"{a}_{b}" for a, b in zip(result, result[1:]) if a != b)
    return result


def numbered_chapters(toc: list[list[Any]], page_count: int) -> list[dict[str, Any]]:
    starts: list[tuple[int, str, int]] = []
    for level, title, page in toc:
        match = re.match(r"^(\d+)\s+(.+)$", title.strip())
        if level == 1 and match and int(match.group(1)) <= 20:
            starts.append((int(match.group(1)), match.group(2).strip(), int(page)))
    chapters: list[dict[str, Any]] = []
    for index, (number, title, start) in enumerate(starts):
        end = starts[index + 1][2] - 1 if index + 1 < len(starts) else page_count
        content_end = end
        for _, heading, page in toc:
            if start <= int(page) <= end and "sqe1-style questions" in heading.lower():
                content_end = max(start, int(page) - 1)
                break
        chapters.append({"number": number, "title": title, "startPage": start, "endPage": end, "contentEndPage": content_end})
    return chapters


def current_heading(toc: list[list[Any]], page: int, chapter: dict[str, Any] | None) -> str:
    lower = chapter["startPage"] if chapter else 1
    candidates = []
    for level, title, toc_page in toc:
        title = title.strip()
        if not (lower <= int(toc_page) <= page):
            continue
        if any(fragment in title.lower() for fragment in ("end-of-chapter", "answers to", "chapter summary", "single best answer mcq")):
            continue
        candidates.append((int(toc_page), int(level), title))
    if candidates:
        _, _, heading = max(candidates, key=lambda item: (item[0], item[1]))
        return heading
    return chapter["title"] if chapter else "Textbook page"


def notes_heading(text: str) -> str:
    ignored = ("sqe notes", "brigitte's flk", "all rights", "copyright", "www.", "page ")
    lines = [re.sub(r"\s+", " ", line).strip(" •\t") for line in text.splitlines()]
    lines = [line for line in lines if 3 <= len(line) <= 120 and not line.isdigit()]
    useful = [line for line in lines if not any(fragment in line.lower() for fragment in ignored)]
    return " · ".join(useful[:2]) if useful else "主题笔记"


def chapter_for_page(chapters: list[dict[str, Any]], page: int) -> dict[str, Any] | None:
    return next((chapter for chapter in chapters if chapter["startPage"] <= page <= chapter["endPage"]), None)


def copy_and_extract() -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    CORPUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    catalog: list[dict[str, Any]] = []
    corpus_by_id: dict[str, dict[str, Any]] = {}
    for spec in BOOKS:
        source = SOURCE / spec.source
        if not source.exists():
            raise FileNotFoundError(source)
        digest = sha256(source.read_bytes()).hexdigest()
        page_url_template = f"/textbooks/{spec.id}-{digest[:12]}-pages-v1/{{page}}.pdf"
        document = fitz.open(source)
        toc = document.get_toc(simple=True)
        chapters = numbered_chapters(toc, len(document)) if spec.kind == "revise" else []
        pages = []
        for index, page in enumerate(document, start=1):
            text = normalise_text(page.get_text("text"))
            chapter = chapter_for_page(chapters, index)
            heading = current_heading(toc, index, chapter) if toc else notes_heading(text)
            pages.append({
                "page": index,
                "chapter": chapter["number"] if chapter else None,
                "heading": heading,
                "text": text,
            })
        document.close()
        eligible = set(range(1, len(pages) + 1))
        if chapters:
            eligible = {
                page
                for chapter in chapters
                for page in range(chapter["startPage"], chapter["contentEndPage"] + 1)
            }
        book = {
            "id": spec.id,
            "title": spec.title,
            "shortTitle": spec.short_title,
            "subjectId": spec.subject_id,
            "kind": spec.kind,
            "sourceFile": spec.source,
            "version": "Revise SQE 2027" if spec.kind == "revise" else "Library upload",
            "pageCount": len(pages),
            "pageUrlTemplate": page_url_template,
            "sha256": digest,
            "chapters": chapters,
            "pages": pages,
            "eligiblePages": sorted(eligible),
        }
        corpus_by_id[spec.id] = book
        catalog.append({key: book[key] for key in ("id", "title", "shortTitle", "subjectId", "version", "sourceFile", "pageCount", "pageUrlTemplate", "sha256")})

    # Add reusable per-page keywords after every page has been extracted.
    for book in corpus_by_id.values():
        page_tokens = [Counter(tokens(page["heading"] + "\n" + page["text"])) for page in book["pages"]]
        document_frequency = Counter(token for counts in page_tokens for token in counts)
        total = len(page_tokens)
        for page, counts in zip(book["pages"], page_tokens):
            weighted = [
                (count * math.log((total + 1) / (document_frequency[token] + 1)), token)
                for token, count in counts.items()
                if "_" not in token and len(token) > 2
            ]
            page["keywords"] = [token for _, token in sorted(weighted, reverse=True)[:16]]
    return catalog, corpus_by_id


class BookSearch:
    def __init__(self, book: dict[str, Any]):
        self.book = book
        self.pages = book["pages"]
        self.counts = [Counter(tokens(page["heading"] + " " + page["heading"] + "\n" + page["text"])) for page in self.pages]
        self.lengths = [sum(counter.values()) for counter in self.counts]
        self.average = sum(self.lengths) / max(1, len(self.lengths))
        self.df = Counter(token for counter in self.counts for token in counter)

    def score(self, query: str, allowed: Iterable[int] | None = None) -> list[tuple[float, int]]:
        query_counts = Counter(tokens(query))
        pages = set(allowed) if allowed is not None else set(self.book["eligiblePages"])
        results = []
        total = len(self.pages)
        for page_number in pages:
            counter = self.counts[page_number - 1]
            length = self.lengths[page_number - 1]
            score = 0.0
            for token, query_frequency in query_counts.items():
                frequency = counter.get(token, 0)
                if not frequency:
                    continue
                inverse = math.log(1 + (total - self.df[token] + 0.5) / (self.df[token] + 0.5))
                saturation = frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * length / max(1, self.average)))
                score += inverse * saturation * (1 + min(query_frequency - 1, 2) * 0.18)
            results.append((score, page_number))
        return sorted(results, reverse=True)


def question_query(question: dict[str, Any]) -> str:
    explanation = question.get("explanation") or {}
    answer = explanation.get("answer")
    correct_option = next((option.get("en", "") for option in question.get("options", []) if option.get("id") == answer), "")
    concepts = " ".join(
        f"{concept.get('term', '')} {concept.get('detail', '')}"
        for concept in explanation.get("concepts", [])
    )
    knowledge = question.get("knowledge") or {}
    points = " ".join(
        f"{point.get('term', '')} {point.get('en', '')} {point.get('zh', '')}"
        for point in knowledge.get("points", [])
    )
    return "\n".join(
        str(value)
        for value in (
            question.get("stem", ""),
            question.get("ask", ""),
            correct_option,
            explanation.get("topic", ""),
            explanation.get("en", ""),
            explanation.get("ruleEn", ""),
            explanation.get("source", ""),
            concepts,
            points,
        )
        if value
    )


def demo_questions() -> list[dict[str, Any]]:
    rows = [
        ("demo-contract-01", 1, 5, "Consumer Rights Act 2015 defective goods short-term right to reject full refund 30 days repair replacement"),
        ("demo-contract-02", 2, 6, "Consumer Rights Act section 65 exclusion negligence death personal injury gym liability clause"),
        ("demo-contract-03", 3, 4, "Contracts Rights of Third Parties Act 1999 identified third party express enforcement right privity"),
        ("demo-contract-04", 4, 7, "Misrepresentation Act 1967 section 2(1) reasonable grounds actual belief statutory defence"),
        ("demo-contract-05", 5, 6, "Unfair Contract Terms Act 1977 section 2(2) negligent property damage reasonableness"),
        ("demo-contract-06", 6, 6, "Consumer Rights Act unfair terms good faith significant imbalance not binding severability sections 62 67"),
        ("demo-contract-07", 7, 7, "Misrepresentation Act 1967 section 3 exclusion clause reasonableness burden of proof"),
        ("demo-contract-08", 8, 5, "Consumer Rights Act 2015 section 49 services reasonable care and skill implied term"),
    ]
    return [
        {
            "id": question_id,
            "number": number,
            "sourceId": "demo",
            "subjectId": "contract",
            "_forcedChapter": chapter,
            "stem": query,
            "ask": "",
            "options": [],
            "explanation": {"answer": "", "topic": query, "en": query},
        }
        for question_id, number, chapter, query in rows
    ]


def load_questions() -> list[dict[str, Any]]:
    files = [
        ROOT / "lib" / "sra-flk1-original.json",
        ROOT / "lib" / "sra-flk1-pretested.json",
        ROOT / "lib" / "revise-flk1-assessment-2025-26.json",
    ]
    questions = [question for path in files for question in json.loads(path.read_text(encoding="utf-8"))]
    questions.extend(demo_questions())
    ids = [question["id"] for question in questions]
    if len(ids) != len(set(ids)):
        raise ValueError("Question IDs are not unique")
    return questions


def publisher_book(question: dict[str, Any]) -> str | None:
    reference = (question.get("explanation") or {}).get("publisherReference") or {}
    return PUBLISHER_BOOKS.get(str(reference.get("book", "")).strip().lower())


def publisher_chapter(question: dict[str, Any]) -> int | None:
    if question.get("_forcedChapter"):
        return int(question["_forcedChapter"])
    chapters = ((question.get("explanation") or {}).get("publisherReference") or {}).get("chapters") or []
    return int(chapters[0]) if chapters else None


def allowed_for_chapter(book: dict[str, Any], chapter_number: int | None) -> list[int] | None:
    if not chapter_number:
        return None
    chapter = next((item for item in book["chapters"] if item["number"] == chapter_number), None)
    if not chapter:
        return None
    return list(range(chapter["startPage"], chapter["contentEndPage"] + 1))


def choose_book_and_pages(
    query: str,
    candidate_ids: list[str],
    searches: dict[str, BookSearch],
    forced_chapter: int | None = None,
) -> tuple[dict[str, Any], list[tuple[float, int]]]:
    choices = []
    for book_id in candidate_ids:
        search = searches[book_id]
        allowed = allowed_for_chapter(search.book, forced_chapter)
        ranking = search.score(query, allowed)
        top = ranking[0][0] if ranking else 0
        choices.append((top, book_id, ranking))
    _, chosen_id, ranking = max(choices, key=lambda item: item[0])
    return searches[chosen_id].book, ranking


def selected_pages(ranking: list[tuple[float, int]], book: dict[str, Any]) -> list[int]:
    if not ranking:
        return [1]
    return [ranking[0][1]]


def reference_for(book: dict[str, Any], ranking: list[tuple[float, int]]) -> dict[str, Any]:
    page_numbers = selected_pages(ranking, book)
    first_page = page_numbers[0]
    chapter = chapter_for_page(book["chapters"], first_page)
    chapter_label = f"第{chapter['number']}章 · {chapter['title']}" if chapter else "主题笔记"
    headings = []
    for page_number in page_numbers:
        heading = book["pages"][page_number - 1]["heading"]
        if heading not in headings:
            headings.append(heading)
    return {
        "book": book["title"],
        "bookId": book["id"],
        "chapter": chapter_label,
        "pages": "、".join(str(page) for page in page_numbers),
        "pageNumbers": page_numbers,
        "section": "；".join(headings),
    }


def note_candidates(question: dict[str, Any], main_book_id: str) -> list[str]:
    if main_book_id == "revise-ethics-2027":
        return ["notes-ethics-9"]
    if main_book_id == "revise-constitutional-administrative-2027":
        return ["notes-legal-system-14"]
    return NOTES_BY_SUBJECT[question["subjectId"]]


def build_links(corpus_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    searches = {book_id: BookSearch(book) for book_id, book in corpus_by_id.items()}
    links: dict[str, Any] = {}
    for question in load_questions():
        query = question_query(question)
        chapter_number = publisher_chapter(question)
        forced_book = publisher_book(question)
        primary_ids = [forced_book] if forced_book else PRIMARY_BY_SUBJECT[question["subjectId"]]
        main_book, main_ranking = choose_book_and_pages(query, primary_ids, searches, chapter_number)
        notes_book, notes_ranking = choose_book_and_pages(query, note_candidates(question, main_book["id"]), searches)
        item: dict[str, Any] = {
            "textbookReferences": [reference_for(main_book, main_ranking), reference_for(notes_book, notes_ranking)]
        }
        main_reference = item["textbookReferences"][0]
        main_chapter = chapter_for_page(main_book["chapters"], main_reference["pageNumbers"][0])
        chapter_prefix = CHAPTER_PREFIXES.get((main_book["id"], question["subjectId"]))
        if chapter_prefix and main_chapter:
            item["chapterId"] = f"{chapter_prefix}-{main_chapter['number']:02d}"
        links[question["id"]] = item
    return links


def main() -> None:
    catalog, corpus_by_id = copy_and_extract()
    links = build_links(corpus_by_id)
    expected = 45 + 65 + 180 + 8
    if len(links) != expected:
        raise ValueError(f"Expected {expected} linked questions, found {len(links)}")
    if any(len(item.get("textbookReferences", [])) != 2 for item in links.values()):
        raise ValueError("Every question must have one Revise and one Notes reference")
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CORPUS_PATH.write_text(
        json.dumps({"schemaVersion": 1, "bookCount": len(BOOKS), "books": list(corpus_by_id.values())}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    LINKS_PATH.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    by_subject = Counter()
    by_primary = Counter()
    questions = {question["id"]: question for question in load_questions()}
    for question_id, item in links.items():
        by_subject[questions[question_id]["subjectId"]] += 1
        by_primary[item["textbookReferences"][0]["bookId"]] += 1
    print(json.dumps({
        "books": len(BOOKS),
        "pages": sum(book["pageCount"] for book in corpus_by_id.values()),
        "questions": len(links),
        "bySubject": dict(sorted(by_subject.items())),
        "byPrimaryBook": dict(sorted(by_primary.items())),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
