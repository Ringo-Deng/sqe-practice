"""Import the uploaded 2025-26 Revise FLK1 assessment, retaining publisher prose.

Usage: python scripts/import-revise-assessment.py /path/to/assessment.pdf
Only scan/OCR artefacts are normalised. Legal wording and the publisher's keys
and chapter citations are retained, even where the source has an apparent typo.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
SOURCE_SHA256 = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert SOURCE_SHA256 == '4505fd3d72469dc0669e5dd4975e5778030ad02f83294c52731fd2e4fd1d0310'
PDF = fitz.open(SOURCE)
assert len(PDF) == 169
RANGES = {1: ((16, 61), (110, 136), 109), 2: ((63, 107), (138, 163), 137)}
AREAS = {
    'Contract law': 'contract', 'Tort law': 'tort',
    'Dispute resolution': 'dispute', 'Business law and practice': 'business',
    'Legal services': 'legal-services', 'Ethics and professional conduct': 'legal-services',
    'Legal system of England and Wales and sources of law': 'legal-system',
    'Constitutional and administrative law and EU law': 'legal-system',
}


def clean(text):
    for word in ['claimant', 'client', 'defendant', 'court', 'Court', 'opponent', 'Parliament', 'appellant']:
        text = text.replace(word[:-1] + 'fs', word + "'s")
    text = text.replace('\xad\n', '').replace('\xad', '').replace('・', '•')
    text = text.replace('，', "'").replace('*', "'").replace('一', '-')
    text = re.sub('[□口囗〇■]', '', text)
    # Compared with the scan: stray margin marks on Session 1 answer 50.
    text = text.replace('awarded 以', 'awarded').replace('exercise rights :', 'exercise rights')
    # Apostrophes checked against original question pages 20 and 47.
    text = text.replace('shareholders, resolution', "shareholders' resolution")
    text = text.replace("shareholders'meeting", "shareholders' meeting")
    text = text.replace("the Insured'", "the 'insured'").replace("as Insured persons'", "as 'insured persons'")
    return re.sub(r'[ \t]+', ' ', text).strip()


def page_lines(index):
    lines = []
    for block in PDF[index].get_text('dict')['blocks']:
        for line in block.get('lines', []):
            x, y, right, bottom = line['bbox']
            text = ''.join(span['text'] for span in line['spans']).strip()
            if line['dir'][0] < .9 or x > 485 or right < 40 or not text:
                continue
            if x > 430 and right - x < 16:  # Answer checkboxes recognised as letters.
                continue
            if re.search(r'Session [12] (?:questions|answers)|Flag for review|DETAILED ANSWERS|Did you choose the correct answer', text, re.I):
                continue
            if re.fullmatch(r'[□口囗〇○■O\s]+', text) or (y < 42 and re.fullmatch(r'\d+', text)):
                continue
            lines.append({'text': text, 'bbox': [x, y, right, bottom], 'page': index + 1})
    # Shared baselines keep the question number before its side-by-side area label.
    lines.sort(key=lambda line: line['bbox'][3])
    groups = []
    for line in lines:
        if not groups or abs(line['bbox'][3] - groups[-1][0]['bbox'][3]) > 4:
            groups.append([line])
        else:
            groups[-1].append(line)
    lines = [line for group in groups for line in sorted(group, key=lambda line: line['bbox'][0])]
    for j, line in enumerate(lines):
        if re.fullmatch(r'[ABCDE][.．]?', line['text']) and j + 1 < len(lines) and abs(line['bbox'][3] - lines[j + 1]['bbox'][3]) < 5:
            lines[j + 1]['text'] = line['text'].rstrip('．.') + '. ' + lines[j + 1]['text']
            line['text'] = ''
    return [line for line in lines if line['text']]


PAGES = [page_lines(i) for i in range(len(PDF))]


def chunks(kind, bounds):
    lines = [line for page in PAGES[bounds[0] - 1:bounds[1]] for line in page]
    pattern = r'^' + kind + r'([\dIlO]+)\s*of\s*90'
    indices = [i for i, line in enumerate(lines) if re.match(pattern, line['text'])]
    result = []
    for j, i in enumerate(indices):
        number = int(re.match(pattern, lines[i]['text'])[1].translate(str.maketrans('IlO', '110')))
        content = lines[i + 1:indices[j + 1] if j + 1 < len(indices) else len(lines)]
        result.append({'number': number, 'header': lines[i]['text'], 'lines': content,
                       'pages': sorted({lines[i]['page'], *(line['page'] for line in content)})})
    assert [item['number'] for item in result] == list(range(1, 91))
    return result


def paragraphs(lines):
    text = ''
    previous = None
    for line in lines:
        part = clean(line['text'])
        if not part:
            continue
        separator = ' '
        if part.startswith('•'):
            separator = '\n'
        elif previous and line['page'] == previous['page'] and line['bbox'][3] - previous['bbox'][3] > 19:
            separator = '\n\n'
        text += (separator if text else '') + part
        previous = line
    return text.strip()


questions = []
for session, (question_bounds, answer_bounds, summary_page) in RANGES.items():
    qs, answers = chunks('Q', question_bounds), chunks('A', answer_bounds)
    key = {int(n): answer for n, answer in re.findall(r'(?m)^(\d{1,2})\s*\n([A-E])\s*$', PDF[summary_page - 1].get_text())}
    assert set(key) == set(range(1, 91))
    for question, answer in zip(qs, answers):
        number = question['number']
        assert number == answer['number']
        lines = question['lines']
        # Three C labels were absent from the OCR layer; checked against PDF pages 64, 79, 88.
        missing_c = {4: 'Yes, as rescission', 34: 'The shipping company has the choice', 51: 'The High Court, Court of Appeal and Supreme Court may make a declaration that a'}
        if session == 2 and number in missing_c:
            for line in lines:
                if line['text'].startswith(missing_c[number]):
                    line['text'] = 'C. ' + line['text']
                    break
        options = [(i, re.match(r'^([A-E])\.\s', line['text'])[1]) for i, line in enumerate(lines) if re.match(r'^([A-E])\.\s', line['text'])]
        assert [letter for _, letter in options] == list('ABCDE'), (session, number, options)
        head = lines[:options[0][0]]
        starts = [i for i, line in enumerate(head) if re.match(r'^(Which|What|How|Who|Can|Does|Do |Is |Are |Will|Would|Should|If |In |When )', line['text'])]
        assert starts, (session, number, 'Missing question prompt')
        ask_start = starts[-1]
        assert ask_start > 0, (session, number, 'Missing stem')
        parsed_options = []
        for j, (i, letter) in enumerate(options):
            content = [dict(line) for line in lines[i:options[j + 1][0] if j + 1 < len(options) else len(lines)]]
            content[0]['text'] = re.sub(r'^[A-E]\.\s*', '', content[0]['text'])
            parsed_options.append({'id': letter, 'en': paragraphs(content), 'zh': ''})
        body = '\n'.join(line['text'] for line in answer['lines'])
        correct = re.search(r'The correct answer (?:was|is) ([A-E])', body)
        assert correct and correct[1] == key[number], (session, number, 'Answer-key mismatch')
        area = clean(body[:correct.start()].replace('Area of law assessed:', '').replace('\n', ' ')).rstrip('.')
        assert area in AREAS, (session, number, area)
        ref_start = body.index('See Revise SQE:')
        reference = clean(body[ref_start:].replace('\n', ' ')).replace('fora discussion', 'for a discussion')
        reference = reference.replace('discussion : of', 'discussion of')
        reference_match = re.fullmatch(r'See Revise SQE: (.+?), Chapter (\d+) for a discussion of this area of law\.', reference)
        assert reference_match, (session, number, reference)
        original = clean(body[correct.start():ref_start].replace('\n', ' '))
        original = re.sub(r' (?=Options? [A-E](?: is incorrect|,| and [A-E]))', '\n\n', original)
        source_title = f'Revise FLK1 Practice Assessment 2025–26 · Session {session}'
        questions.append({
            'id': f'revise-flk1-2025-26-s{session}-{number:03}', 'number': number,
            'sourceId': 'revise', 'sourceSet': f'revise-flk1-2025-26-session-{session}',
            'sourceSession': session, 'sourceTitle': source_title,
            'sourcePages': question['pages'], 'subjectId': AREAS[area],
            'stem': paragraphs(head[:ask_start]), 'stemZh': '',
            'ask': paragraphs(head[ask_start:]), 'askZh': '', 'options': parsed_options,
            'explanation': {
                'kind': 'publisher-original', 'answer': key[number], 'topic': area,
                'en': original, 'zh': '', 'ruleEn': '', 'ruleZh': '', 'warning': '', 'options': {},
                'source': source_title, 'sourceUrl': '', 'originalPdfPages': answer['pages'],
                'publisherReference': {'text': reference, 'book': reference_match[1], 'chapters': [int(reference_match[2])]},
            },
        })

assert len(questions) == 180 and len({question['id'] for question in questions}) == 180
destination = ROOT / 'lib/revise-flk1-assessment-2025-26.json'
destination.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'questions': len(questions), 'subjects': Counter(q['subjectId'] for q in questions),
                  'publisherExplanations': len(questions), 'answerKeysCrossChecked': len(questions),
                  'sourceSha256': SOURCE_SHA256}, ensure_ascii=False))
