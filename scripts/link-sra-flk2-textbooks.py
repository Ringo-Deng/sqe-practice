"""Add SRA FLK2 chapter links without changing official questions or answers.

The mappings reuse the existing reviewed mind-map topics, with five Accounts
questions added and the trust-termination question assigned to beneficial
entitlement. Ethics keeps the existing cross-FLK syllabus classification.
Requires pypdf; PDF destinations come from the bundled books' bookmarks.
"""
import json
from pathlib import Path
import re
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
BOOKS = {
    "trusts": "revise-trusts-2027",
    "property-practice": "revise-property-practice-2027",
    "accounts": "revise-solicitors-accounts-2027",
    "land": "revise-land-law-2027",
    "flk2-ethics": "revise-ethics-2027",
    "criminal-liability": "revise-criminal-law-2027",
    "criminal-practice": "revise-criminal-practice-2027",
    "wills": "revise-wills-estates-2027",
}
ETHICS_CHAPTERS = {
    "sra-flk2-original-006": 5,
    "sra-flk2-original-028": 5,
    "sra-flk2-original-039": 7,
    "sra-flk2-pretested-076": 7,
    "sra-flk2-pretested-092": 6,
    "sra-flk2-pretested-105": 2,
    "sra-flk2-pretested-108": 6,
}


def main():
    catalog = {book["id"]: book for book in json.loads((ROOT / "lib/textbooks.json").read_text())}
    matches = json.loads((ROOT / "lib/sra-flk2-chapter-matches.json").read_text())
    questions = [q for name in ["original", "pretested"] for q in json.loads((ROOT / f"lib/sra-flk2-{name}.json").read_text())]
    assert set(matches) | set(ETHICS_CHAPTERS) == {q["id"] for q in questions}
    bookmarks = {}
    for book_id in BOOKS.values():
        book = catalog[book_id]
        pdf = PdfReader(ROOT / "public" / book["url"].lstrip("/"))
        assert len(pdf.pages) == book["pageCount"]
        bookmarks[book_id] = {}
        for item in pdf.outline:
            if isinstance(item, list):
                continue
            match = re.match(r"^(\d+)\s+(.+)$", item.title.strip())
            if match:
                bookmarks[book_id][int(match[1])] = (pdf.get_destination_page_number(item) + 1, item.title.strip())
    path = ROOT / "lib/question-textbook-links.json"
    links = json.loads(path.read_text())
    for q in questions:
        book_id = BOOKS[q["subjectId"]]
        chapter_id = matches.get(q["id"])
        chapter = int(chapter_id.rsplit("-", 1)[1]) if chapter_id else ETHICS_CHAPTERS[q["id"]]
        page, title = bookmarks[book_id][chapter]
        notes = [ref for ref in links.get(q["id"], {}).get("textbookReferences", []) if ref.get("bookId", "").startswith("notes-")]
        links[q["id"]] = {
            **({"chapterId": chapter_id} if chapter_id else {}),
            "textbookReferences": [{
                "book": catalog[book_id]["title"], "bookId": book_id,
                "chapter": f"Chapter {title}", "pages": str(page), "pageNumbers": [page],
                "section": "相关教材章节（按考点匹配；非官方解析）",
            }, *notes],
        }
    path.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n")
    print(f"Added {len(questions)} textbook links and {len(matches)} chapter classifications.")


if __name__ == "__main__":
    main()
