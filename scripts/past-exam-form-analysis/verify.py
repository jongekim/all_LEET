"""Verify research mapping coverage, provenance and permitted deployment status."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('mapping',type=Path)
    args=parser.parse_args();data=json.loads(args.mapping.read_text());rows=data['questions']
    assert not data['skipped'],data['skipped']
    assert len(rows)==1350,len(rows)
    assert data['status']=='research_only_not_runtime_approved'
    groups=collections.defaultdict(list)
    for row in rows:groups[row['year'],row['subject']].append(row)
    assert len(groups)==38,len(groups)
    assert len({r['canonical_question_id'] for r in rows})==1350
    for (year,subject),part in groups.items():
        n=len(part)
        year_number=2009 if year=='09예비' else int(year)
        expected=40 if year_number<=2009 else 35 if year_number<=2018 else 30 if subject=='verbal' else 40
        assert n==expected,(year,subject,n,expected)
        assert sorted(r['odd_question_no'] for r in part)==list(range(1,n+1))
        assert sorted(r['even_question_no'] for r in part)==list(range(1,n+1))
        for r in part:
            m=r['odd_choice_to_even']
            assert m is None or sorted(m)==[1,2,3,4,5]
            assert r['field_would_change']==(r['odd_current_field']!=r['even_current_field'])
            if r['review_status'] in ('machine_supported','source_visual_reviewed'):
                assert not r['review_issues'] and r['answer_key_consistent'] is True
            if m:
                assert r['answer_key_consistent']==(m[r['odd_correct_answer']-1]==r['even_correct_answer'])
    for file,sha in data['sources'].items():
        assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==sha,file
    assert len(data['sources'])==76
    print(json.dumps(dict(question_pairs=len(rows),form_positions=len(rows)*2,cohorts=len(groups),
                          source_pdfs=len(data['sources']),
                          review_required=sum(r['review_status']=='requires_review' for r in rows),
                          approved_for_runtime=False),ensure_ascii=False,indent=2))


if __name__=='__main__':main()
