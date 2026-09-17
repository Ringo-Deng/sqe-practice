#!/usr/bin/env python3
"""Extract end-of-chapter MCQs and publisher answers from Revise SQE PDFs.

The script intentionally preserves repeated questions. It only accepts complete
five-option questions with an identifiable publisher answer; incomplete records
are omitted instead of being emitted for later manual repair.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Book:
    filename: str
    slug: str
    book_id: str
    title: str
    subject_id: str
    chapter_prefix: str
    chapter_titles: tuple[str, ...]


BOOKS = (
    Book(
        "01_Revise_SQE_2027_The_Legal_System_and_Services_of_England_and_Wales.pdf",
        "legal-system-services",
        "revise-legal-system-services-2027",
        "The Legal System and Services of England and Wales",
        "legal-system",
        "legal-system-lss",
        (
            "The court structure of England and Wales",
            "Sources of law: primary legislation",
            "Sources of law: statutory interpretation",
            "Sources of law: case law",
            "The regulation of legal services",
            "Overriding legal obligations",
            "Financial services",
            "Funding options for legal services",
        ),
    ),
    Book(
        "02_Revise_SQE_2027_Trusts_Law.pdf",
        "trusts",
        "revise-trusts-2027",
        "Trusts Law",
        "trusts",
        "trusts",
        (
            "The three certainties",
            "Formalities for the creation of trusts",
            "Constitution of trusts",
            "Exceptions to the maxim that equity will not assist a volunteer",
            "Beneficial entitlement",
            "Purpose trusts",
            "Resulting trusts",
            "Family home trusts",
            "Liability of strangers and the fiduciary relationship",
            "Trustees",
            "Trustees’ liability",
            "Equitable tracing and equitable remedies",
        ),
    ),
    Book(
        "03_Revise_SQE_2027_Dispute_Resolution.pdf",
        "dispute-resolution",
        "revise-dispute-resolution-2027",
        "Dispute Resolution",
        "dispute",
        "dispute",
        (
            "Different options for dispute resolution",
            "Resolving a dispute through a civil claim",
            "Commencing proceedings",
            "Responding to a claim",
            "Statements of case",
            "Interim applications",
            "Case management",
            "Evidence",
            "Disclosure and inspection",
            "Costs and funding",
            "Trial, appeals and enforcement of money judgments",
        ),
    ),
    Book(
        "04_Revise_SQE_2027_Solicitors_Accounts.pdf",
        "solicitors-accounts",
        "revise-solicitors-accounts-2027",
        "Solicitors’ Accounts",
        "accounts",
        "accounts",
        (
            "Foundations of solicitors’ accounts",
            "Client money and client accounts: part 1",
            "Client money and client accounts: part 2",
            "Interest",
            "Bills",
            "VAT and transfers",
            "Conveyancing accounts and other accounts",
            "Records, reconciliation and reports",
        ),
    ),
    Book(
        "05_Revise_SQE_2027_Wills_and_the_Administration_of_Estates.pdf",
        "wills-estates",
        "revise-wills-estates-2027",
        "Wills and the Administration of Estates",
        "wills",
        "wills",
        (
            "Essential requirements for a valid will",
            "The personal representatives",
            "Interpretation of wills, alterations and amendments",
            "Revocation of wills",
            "The intestacy rules",
            "Property passing outside of the estate",
            "Getting the grant of representation",
            "Administration of the estate",
            "Claims under the Inheritance (Provision for Family and Dependants) Act 1975",
            "Inheritance tax",
            "Will trusts: trustees and beneficiaries",
        ),
    ),
    Book(
        "06_Revise_SQE_2027_Contract_Law(1).pdf",
        "contract",
        "revise-contract-2027",
        "Contract Law",
        "contract",
        "contract",
        (
            "Offer and acceptance",
            "Consideration",
            "The intention to create legal relations, certainty and capacity",
            "Privity of contract and rights of third parties",
            "Contents of a contract 1: Sources and interpretation",
            "Contents of a contract 2: Exemption clauses and unfair terms",
            "Misrepresentation",
            "Mistake, duress, undue influence and illegality",
            "The discharge of contracts",
            "Remedies",
        ),
    ),
    Book(
        "07_Revise_SQE_2027_Constitutional_and_Administrative_Law.pdf",
        "constitutional-administrative",
        "revise-constitutional-administrative-2027",
        "Constitutional and Administrative Law",
        "legal-system",
        "legal-system-cal",
        (
            "The constitution and conventions",
            "Parliament: Parliamentary sovereignty and parliamentary privilege",
            "Central government and devolved institutions",
            "The Crown and the royal prerogative",
            "Legislation: Primary and secondary",
            "Public order law",
            "Judicial review",
            "Human rights",
            "European Union law",
        ),
    ),
    Book(
        "08_Revise_SQE_2027_Business_Law_and_Practice.pdf",
        "business-law-practice",
        "revise-business-law-practice-2027",
        "Business Law and Practice",
        "business",
        "business",
        (
            "Starting a new business: types of business medium",
            "Partnerships",
            "Limited companies: part 1",
            "Limited companies: part 2",
            "Financing a business, financial records and accounting requirements",
            "Termination and insolvency",
            "Trading profits and VAT",
            "Income tax",
            "Capital gains tax and inheritance tax",
            "Corporation tax",
        ),
    ),
    Book(
        "09_Revise_SQE_2027_Property_Practice.pdf",
        "property-practice",
        "revise-property-practice-2027",
        "Property Practice",
        "property-practice",
        "property-practice",
        (
            "Key elements and structure of freehold property transactions: an overview",
            "Pre-contract (1): deduction and investigation of title",
            "Pre-contract (2): searches and enquiries and planning matters",
            "The draft contract and exchange of contracts",
            "Pre-completion, completion, and post-completion matters",
            "Structure and content of a lease",
            "Grant and assignment of commercial leases",
            "Commercial leasehold remedies",
            "Termination of leases and security of tenure under Part II of the Landlord and Tenant Act 1954",
            "Property taxation",
        ),
    ),
    Book(
        "12_Revise_SQE_2027_Criminal_Law.pdf",
        "criminal-law",
        "revise-criminal-law-2027",
        "Criminal Law",
        "criminal-liability",
        "criminal-liability",
        (
            "General principles of criminal law",
            "Parties to a crime",
            "Inchoate offences",
            "General defences",
            "Homicide offences",
            "Non-fatal offences against the person",
            "Theft offences",
            "Fraud offences",
            "Criminal damage",
        ),
    ),
    Book(
        "13_Revise_SQE_2027_Ethics_and_Professional_Conduct.pdf",
        "ethics",
        "revise-ethics-2027",
        "Ethics and Professional Conduct",
        "legal-services",
        "legal-services-ethics",
        (
            "SRA Principles",
            "SRA Code of Conduct",
            "Ethics and professional conduct in dispute resolution",
            "Ethics and professional conduct in business law and practice",
            "Ethics and professional conduct in criminal law and practice",
            "Ethics and professional conduct in wills and the administration of estates",
            "Ethics and professional conduct in property practice",
            "Ethics and professional conduct in solicitors’ accounts",
        ),
    ),
    Book(
        "14_Revise_SQE_2027_Land_Law.pdf",
        "land-law",
        "revise-land-law-2027",
        "Land Law",
        "land",
        "land",
        (
            "The nature and principles of land law",
            "Unregistered land",
            "Registered land",
            "Freehold estates",
            "Leasehold estates",
            "Easements",
            "Freehold covenants",
            "Mortgages",
            "Co-ownership",
        ),
    ),
    Book(
        "15_Revise_SQE_2027_Criminal_Practice.pdf",
        "criminal-practice",
        "revise-criminal-practice-2027",
        "Criminal Practice",
        "criminal-practice",
        "criminal-practice",
        (
            "Advising clients, including vulnerable clients, about the procedure and processes at the police station",
            "Bail applications",
            "First hearings before the magistrates’ court",
            "Plea before venue and allocation of business between magistrates’ court and Crown Court",
            "Case management and pre-trial hearings",
            "Principles and procedures to admit and exclude evidence",
            "Trial procedure in the magistrates’ court and Crown Court",
            "Sentencing",
            "Appeals procedure",
            "Youth Court procedure and hearings",
        ),
    ),
    Book(
        "16_Revise_SQE_2027_Tort_Law.pdf",
        "tort",
        "revise-tort-2027",
        "Tort Law",
        "tort",
        "tort",
        (
            "Negligence: Duty of care and breach",
            "Negligence: Causation, remoteness and loss",
            "Negligence: Remedies, economic loss and psychiatric harm",
            "Defences",
            "Vicarious liability and employers’ liability",
            "Occupiers’ liability",
            "Product liability",
            "Nuisance and Rylands v Fletcher",
        ),
    ),
)


QUESTION_SECTION = re.compile(r"(?m)^\s*SQE1-STYLE QUESTIONS\s*$")
QUESTION_BLOCK = re.compile(
    r"(?msi)^\s*QUESTION\s+([1-5])\s*:?\s*$\n(.*?)(?=^\s*QUESTION\s+[1-5]\s*:?\s*$|^\s*ANSWERS TO QUESTIONS\s*$|\Z)"
)
ANSWER_SECTION = re.compile(
    r"Answers to end(?:-|\s+)of(?:-|\s+)chapter(?:\s+practice)?\s+SQE1?-style(?:\s+assessment)?\s+questions",
    re.I,
)
ANSWER_BLOCK = re.compile(
    r"(?msi)^\s*Question\s+([1-5])\s*:?[ \t]*(.*?)(?=^\s*Question\s+[1-5]\s*:?[ \t]*|^\s*KEY (?:CASES|RULES|STATUTES|TERMS)|\f\s*\d+\s*$|\Z)"
)
OPTION_LINE = re.compile(r"(?m)^\s*([A-E])(?:[.)]|\s)\s*(\S.*)$")
LEAD_IN = re.compile(
    r"(?<!\w)(?:For which|On what|Under which|Which|What|How|When|Where|Who|Why|Is|Are|Does|Do|Can|Should|Will)\b"
)


def tidy(value: str) -> str:
    value = value.replace("\f", "\n")
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        if line:
            current.append(line)
        elif current:
            paragraphs.append(" ".join(current))
            current = []
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs).strip()


def split_stem_and_ask(value: str) -> tuple[str, str]:
    clean = tidy(value)
    paragraphs = clean.split("\n\n")
    if len(paragraphs) > 1:
        return "\n\n".join(paragraphs[:-1]), paragraphs[-1]
    matches = list(LEAD_IN.finditer(clean))
    if matches:
        pos = matches[-1].start()
        if pos > 0:
            return clean[:pos].strip(), clean[pos:].strip()
    if clean.endswith("?"):
        prior_stop = max(clean.rfind(".", 0, len(clean) - 1), clean.rfind("!", 0, len(clean) - 1), clean.rfind("?", 0, len(clean) - 1))
        if prior_stop >= 0:
            return clean[: prior_stop + 1].strip(), clean[prior_stop + 1 :].strip()
    return clean, ""


def parse_options(raw: str) -> tuple[str, list[dict]]:
    """Return lead-in text and a complete A-E option sequence.

    Revise books inconsistently print option markers as ``A. text`` and
    ``A text``. Looking for the ordered sequence after the lead-in question
    avoids mistaking a scenario beginning with "A solicitor ..." for option A.
    """
    normalized = raw.replace("\f", "\n")
    candidates = list(OPTION_LINE.finditer(normalized))
    question_mark = normalized.find("?")
    for index, candidate in enumerate(candidates):
        if candidate.group(1) != "A" or candidate.start() <= question_mark:
            continue
        selected = [candidate]
        position = index + 1
        for expected in "BCDE":
            while position < len(candidates) and candidates[position].group(1) != expected:
                position += 1
            if position == len(candidates):
                break
            selected.append(candidates[position])
            position += 1
        if [match.group(1) for match in selected] != list("ABCDE"):
            continue
        options = []
        for option_index, match in enumerate(selected):
            end = selected[option_index + 1].start() if option_index < 4 else len(normalized)
            first_line = match.group(2)
            continuation = normalized[match.end():end]
            options.append({"id": match.group(1), "en": tidy(first_line + "\n" + continuation), "zh": ""})
        return normalized[:candidate.start()], options
    return normalized, []


def physical_page(text: str, offset: int) -> int:
    # pdftotext places a form-feed before each physical page in these files.
    return text.count("\f", 0, offset) + 1


def book_subject(book: Book, chapter: int) -> str:
    if book.slug == "legal-system-services" and chapter >= 5:
        return "legal-services"
    return book.subject_id


def chapter_id(book: Book, chapter: int) -> str:
    if book.slug == "legal-system-services" and chapter >= 5:
        return f"legal-services-lss-{chapter:02d}"
    return f"{book.chapter_prefix}-{chapter:02d}"


def extract_book(pdf: Path, book: Book) -> tuple[list[dict], list[str]]:
    # Some workspace-backed PDFs hydrate lazily on first read. Two stdout
    # passes and choosing the longer result avoids accepting a short first
    # extraction while keeping the import deterministic once bytes are local.
    candidates = [
        subprocess.run(
            ["pdftotext", "-layout", str(pdf), "-"],
            check=True,
            stdout=subprocess.PIPE,
        ).stdout.decode("utf-8", errors="replace")
        for _ in range(2)
    ]
    text = max(candidates, key=len).replace("\f", "\n\f\n")

    markers = list(QUESTION_SECTION.finditer(text))
    questions: list[dict] = []
    warnings: list[str] = []

    for chapter_index, marker in enumerate(markers, start=1):
        section_end = markers[chapter_index].start() if chapter_index < len(markers) else len(text)
        section = text[marker.end():section_end]
        if re.search(r"not\s+appropriate\s+to\s+include\s+(?:any\s+)?SQE1-style\s+questions\s+here", section, re.I):
            continue
        answers_heading = ANSWER_SECTION.search(section)
        if not answers_heading:
            warnings.append(f"{book.filename}: chapter {chapter_index}: missing answer section")
            continue
        q_area = section[:answers_heading.start()]
        # The generic answers heading occurs before the specific end-of-chapter heading.
        generic_answers = re.search(r"(?m)^\s*ANSWERS TO QUESTIONS\s*$", q_area)
        if generic_answers:
            q_area = q_area[:generic_answers.start()]
        a_area = section[answers_heading.end():]

        q_matches = {int(m.group(1)): m for m in QUESTION_BLOCK.finditer(q_area)}
        a_matches = {int(m.group(1)): m for m in ANSWER_BLOCK.finditer(a_area)}
        if not q_matches or set(q_matches) != set(a_matches):
            warnings.append(
                f"{book.filename}: chapter {chapter_index}: "
                f"found {len(q_matches)} questions and {len(a_matches)} answers"
            )
            continue

        if chapter_index > len(book.chapter_titles):
            warnings.append(f"{book.filename}: unexpected chapter {chapter_index}")
            continue

        title = book.chapter_titles[chapter_index - 1]
        for number in sorted(q_matches):
            q_match = q_matches[number]
            raw = q_match.group(2)
            lead, options = parse_options(raw)
            if [option["id"] for option in options] != list("ABCDE"):
                warnings.append(
                    f"{book.filename}: chapter {chapter_index} question {number}: "
                    "invalid options"
                )
                continue
            stem, ask = split_stem_and_ask(lead)
            explanation = tidy(a_matches[number].group(2))
            answer_match = re.search(
                r"(?:The\s+)?(?:correct\s+)?answer\s+(?:is|was)\s*(?:option\s*)?\(?([A-Ea-e])\)?",
                explanation,
                re.I,
            )
            if not answer_match:
                warnings.append(
                    f"{book.filename}: chapter {chapter_index} question {number}: missing answer key"
                )
                continue
            answer = answer_match.group(1).upper()
            absolute_offset = marker.end() + q_match.start()
            page = physical_page(text, absolute_offset)
            answer_offset = marker.end() + answers_heading.end() + a_matches[number].start()
            answer_page = physical_page(text, answer_offset)
            source_title = f"Revise SQE 2027 · {book.title} · Chapter {chapter_index}"
            qid = f"revise-chapter-{book.slug}-c{chapter_index:02d}-q{number}"
            questions.append(
                {
                    "id": qid,
                    "number": number,
                    "sourceId": "revise",
                    "sourceSet": f"revise-chapter-{book.slug}-c{chapter_index:02d}",
                    "sourceTitle": source_title,
                    "sourcePages": [page],
                    "subjectId": book_subject(book, chapter_index),
                    "chapterId": chapter_id(book, chapter_index),
                    "topicTags": [title],
                    "stem": stem,
                    "stemZh": "",
                    "ask": ask,
                    "askZh": "",
                    "options": options,
                    "explanation": {
                        "kind": "publisher-original",
                        "answer": answer,
                        "topic": title,
                        "en": explanation,
                        "zh": "",
                        "ruleEn": "",
                        "ruleZh": "",
                        "warning": "",
                        "options": {},
                        "source": source_title,
                        "sourceUrl": "",
                        "originalPdfPages": [answer_page],
                        "textbookReferences": [
                            {
                                "book": f"Revise SQE 2027 · {book.title}",
                                "chapter": f"Chapter {chapter_index}: {title}",
                                "pages": str(page) if page == answer_page else f"{page}、{answer_page}",
                                "section": "SQE1-style questions and publisher answers",
                                "bookId": book.book_id,
                                "pageNumbers": [page] if page == answer_page else [page, answer_page],
                            }
                        ],
                        "publisherReference": {
                            "text": f"Revise SQE 2027 · {book.title}, Chapter {chapter_index}",
                            "book": book.title,
                            "chapters": [chapter_index],
                        },
                    },
                }
            )

    return questions, warnings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    records: list[dict] = []
    warnings: list[str] = []
    book_counts: dict[str, int] = {}
    for book in BOOKS:
        pdf = args.pdf_dir / book.filename
        if not pdf.exists():
            warnings.append(f"missing file: {book.filename}")
            continue
        extracted, book_warnings = extract_book(pdf, book)
        records.extend(extracted)
        warnings.extend(book_warnings)
        book_counts[book.title] = len(extracted)

    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise SystemExit("generated duplicate ids")
    args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"questionCount": len(records), "bookCounts": book_counts, "warnings": warnings}
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
