# 관리자 디데이 v1.6.0 운영 적용

적용일: 2026-10-04 KST. 사용자가 운영 DB 적용·버전 관리·커밋·push를 명시적으로 요청했다. 대상은 기존 Supabase `LEET_Service` (`jkxxtyaanyhmjbdtybkp`)와 Vercel `all-leet`, 운영 origin `https://all-leet.vercel.app`이다. 기존 기출 이미지·마크다운 작업 및 도구 캐시는 릴리스에서 제외하고 보존한다.

## 적용 범위와 순서

1. 원격 main과 로컬 기준 커밋이 같은지 확인하고 현재 스키마·관리자 함수·RLS·마이그레이션 이력을 읽기 전용으로 재조회했다.
2. `20261004082512_exam_schedule.sql`의 테이블·검증 함수·트리거·RLS·grants·초기 행과 원문 적용 이력을 같은 트랜잭션으로 반영했다. 기존 12개 마이그레이션은 유지하고 전체 `db push`는 사용하지 않았다. PostgREST schema cache를 갱신했다.
3. 운영 역할별 검증을 별도 트랜잭션에서 실행하고 전체 롤백했다. SQL 검증용 실제 관리자 UUID는 출력하거나 파일로 저장하지 않았다. 비로그인 공개 PostgREST SELECT는 HTTP 200으로 한 행을 반환했다.
4. 호환되는 새 관리자 기능이므로 `npm run release:minor`로 `1.5.1`에서 `1.6.0`으로 올리고 `npm run version:verify`로 두 버전 파일을 확인한다.
5. 운영 수집 빌드 설정(`VITE_USAGE_ANALYTICS_ENABLED=true`, `VITE_USAGE_ANALYTICS_ORIGINS=https://all-leet.vercel.app`)으로 전체 `npm run check`를 통과한 뒤 기능·문서·마이그레이션·버전·빌드 산출물만 커밋하고 main에 push한다. 기존 Vercel production 환경 설정은 변경하지 않는다.
6. 해당 커밋의 Vercel READY와 운영 홈·로그인·회원가입의 실제 공개 설정 표시 및 관리자 로그인 경계를 읽기 전용으로 확인한다. 실제 배포 커밋·완료 상태는 작업 최종 보고에 기록한다.

## 운영 DB 결과

DB 적용 시각은 **2026-10-04 23:13:41 KST**다. 초기 설정은 시험일 `2026-07-19`, 문구 `{date} 시험일 {dday}`, revision `1`이다. 임의로 다음 시험일을 추정하지 않으며 정확한 시험일·원하는 문구는 관리자가 `/admin/dday`에서 변경한다.

운영 검증에서 anon SELECT와 UPDATE 권한 차단, 일반 authenticated UPDATE 0행, INSERT/DELETE 및 revision 직접 변경 권한 차단을 확인했다. 실제 admin은 날짜와 문구를 한 번에 바꾸고 버전이 증가하며 동일 값에는 버전을 유지했다. 이전 revision의 UPDATE는 0행이고 잘못된 템플릿·무한 날짜는 제약 오류로 차단되었다. 검증 전체를 롤백한 뒤 초기 날짜·문구·revision `1`이 유지됨을 다시 확인했다.

공개 테이블의 RLS는 활성화되어 있고 SELECT 정책 및 UPDATE의 USING/WITH CHECK 양쪽에 기존 관리자 권한 기준을 사용한다. 클라이언트는 날짜·문구에만 컬럼 UPDATE 권한이 있다. 새 private 함수 두 개는 SECURITY INVOKER·빈 search_path를 사용한다. 기존 성적·Auth·Storage·Edge Function·통계 설정은 변경하지 않았다.

## 검증·운영 제한

v1.6.0에서 운영 빌드 설정으로 `npm run version:verify`와 전체 `npm run check`가 통과했다. Vitest 208개·이력 Edge 100개·통계 Edge 10개·격리 SQL 세 검증·화면 72개·공개 83개 HTML 빌드·사전 HTML 화면 8개를 확인했다. lint는 오류 0·기존 경고 70개이며 기존 번들 크기 안내는 유지된다. 운영 Supabase 보안 Advisor의 기존 다른 객체 경고 16개는 범위 밖이며, 새 `exam_schedule` 객체에 대한 경고는 없다.

로컬 쓰기 검증은 PGlite 또는 Playwright 모의 Supabase 요청으로 격리한다. 운영에 연결된 로컬 앱의 저장 버튼은 클릭하지 않는다. 실제 브라우저 관리자 저장·동시 관리자 편집은 모의 화면 테스트와 실제 DB 역할/트리거 검증으로 확인한다.

사전 HTML에는 디데이 조회 중 상태만 기록하므로 JS 없는 홈에는 설정 날짜·문구가 제공되지 않는다. 다른 열린 화면에는 정상 네트워크에서 최대 60초 조회 후 반영되며 숨김 탭은 복귀 시 갱신한다. 기존 버전의 열린 탭은 새 버전 로딩을 위한 새로고침이 필요하다.

웹 롤백은 이전 코드의 고정 날짜·문구를 다시 표시할 수 있다. 새 DB 구조는 이전 앱과 충돌하지 않으므로 삭제하지 않는다. 운영 값 정정은 관리자 폼에서 이전 날짜·템플릿을 다시 저장한다.
