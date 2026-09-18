# 기출문제 PDF Storage 보관

2026-09-18, 연결된 Supabase 프로젝트 `jkxxtyaanyhmjbdtybkp`의 기존 공개 버킷 `past-exams`에 워터마크 PDF **78개 · 1,292쪽 · 약 419.8 MiB**를 업로드했다.

## 파일 경로

- 객체 경로: `watermarked/v1/LEET-{학년도}-{과목}-{문형}.pdf`
- 09예비 학년도: `2009-preliminary`
- 과목: `verbal`, `reasoning`
- 문형: `odd`, `even`, 2027학년도 `single`
- 워터마크: `리트 채점은 all LEET`, 하단 중앙 9pt 연한 회색
- 2017 언어이해 짝수형은 사용자가 교체한 정상 PDF를 기준으로 만들었다.

공개 URL은 다음 형태다.

```text
https://jkxxtyaanyhmjbdtybkp.supabase.co/storage/v1/object/public/past-exams/watermarked/v1/LEET-2027-verbal-single.pdf
```

전체 파일의 URL·학년도·과목·문형·쪽수·용량·SHA-256은 [업로드 기록 JSON](../output/pdf/watermarked/supabase-upload-records.json)과 [CSV](../output/pdf/watermarked/supabase-upload-records.csv)에 있다. [최종 검증 기록](../output/pdf/watermarked/supabase-storage-verification.json)을 함께 보관한다.

## 접근과 검증

기존 공개 버킷과 RLS 정책을 유지했다. 공개 객체 URL의 다운로드는 인증이 필요하지 않다. `storage.objects`의 RLS는 활성화되어 있고, 현재 일반 사용자 쓰기 정책은 `community-post-images` 버킷에만 적용된다. 기출 파일 업로드는 로컬 작업의 관리자 자격 증명으로 Storage API를 호출했다. 관리자 키는 코드·문서·업로드 기록에 저장하지 않았다.

TUS 재개 업로드를 사용했으며 청크는 6 MiB, 덮어쓰기는 비활성화했다. MIME은 `application/pdf`, 캐시 기간은 31,536,000초다. 객체의 사용자 메타데이터에는 학년도·과목·문형·워터마크 문구·출력 SHA-256·원본 SHA-256을 기록했다. 정정본은 새 버전 경로에 올린다.

78개 전부 공개 URL에서 전체 파일을 내려받아 PDF 헤더·MIME·용량·SHA-256을 확인했다. 읽기 전용 DB 조회에서도 객체 78개의 용량·MIME·사용자 메타데이터 SHA-256이 일치했다.

## 웹앱 연결 상태

웹앱의 `pastExamDocuments.ts`는 위 업로드 기록의 공개 URL·파일명·실제 용량으로 워터마크 PDF 78개를 등록한다. 모든 형식은 PDF이고 출처 링크 및 HWP 안내는 제거했다. 열기 링크는 공개 URL, 다운로드 링크는 `?download=<파일명>`으로 Storage의 attachment 응답을 사용한다. 2017 언어이해 짝수형도 사용자가 교체한 정상 PDF 기반의 워터마크 파일을 참조한다. 이전 정적 원본 등록 기록은 [기출문제 파일 내역](past-exam-files.md)에 남아 있으며, 실제 원본은 `downloads/past-exams-original-archive/`로 옮겨 빌드에서 제외했다.

Storage 업로드는 웹앱 재배포 없이 완료되었다. 웹앱 연결 변경은 관련 테스트와 `npm run check`를 통과한 뒤 배포한다. `main` push는 배포를 시작하므로 명시적인 사용자 요청이 필요하다.
