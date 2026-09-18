# LEET 문제지 PDF 78개

09예비~2027학년도, 기존 PDF 50개, HWP 변환 PDF 27개 및 사용자가 교체한 2017 언어이해 짝수형 PDF 1개. 문제 파일만 포함한다.

파일명: `LEET-{학년도}-{과목}-{문형}.pdf`

- 09예비: `2009-preliminary`
- 과목: `verbal`(언어이해), `reasoning`(추리논증)
- 문형: `odd`(홀수형), `even`(짝수형), `single`(2027학년도 단일 문형)
- 예: `LEET-2021-verbal-even.pdf`
- 변환 방식은 파일명의 `viewer` 접미사 대신 `conversion-records.json`에 기록한다.

파일명·출처·원래 경로·SHA-256은 [files.csv](files.csv)와 [files.json](files.json)에 기록했다.
이 작업은 이름과 모음을 정리한 것으로 PDF 내용은 바꾸지 않았다. 서비스의 버전 경로와 원본 HWP는 유지한다.

---
# HWP → PDF 변환 결과

변환 방법: macOS 한컴오피스 한글 Viewer 12.31.8 → 인쇄 → PDF로 저장.
원본 HWP 28개는 수정하지 않았다. 기존 테스트 1개와 추가 변환 27개, 총 28개 PDF다.
페이지 수는 Viewer 인쇄 미리보기와 일치한다. 마지막 문항, PDF 파싱, 전체 페이지 렌더링을 검증했다.
서비스의 문제지 등록 경로는 이번 변환 작업에서 수정하지 않았다.

## 출력상의 제한

일부 파일은 맥 Viewer에서 페이지가 재배치되어, PDF 페이지 수와 문서 하단에 남은 원래 총쪽수 표기가 다르다. 원래 페이지 배치를 동일하게 재현했다고 보증하지 않는다.
2019 추리논증 마지막 페이지에서는 하단 확인 사항 상자의 마지막 줄 일부가 경계에 걸쳐 출력된다. 40번 문항은 포함되어 있다.
2017 언어이해 짝수형은 사용자가 정상 파일로 교체했다. 파일명을 `LEET-2017-verbal-even.pdf`로 정리했으며 내용은 수정하지 않았다. `conversion-records.json`·CSV의 해당 항목과 아래 페이지 수는 교체 전 Viewer 변환 파일의 이력이며, 현재 파일 정보는 `files.json`·CSV를 기준으로 한다. 나머지 출력상의 특이사항은 사용자가 확인 후 사용하기로 했다.

| 학년도 | 과목 | PDF 페이지 | 하단 원래 총쪽수 | PDF |
|---|---|---|---|---|
| 2009 | 추리논증 짝수형 | 16 | 16 | [LEET-2009-reasoning-even.pdf](LEET-2009-reasoning-even.pdf) |
| 2009 | 언어이해 짝수형 | 16 | 16 | [LEET-2009-verbal-even.pdf](LEET-2009-verbal-even.pdf) |
| 09예비 | 추리논증 짝수형 | 16 | 16 | [LEET-2009-preliminary-reasoning-even.pdf](LEET-2009-preliminary-reasoning-even.pdf) |
| 09예비 | 언어이해 짝수형 | 16 | 16 | [LEET-2009-preliminary-verbal-even.pdf](LEET-2009-preliminary-verbal-even.pdf) |
| 2010 | 추리논증 짝수형 | 16 | 16 | [LEET-2010-reasoning-even.pdf](LEET-2010-reasoning-even.pdf) |
| 2010 | 언어이해 짝수형 | 15 | 15 | [LEET-2010-verbal-even.pdf](LEET-2010-verbal-even.pdf) |
| 2011 | 추리논증 짝수형 | 16 | 16 | [LEET-2011-reasoning-even.pdf](LEET-2011-reasoning-even.pdf) |
| 2011 | 언어이해 짝수형 | 15 | 15 | [LEET-2011-verbal-even.pdf](LEET-2011-verbal-even.pdf) |
| 2012 | 추리논증 짝수형 | 16 | 16 | [LEET-2012-reasoning-even.pdf](LEET-2012-reasoning-even.pdf) |
| 2012 | 언어이해 짝수형 | 15 | 15 | [LEET-2012-verbal-even.pdf](LEET-2012-verbal-even.pdf) |
| 2013 | 추리논증 짝수형 | 16 | 16 | [LEET-2013-reasoning-even.pdf](LEET-2013-reasoning-even.pdf) |
| 2013 | 언어이해 짝수형 | 15 | 15 | [LEET-2013-verbal-even.pdf](LEET-2013-verbal-even.pdf) |
| 2014 | 추리논증 짝수형 | 16 | 16 | [LEET-2014-reasoning-even.pdf](LEET-2014-reasoning-even.pdf) |
| 2014 | 언어이해 짝수형 | 15 | 15 | [LEET-2014-verbal-even.pdf](LEET-2014-verbal-even.pdf) |
| 2015 | 추리논증 짝수형 | 16 | 16 | [LEET-2015-reasoning-even.pdf](LEET-2015-reasoning-even.pdf) |
| 2015 | 언어이해 짝수형 | 16 | 16 | [LEET-2015-verbal-even.pdf](LEET-2015-verbal-even.pdf) |
| 2016 | 추리논증 짝수형 | 16 | 16 | [LEET-2016-reasoning-even.pdf](LEET-2016-reasoning-even.pdf) |
| 2016 | 언어이해 짝수형 | 16 | 16 | [LEET-2016-verbal-even.pdf](LEET-2016-verbal-even.pdf) |
| 2017 | 추리논증 짝수형 | 16 | 16 | [LEET-2017-reasoning-even.pdf](LEET-2017-reasoning-even.pdf) |
| 2017 | 언어이해 짝수형 | 16 | 16 | [LEET-2017-verbal-even.pdf](LEET-2017-verbal-even.pdf) |
| 2018 | 추리논증 짝수형 | 16 | 16 | [LEET-2018-reasoning-even.pdf](LEET-2018-reasoning-even.pdf) |
| 2018 | 언어이해 짝수형 | 16 | 16 | [LEET-2018-verbal-even.pdf](LEET-2018-verbal-even.pdf) |
| 2019 | 추리논증 짝수형 | 21 | 20 | [LEET-2019-reasoning-even.pdf](LEET-2019-reasoning-even.pdf) |
| 2019 | 언어이해 짝수형 | 15 | 15 | [LEET-2019-verbal-even.pdf](LEET-2019-verbal-even.pdf) |
| 2020 | 추리논증 짝수형 | 21 | 20 | [LEET-2020-reasoning-even.pdf](LEET-2020-reasoning-even.pdf) |
| 2020 | 언어이해 짝수형 | 15 | 15 | [LEET-2020-verbal-even.pdf](LEET-2020-verbal-even.pdf) |
| 2021 | 추리논증 짝수형 | 21 | 20 | [LEET-2021-reasoning-even.pdf](LEET-2021-reasoning-even.pdf) |
| 2021 | 언어이해 짝수형 | 15 | 15 | [LEET-2021-verbal-even.pdf](LEET-2021-verbal-even.pdf) |
