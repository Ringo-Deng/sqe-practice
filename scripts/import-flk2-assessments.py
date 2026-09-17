"""Import the supplied FLK2 SRA samples and Revise practice assessment.

Usage:
    python scripts/import-flk2-assessments.py ORIGINAL.pdf PRETESTED.pdf PRACTICE.pdf

The import is deliberately strict: question numbering, five-option structure, answer
keys, publisher explanations, and Revise chapter references are all cross-checked.
Only scan/OCR artefacts are normalised; the publisher wording is retained.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL, PRETESTED, PRACTICE = map(Path, sys.argv[1:4])
EXPECTED_HASHES = {
    ORIGINAL: "7f1dd2d88c434399b47e1382f0b75ced6b1989a3a099dba5c63392929e3bcd5d",
    PRETESTED: "65e59d446814945e053f78d5189098d11754cb5202e8ea90fb385233074bb64f",
    PRACTICE: "705e32b3846c453a7c0e18f520420fbbf073d4b7abde1d8ae99dea547427435d",
}
for path, expected in EXPECTED_HASHES.items():
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual == expected, (path, actual)


PROMPT_START = re.compile(
    r"^(Which|What|How|Who|Whose|Can|Does|Do |Did |Has |Is |Are |Will|Would|Should|If |In |Into |When |Why |Apart |Excluding )"
)

SRA_SUBJECTS = {
    "sra-flk2-original": {
        "criminal-practice": [1, 2, 14, 16, 26, 40],
        "criminal-liability": [17, 18, 23, 31, 33, 35, 42],
        "trusts": [3, 9, 10, 29, 30],
        "wills": [4, 5, 15, 20, 21, 22, 25, 41, 43],
        "accounts": [27, 45],
        "land": [12, 19, 24, 36],
        "property-practice": [7, 8, 11, 13, 32, 34, 37, 38, 44],
        "flk2-ethics": [6, 28, 39],
    },
    "sra-flk2-pretested": {
        "criminal-practice": [48, 55, 64, 69, 77, 81, 90, 98, 106, 109],
        "criminal-liability": [52, 59, 67, 74, 85, 88, 96, 102],
        "trusts": [46, 53, 61, 66, 80, 89, 94, 104, 107, 110],
        "wills": [49, 54, 62, 70, 79, 83, 87, 100],
        "accounts": [57, 72, 91],
        "land": [47, 51, 58, 63, 65, 71, 73, 78, 99, 103],
        "property-practice": [50, 56, 60, 68, 75, 82, 84, 86, 93, 95, 97, 101],
        "flk2-ethics": [76, 92, 105, 108],
    },
}
SUBJECT_TOPICS = {
    "property-practice": "Property Law and Practice",
    "wills": "Wills and the Administration of Estates",
    "accounts": "Solicitors Accounts",
    "land": "Land Law",
    "trusts": "Trusts Law",
    "criminal-liability": "Criminal Liability",
    "criminal-practice": "Criminal Law and Practice",
    "flk2-ethics": "Ethics and Professional Conduct",
}
BOOK_PREFIXES = {
    "Property Practice": "property-practice",
    "Wills and the Administration of Estates": "wills",
    "Solicitors Accounts": "accounts",
    "Land Law": "land",
    "Trusts Law": "trusts",
    "Criminal Law": "criminal-liability",
    "Criminal Practice": "criminal-practice",
    "Ethics and Professional Conduct": "flk2-ethics",
}


def tidy(text: str) -> str:
    for word in [
        "claimant", "client", "defendant", "court", "Court", "opponent", "Parliament",
        "appellant", "firm", "man", "woman", "solicitor", "testator", "settlor", "trustee",
        "landlord", "tenant", "executor", "beneficiary", "partner", "daughter", "father",
    ]:
        text = text.replace(word[:-1] + "fs", word + "'s")
    text = text.replace("\xad\n", "").replace("\xad", "").replace("・", "•")
    text = text.replace("，", "'").replace("*", "'").replace("一", "-")
    text = re.sub(r"\bmagistrates[159]\b", "magistrates'", text)
    text = text.replace("firirTs", "firm's").replace("agreement1", "agreement'")
    text = text.replace("trigger5", "trigger'").replace("2V", "21")
    text = re.sub(r"\bAPI\b", "AP1", text)
    text = re.sub(r"[□口囗〇○■]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def prose(text: str) -> str:
    paragraphs = re.split(r"\n\s*\n+", text.strip())
    return "\n\n".join(tidy(re.sub(r"\s*\n\s*", " ", p)) for p in paragraphs if tidy(p))


def parse_sra(path: Path, *, start: int, end: int, first_page: int, answer_page: int, source_set: str, title: str):
    pdf = fitz.open(path)
    answer_text = pdf[answer_page - 1].get_text()
    triples = re.findall(r"(?m)^\s*(\d{1,3})\s*\n\s*([A-E])\s*\n(?:\s*(\d+)%\s*\n)?", answer_text)
    key = {int(number): (answer, int(percent) if percent else None) for number, answer, percent in triples}
    assert set(key) == set(range(start, end + 1)), (source_set, sorted(key))
    subject_by_number = {
        number: subject
        for subject, numbers in SRA_SUBJECTS[source_set].items()
        for number in numbers
    }
    assert set(subject_by_number) == set(range(start, end + 1)), (source_set, sorted(subject_by_number))
    questions = []
    for number, page_number in zip(range(start, end + 1), range(first_page, first_page + end - start + 1)):
        page = pdf[page_number - 1]
        blocks = [block[4] for block in page.get_text("blocks") if block[1] < 760]
        text = "\n".join(blocks)
        match = re.search(rf"Question\s+{number}\s*\n(.*)", text, re.S)
        assert match, (source_set, number, page_number)
        body = match.group(1).strip()
        option_matches = list(re.finditer(r"(?m)^\s*([A-E])\.\s*", body))
        assert [m.group(1) for m in option_matches] == list("ABCDE"), (source_set, number)
        head = body[:option_matches[0].start()].strip()
        head_paragraphs = [prose(p) for p in re.split(r"\n\s*\n+", head) if prose(p)]
        assert len(head_paragraphs) >= 2, (source_set, number, head_paragraphs)
        ask = head_paragraphs[-1]
        assert ask.endswith("?"), (source_set, number, ask)
        options = []
        for index, option_match in enumerate(option_matches):
            finish = option_matches[index + 1].start() if index + 1 < len(option_matches) else len(body)
            options.append({"id": option_match.group(1), "en": prose(body[option_match.end():finish]), "zh": ""})
        answer, percentage = key[number]
        subject_id = subject_by_number[number]
        questions.append({
            "sourceId": "sra",
            "sourceSet": source_set,
            "sourceTitle": title,
            "subjectId": subject_id,
            "id": f"{source_set}-{number:03}",
            "number": number,
            "sourcePages": [page_number],
            "stem": "\n\n".join(head_paragraphs[:-1]),
            "stemZh": "",
            "ask": ask,
            "askZh": "",
            "options": options,
            "explanation": {
                "answer": answer,
                "topic": SUBJECT_TOPICS[subject_id],
                "en": "",
                "zh": f"正确答案是 {answer}。本题来自 SRA 官方样题，官方文件仅提供答案表，未提供逐项解析。",
                "ruleEn": "",
                "ruleZh": "",
                "warning": "",
                "options": {option: {"en": "", "zh": ("SRA 官方正确答案。" if option == answer else "本选项不是 SRA 官方答案。")} for option in "ABCDE"},
                "source": "SRA 官方答案表",
                "sourceUrl": "https://sqe.sra.org.uk/assessments/sqe1-assessments/sqe1-sample-questions",
            },
            **({"officialCorrectPercent": percentage} if percentage is not None else {}),
        })
    return questions


AREAS = {
    "Property practice": "property-practice",
    "Wills and the administration of estates": "wills",
    "Wills and the Administration of Estates": "wills",
    "Solicitors accounts": "accounts",
    "Land law": "land",
    "Trusts law": "trusts",
    "Criminal law": "criminal-liability",
    "Criminal practice": "criminal-practice",
    "Ethics and professional conduct": "flk2-ethics",
}


def page_lines(pdf, index):
    lines = []
    for block in pdf[index].get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            x, y, right, bottom = line["bbox"]
            text = "".join(span["text"] for span in line["spans"]).strip()
            if line["dir"][0] < .9 or x > 1070 or right < 50 or not text:
                continue
            if x > pdf[index].rect.width * .88 and right - x < 50:
                continue
            if re.search(r"Session [12] (?:questions|answers)|Flag for review|DETAILED ANSWERS|Did you choose the correct answer", text, re.I):
                continue
            if re.fullmatch(r"(?:qumSEOns|SUOQSenb)", text, re.I):
                continue
            if re.fullmatch(r"[□口囗〇○■O\s]+", text) or (y < 42 and re.fullmatch(r"\d+", text)):
                continue
            lines.append({"text": text, "bbox": [x, y, right, bottom], "page": index + 1})
    lines.sort(key=lambda line: line["bbox"][3])
    groups = []
    for line in lines:
        if not groups or abs(line["bbox"][3] - groups[-1][0]["bbox"][3]) > 5:
            groups.append([line])
        else:
            groups[-1].append(line)
    lines = [line for group in groups for line in sorted(group, key=lambda line: line["bbox"][0])]
    for index, line in enumerate(lines):
        if re.fullmatch(r"[ABCDE][.．]?", line["text"]) and index + 1 < len(lines) and abs(line["bbox"][3] - lines[index + 1]["bbox"][3]) < 6:
            lines[index + 1]["text"] = line["text"].rstrip("．.") + ". " + lines[index + 1]["text"]
            line["text"] = ""
    return [line for line in lines if line["text"]]


def paragraphs(lines):
    text = ""
    previous = None
    for line in lines:
        part = tidy(line["text"])
        if not part:
            continue
        separator = " "
        if part.startswith("•"):
            separator = "\n"
        elif previous and line["page"] == previous["page"] and line["bbox"][3] - previous["bbox"][3] > 28:
            separator = "\n\n"
        text += (separator if text else "") + part
        previous = line
    return text.strip()


def chunks(pages, kind, bounds):
    lines = [line for page in pages[bounds[0] - 1:bounds[1]] for line in page]
    pattern = r"^" + kind + r"([\dIlO\s]+?)\s*of\s*90"
    indices = [i for i, line in enumerate(lines) if re.match(pattern, line["text"])]
    result = []
    for position, index in enumerate(indices):
        raw_number = re.sub(r"\s+", "", re.match(pattern, lines[index]["text"])[1])
        number = int(raw_number.translate(str.maketrans("IlO", "110")))
        content = lines[index + 1:indices[position + 1] if position + 1 < len(indices) else len(lines)]
        result.append({
            "number": number,
            "lines": content,
            "pages": sorted({lines[index]["page"], *(line["page"] for line in content)}),
        })
    assert [item["number"] for item in result] == list(range(1, 91)), (kind, bounds, [item["number"] for item in result])
    return result


def parse_revise(path: Path):
    pdf = fitz.open(path)
    assert len(pdf) == 177
    pages = [page_lines(pdf, index) for index in range(len(pdf))]
    ranges = {1: ((18, 63), (117, 143), 116), 2: ((65, 114), (145, 171), 144)}
    questions = []
    for session, (question_bounds, answer_bounds, summary_page) in ranges.items():
        source_title = f"Revise FLK2 Practice Assessment · Session {session}"
        question_chunks = chunks(pages, "Q", question_bounds)
        answer_chunks = chunks(pages, "A", answer_bounds)
        summary = pdf[summary_page - 1].get_text()
        key = {int(number): answer for number, answer in re.findall(r"(?m)^\s*(\d{1,2})\s*\n\s*([A-E])\s*$", summary)}
        assert set(key) == set(range(1, 91)), (session, sorted(key))
        for question, answer in zip(question_chunks, answer_chunks):
            number = question["number"]
            assert number == answer["number"]
            lines = question["lines"]
            option_starts = [(i, re.match(r"^([A-E])\.\s", line["text"])[1]) for i, line in enumerate(lines) if re.match(r"^([A-E])\.\s", line["text"])]
            assert [letter for _, letter in option_starts] == list("ABCDE"), (session, number, option_starts)
            head = lines[:option_starts[0][0]]
            starts = [i for i, line in enumerate(head) if PROMPT_START.match(line["text"])]
            manual_prompts = {
                (2, 28): "Which of the following best describes the legal position?",
            }
            if starts:
                ask_start = starts[-1]
                assert ask_start > 0, (session, number, "Missing stem")
                stem_text = paragraphs(head[:ask_start])
                ask_text = paragraphs(head[ask_start:])
            else:
                assert (session, number) in manual_prompts, (session, number, "Missing question prompt", [line["text"] for line in head])
                stem_text = paragraphs(head)
                ask_text = manual_prompts[(session, number)]
            options = []
            for index, (line_index, letter) in enumerate(option_starts):
                finish = option_starts[index + 1][0] if index + 1 < len(option_starts) else len(lines)
                content = [dict(line) for line in lines[line_index:finish]]
                content[0]["text"] = re.sub(r"^[A-E]\.\s*", "", content[0]["text"])
                options.append({"id": letter, "en": paragraphs(content), "zh": ""})
            answer_body = "\n".join(line["text"] for line in answer["lines"])
            correct = re.search(r"The correct answer (?:was|is) ([A-E])", answer_body)
            assert correct and correct[1] == key[number], (session, number, correct[1] if correct else None, key[number])
            area = tidy(answer_body[:correct.start()].replace("Area of law assessed:", "").replace("\n", " ")).rstrip(".")
            canonical_area = next((candidate for candidate in AREAS if area.startswith(candidate)), None)
            assert canonical_area, (session, number, area)
            area = canonical_area
            reference_start = answer_body.index("See Revise SQE:")
            reference = tidy(answer_body[reference_start:].replace("\n", " ")).replace("fora discussion", "for a discussion")
            reference = reference.replace("discussion : of", "discussion of")
            reference = reference.replace("Trusts Lawt Chapter", "Trusts Law, Chapter")
            reference_match = re.fullmatch(r"See Revise SQE: (.+?), Chapters? (.+?) for a discussion of this area of law\.", reference)
            assert reference_match, (session, number, reference)
            reference_chapters = [int(value) for value in re.findall(r"\d+", reference_match[2])]
            assert reference_chapters, (session, number, reference)
            book = reference_match[1]
            assert book in BOOK_PREFIXES, (session, number, book)
            chapter_ids = [f"{BOOK_PREFIXES[book]}-{chapter:02}" for chapter in reference_chapters]
            original = tidy(answer_body[correct.start():reference_start].replace("\n", " "))
            original = re.sub(r" (?=Options? [A-E](?: is incorrect|,| and [A-E]))", "\n\n", original)
            questions.append({
                "id": f"revise-flk2-practice-s{session}-{number:03}",
                "number": number,
                "sourceId": "revise",
                "sourceSet": f"revise-flk2-practice-session-{session}",
                "sourceSession": session,
                "sourceTitle": source_title,
                "sourcePages": question["pages"],
                "subjectId": AREAS[area],
                "chapterId": chapter_ids[0],
                **({"relatedChapterIds": chapter_ids[1:]} if len(chapter_ids) > 1 else {}),
                "stem": stem_text,
                "stemZh": "",
                "ask": ask_text,
                "askZh": "",
                "options": options,
                "explanation": {
                    "kind": "publisher-original",
                    "answer": key[number],
                    "topic": area,
                    "en": original,
                    "zh": "",
                    "ruleEn": "",
                    "ruleZh": "",
                    "warning": "",
                    "options": {},
                    "source": source_title,
                    "sourceUrl": "",
                    "originalPdfPages": answer["pages"],
                    "publisherReference": {
                        "text": reference,
                        "book": book,
                        "chapters": reference_chapters,
                    },
                },
            })
    assert len(questions) == 180 and len({question["id"] for question in questions}) == 180
    return questions


original = parse_sra(
    ORIGINAL,
    start=1,
    end=45,
    first_page=3,
    answer_page=48,
    source_set="sra-flk2-original",
    title="FLK2 原始样题 · 2026-08-25 · Version 13",
)
pretested = parse_sra(
    PRETESTED,
    start=46,
    end=110,
    first_page=4,
    answer_page=69,
    source_set="sra-flk2-pretested",
    title="FLK2 Pre-tested 样题 · 2026-08-25 · Version 13",
)
revise = parse_revise(PRACTICE)

for filename, questions in [
    ("sra-flk2-original.json", original),
    ("sra-flk2-pretested.json", pretested),
    ("revise-flk2-practice-assessment.json", revise),
]:
    (ROOT / "lib" / filename).write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n")

print(json.dumps({
    "sraOriginal": len(original),
    "sraPretested": len(pretested),
    "revise": len(revise),
    "reviseSubjects": Counter(question["subjectId"] for question in revise),
}, ensure_ascii=False))
