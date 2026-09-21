"""Link FLK2 assessments to the publisher's cited chapters in bundled PDFs.

Requires pypdf. Uses actual PDF bookmarks, so displayed pages are PDF page
numbers rather than printed page labels. Existing FLK1 links are preserved.
"""

import json
from pathlib import Path
import re

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
BOOK_IDS = {
    "Trusts Law": "revise-trusts-2027",
    "Property Practice": "revise-property-practice-2027",
    "Solicitors Accounts": "revise-solicitors-accounts-2027",
    "Land Law": "revise-land-law-2027",
    "Ethics and Professional Conduct": "revise-ethics-2027",
    "Criminal Law": "revise-criminal-law-2027",
    "Criminal Practice": "revise-criminal-practice-2027",
    "Wills and the Administration of Estates": "revise-wills-estates-2027",
}


def main():
    catalog = {book["id"]: book for book in json.loads((ROOT / "lib/textbooks.json").read_text())}
    chapters = {}
    for book_id in BOOK_IDS.values():
        book = catalog[book_id]
        pdf = PdfReader(ROOT / "public" / book["url"].lstrip("/"))
        assert len(pdf.pages) == book["pageCount"], book_id
        chapters[book_id] = {}
        for item in pdf.outline:
            if isinstance(item, list):
                continue
            match = re.match(r"^(\d+)\s+(.+)$", item.title.strip())
            if match:
                chapters[book_id][int(match[1])] = (pdf.get_destination_page_number(item) + 1, match[2])

    path = ROOT / "lib/question-textbook-links.json"
    links = json.loads(path.read_text())
    questions = json.loads((ROOT / "lib/revise-flk2-practice-assessment.json").read_text())
    for question in questions:
        citation = question["explanation"]["publisherReference"]
        book_id = BOOK_IDS[citation["book"]]
        targets = [chapters[book_id][number] for number in citation["chapters"]]
        assert targets, question["id"]
        pages = [page for page, _ in targets]
        # Keep any independently curated Notes links when regenerating.
        notes = [ref for ref in links.get(question["id"], {}).get("textbookReferences", [])
                 if ref.get("bookId", "").startswith("notes-")]
        links[question["id"]] = {"textbookReferences": [{
            "book": catalog[book_id]["title"],
            "bookId": book_id,
            "chapter": "; ".join(f"Chapter {number}: {title}" for number, (_, title) in zip(citation["chapters"], targets)),
            "pages": "、".join(map(str, pages)),
            "pageNumbers": pages,
            "section": "Publisher-cited chapter opening",
        }, *notes]}
    path.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n")
    print(f"Linked {len(questions)} FLK2 assessments using publisher citations and PDF bookmarks.")


if __name__ == "__main__":
    main()
