# 개발 가이드

## 명령어

| 목적 | 명령 |
|---|---|
| 의존성 설치 | `npm install` |
| 개발 서버 | `npm run dev` |
| 프로덕션 빌드 | `npm run build` |
| 예시 이력 생성 | `npm run gen:example-history` |
| 예시 이력 시드 | `npm run seed:example-history` |

Vite 개발 서버 포트는 `vite.config.ts`에서 `3000`으로 설정되어 있다. 빌드 산출물은 `build/`다.

## 테스트·lint·타입 검사

현재 `package.json`에는 `test`, `lint`, `typecheck` 스크립트가 없고, 저장소 자체의 테스트 러너 설정도 확인되지 않았다. 따라서 현재 정의된 자동 검증 명령은 `npm run build`다.

빌드는 `build/` 파일을 갱신한다. 검증 뒤에는 의도하지 않은 산출물 변경이 있는지 확인한다.

## 코드 스타일에서 관찰되는 규칙

- React 함수 컴포넌트와 named export를 주로 사용한다.
- TypeScript 타입은 인터페이스와 `type` 별칭을 함께 사용한다.
- import는 외부 패키지, 내부 컴포넌트/유틸/타입 순으로 작성되는 경향이 있다.
- 페이지별 로컬 상태는 hooks로 선언하고, 비동기 핸들러는 `async` 함수로 둔다.
- 사용자 메시지와 주석은 한국어가 많으며, 오류는 `console.error`와 `alert`로 처리하는 패턴이 있다.
- 스타일은 JSX의 Tailwind 클래스와 일부 inline style을 혼용한다.
- 라우트 문자열·Supabase 테이블 문자열은 각 사용 위치에 직접 작성되어 있다.

명시적인 ESLint/Prettier 설정은 확인되지 않았다. 새로운 포맷 규칙을 도입하기 전에는 기존 파일의 형식을 우선 따른다.

## 새 기능의 일반적인 변경 범위

### 새 페이지

1. `src/pages/`에 화면을 만든다.
2. `src/App.tsx`에 route를 등록한다.
3. 로그인 전용이면 `PrivateRoute`를 적용한다.
4. 필요한 경우 `GlobalBottomNav` 및 SEO 경로 정의를 검토한다.

### 새 Supabase 데이터

1. 타입을 `src/types/` 또는 기존 공용 타입 위치에 정의한다.
2. DB 스키마와 RLS 정책을 먼저 설계·검토한다.
3. 브라우저 직접 접근인지 Edge Function 경유인지 기존 데이터 경계를 기준으로 결정한다.
4. 마이그레이션 이력 불일치를 확인한 뒤, 명시적 승인 아래 변경한다.

### 커뮤니티 이미지

게시글 생성, Storage 업로드, `image_urls` 갱신은 별도 요청으로 실행된다. 실패 시 일부 단계만 성공할 수 있으므로 성공·실패·삭제 경로를 함께 검증한다.

## 위험도가 높은 변경

- `supabase/config.toml`의 Edge Function JWT 설정 및 Edge Function의 사용자 식별
- 현재 `verify_jwt = false`인 성적 이력 Edge Function과 URL `userId` 기반 접근
- `kv_store_cd835c22`의 이력 읽기·쓰기·삭제
- RLS 정책, Storage 정책, `SECURITY DEFINER` 함수, DB 트리거
- 커뮤니티 이미지 삭제와 Storage 객체 정리
- 채점 정답·점수 환산 데이터
- `App.tsx`의 라우팅과 이력 상태 변경

## 권장 검증 순서

1. 변경 범위와 연관된 기존 화면·테이블·정책을 읽는다.
2. 최소 범위로 구현한다.
3. `npm run build`를 실행한다.
4. 영향을 받은 사용자 흐름을 브라우저에서 확인한다.
5. Supabase 변경이 있다면 인증 사용자와 비인증 사용자 모두의 권한 경로를 확인한다.
