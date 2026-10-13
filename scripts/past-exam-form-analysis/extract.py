"""Read local PDFs/corpora into an isolated comparison cache; no app/DB changes."""
import argparse
import json
import re
import sys
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/past-exam-markdown'))
from assemble import extract_direct, reading_order

QUESTION = re.compile(r'^\s*(\d{1,2})\s*[.．。)]\s*(.+)')
RANGE = re.compile(r'^[\[［【(]?\s*(\d{1,2})\s*[~～〜∼−–—-]\s*(\d{1,2})\s*[\]］】)]?')


def count_for(path):
    year = int(path.name.split('-')[1])
    return 40 if year <= 2009 else 35 if year <= 2018 else 30 if 'verbal' in path.name else 40


def direct_one(args):
    path, cache = args
    target = cache / (path.stem + '.json')
    ocr = cache.parent / 'pdf-ocr' / path.stem
    if target.exists():
        previous=json.loads(target.read_text())
        if previous.get('segmentation_version')==4 and len(previous['questions'])==count_for(path):return
        if ocr.exists():
            pages=[json.loads(p.read_text()) for p in sorted(ocr.glob('page-*.json'))]
        elif previous['questions']:
            grouped=defaultdict(list)
            for q in previous['questions']:
                for line in q['lines']:grouped[line['page']].append(line)
            pages=[dict(page=n,lines=lines) for n,lines in sorted(grouped.items())]
        else:
            pages=extract_direct(path)
    else:
        pages = ([json.loads(p.read_text()) for p in sorted(ocr.glob('page-*.json'))]
                 if ocr.exists() else extract_direct(path))
    questions, current, next_number = [], None, 1
    for page in pages:
        for column in (0, 1):
            for line in reading_order([l for l in page['lines'] if l['column'] == column]):
                text = line['text'].strip()
                if not .185 <= line['y'] < .92 and page['page'] == 1:
                    continue
                if not .10 <= line['y'] < .92:
                    continue
                compact = re.sub(r'\s', '', text)
                if any(word in compact for word in ['언어이해', '추리논증', '홀수형', '짝수형', '확인사항']):
                    continue
                q = QUESTION.match(text)
                # Only sequential question numbers at the outer edge are headings.
                edge = line['x'] - column * .5 < (.117 if column == 0 else .035)
                if edge and q and int(q.group(1)) == next_number:
                    current = dict(number=next_number, lines=[], source_page=page['page'], column=column)
                    questions.append(current)
                    next_number += 1
                elif edge and RANGE.match(text) and ('다음' in text or '물음' in text):
                    current = None
                if current:
                    current['lines'].append(dict(line, page=page['page']))
    result = dict(document=path.stem, segmentation_version=4,
                  method='apple_vision' if ocr.exists() else 'pdf_text',
                  expected_count=count_for(path), questions=questions)
    target.write_text(json.dumps(result, ensure_ascii=False))
    print(path.stem, len(questions), '/', count_for(path), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    paths = sorted(p for p in (ROOT / 'output/pdf').glob('LEET-*.pdf')
                   if '-2027-' not in p.name and ('-even' in p.name or any(f'-{y}-' in p.name for y in (2024,2025,2026)))
                   and (not any(f'-{y}-' in p.name for y in (2022,2023))
                        or len(list((args.cache.parent/'pdf-ocr'/p.stem).glob('page-*.json')))==(15 if '-verbal-' in p.name else 20)))
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(direct_one, [(p, args.cache) for p in paths]))


if __name__ == '__main__':
    main()
