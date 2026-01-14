
  # 리트 채점은 all LEET

  This is a code bundle for all LEET.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## 서비스 소개

  리트(LEET) 기출/모의고사 성적을 입력하고, 채점 결과/추이를 확인하며 기록을 관리하는 웹 앱입니다.
  Vite + React 기반으로 동작하며, 인증/데이터 저장은 Supabase를 사용합니다.

  ## 서비스 상세

  ### 한 줄 요약

  - **기출 채점**: 학년도/시험유형(홀수형·짝수형) 선택 → 답안(1~5) 입력 → 즉시 채점/분야별 분석/오답 확인
  - **기록 관리(로그인)**: 채점 결과를 서버에 저장하고, 연도별 추이(표준점수/백분위/정답률)를 확인
  - **지원 가능성 분석(로그인)**: LEET 합산 표준점수 + GPA(100점 만점) 기반으로 25개 로스쿨 지원 전략(적정/소신/불가)을 제공
  - **사설 모의고사 기록(로그인)**: 시험일/기관/회차 + 과목별 표준점수·백분위를 저장하고 추이 그래프로 확인

  ### 사용자 플로우 (대표)

  1) (비로그인 가능) 홈에서 답안 입력 → `채점하기` → 결과 확인
  2) (로그인 시) 결과가 자동 저장 → 히스토리/추이 그래프 확인 → 필요 시 특정 기록 삭제
  3) (로그인 시) 로스쿨 분석에서 점수 입력 → 결과에서 적정/소신/불가 목록 확인

  ### 데이터 흐름 개요

  - **채점 로직**: `src/utils/grading.tsx`가 정답 데이터(`src/utils/answerData.ts`)와 점수 환산표(`src/utils/scoreData.ts`)를 사용해 `GradingResult`를 생성합니다.
  - **저장(로그인 시)**: 프론트는 Supabase Edge Function으로 결과를 전송하고, 서버는 Postgres KV 테이블에 JSON으로 저장합니다.
  - **인증**: `src/contexts/AuthContext.tsx`에서 Supabase Auth 기반 이메일 회원가입/로그인/로그아웃을 처리합니다(이메일 인증 필수).

  ## 페이지 가이드 (Routes)

  라우팅 정의는 `src/App.tsx`에 있습니다.

  ### 공개 페이지 (로그인 없이 접근 가능)

  - `/` 홈 (채점)
    - 파일: `src/pages/HomePage.tsx`
    - 기능
      - 학년도 선택(`src/components/YearSelector.tsx`)
      - 시험 유형 선택(홀수형/짝수형)
      - 과목별 답안 입력(언어이해/추리논증, `src/components/AnswerSheet.tsx`)
      - `채점하기` 클릭 시 `gradeAnswers()`로 결과 산출 후 `/result`로 이동
    - 로그인 여부
      - 비로그인: 채점/결과 확인은 가능하지만 서버 저장은 하지 않습니다.
      - 로그인: 채점 결과가 히스토리에 저장됩니다.

  - `/result` 채점 결과
    - 파일: `src/pages/ResultPage.tsx`
    - 진입 방식
      - 홈에서 채점 직후 `navigate('/result', { state: { results } })`로 전달된 결과를 렌더링합니다.
      - 히스토리에서 `자세히 보기`로 진입하는 경우 단일 결과(`state.result`) 또는 두 과목 결과(`state.results`)를 모두 지원합니다.
    - 기능
      - 과목별 요약 카드(`src/components/ResultPanel.tsx`)
      - 입력 답안 그리드/오답 정답 보기(`src/components/AnswerSheetResult.tsx`)
      - 두 과목을 함께 채점했으면 “종합 점수(표준점수 합산/백분위 평균)” 영역을 추가로 표시
      - 2020년 이전 시험은 “보정 점수”를 함께 표기(참고용)

  - `/login` 로그인
    - 파일: `src/pages/LoginPage.tsx`
    - 기능
      - 이메일 입력을 “아이디 + 도메인(프리셋/직접입력)” 형태로 제공
      - Supabase Auth 로그인
      - 이메일 인증 미완료 시 안내 및(선택) 인증 메일 재전송 지원

  - `/signup` 회원가입
    - 파일: `src/pages/SignupPage.tsx`
    - 기능
      - 단계별 입력 UX(이메일 → 비밀번호 → 이름 → 생년월일 → 대학교)
      - 가입 후 이메일 인증 필요 안내

  - `/forgot-password` 비밀번호 재설정 요청
    - 파일: `src/pages/ForgotPasswordPage.tsx`
    - 기능
      - Supabase Auth의 비밀번호 재설정 이메일 발송
      - 재설정 링크는 `/reset-password`로 리다이렉트되도록 구성

  - `/reset-password` 비밀번호 재설정
    - 파일: `src/pages/ResetPasswordPage.tsx`
    - 기능
      - URL hash의 `access_token` 유무로 유효 링크를 판별
      - 비밀번호 변경 성공 시 3초 후 로그인 페이지로 이동

  ### 보호 페이지 (로그인 필요)

  아래 페이지들은 `PrivateRoute`로 감싸져 있으며, 로그인하지 않으면 `/login`으로 이동합니다.

  - `/history` 채점 히스토리 + 성적 추이
    - 파일: `src/pages/HistoryPage.tsx`
    - 기능
      - 서버 저장된 채점 기록 목록
      - “성적 추이” 그래프(`src/components/TrendChart.tsx`)
        - 표준점수: (언어이해 + 추리논증) **합산**
        - 백분위/정답률: 두 과목 **평균**
        - 같은 연도에 두 과목을 모두 채점한 경우에만 추이 그래프에 반영
        - 회독 필터(기본/1회독/2회독…)
        - 2020년 이전 시험이 있을 경우 보정값 토글 지원(참고용)
      - “상세 기록”
        - 같은 시점에 두 과목을 함께 채점한 기록은 `groupTimestamp` 기준으로 묶어 표시
        - 기록 삭제(그룹 내 timestamp 기반 삭제)

  - `/admission` 로스쿨 지원 가능성 분석 (입력)
    - 파일: `src/pages/AdmissionPage.tsx`
    - 기능
      - LEET(언어+추리 합산 표준점수)와 GPA(100점 만점)를 정수로 입력
      - 분석 결과를 `/admission-result`로 전달하며, 새로고침 대비해 `sessionStorage`에도 저장
    - 분석 로직
      - `src/utils/lawschool.ts`에 25개교 기준 점수/최저 점수/환산 배점이 정의되어 있습니다.
      - 단순 환산식: `(LEET * leetPerPoint) + (GPA * gpaPerPoint) + baseScore`

  - `/admission-result` 로스쿨 지원 가능성 분석 (결과)
    - 파일: `src/pages/AdmissionResultPage.tsx`
    - 기능
      - 적정/소신/불가로 분류하여 카드 리스트로 표시
      - “학교별 토익/TEPS 관련 정보” 패널 제공(`src/components/ToeicInfoDialog.tsx`)

  - `/mock-input` 사설 모의고사 성적 입력
    - 파일: `src/pages/MockExamInputPage.tsx`
    - 기능
      - 시험일(YYYY-MM-DD), 기관(프리셋/직접입력), 회차(선택)
      - 과목별 표준점수/백분위 입력(미응시 과목은 비워둘 수 있음)
      - 저장 성공 시 `/mock-history`로 이동
    - 참고
      - 홈의 배너는 “오픈 예정” UI로 노출될 수 있으나, 라우트 자체는 구현되어 있습니다.

  - `/mock-history` 사설 모의고사 히스토리 + 추이
    - 파일: `src/pages/MockHistoryPage.tsx`
    - 기능
      - 기관 필터 + 표준점수/백분위 추이 그래프(`src/components/MockTrendChart.tsx`)
      - 개별 기록 삭제 / 전체 삭제

  ## 서버(API) / 저장 구조

  ### Supabase Edge Function

  - Base URL: `https://<projectId>.supabase.co/functions/v1/make-server-cd835c22`
  - 구현: `supabase/functions/make-server-cd835c22/index.ts`
  - 저장소: `supabase/functions/make-server-cd835c22/kv_store.ts` (Postgres 테이블 `kv_store_cd835c22`)

  ### 주요 엔드포인트

  - `GET /history/:userId` 채점 히스토리 조회
  - `POST /history/:userId` 채점 결과 저장(서버가 `round`, `timestamp`를 부여)
  - `DELETE /history/:userId` 채점 히스토리 전체 삭제
  - `DELETE /history/:userId/:timestamp` 특정 기록 삭제
  - `GET /mock-history/:userId` 사설 모의고사 히스토리 조회
  - `POST /mock-history/:userId` 사설 기록 저장(서버가 `id`, `createdAt` 부여)
  - `DELETE /mock-history/:userId` 사설 히스토리 전체 삭제
  - `DELETE /mock-history/:userId/:id` 사설 기록 삭제

  ### 저장 키 규칙

  - 채점 기록: `history:<userId>`
  - 사설 기록: `mock_history:<userId>`

  ## PWA / 오프라인

  - Service Worker 등록: `src/main.tsx`
  - 설치 버튼 및 iOS 가이드: `src/components/PWAInstallButton.tsx`
  - manifest/sw 파일: `src/public/manifest.json`, `src/public/sw.js` (또는 빌드 산출물의 `/manifest.json`, `/sw.js`)

  ### 주요 기능

  - 채점 및 결과 요약/표시
  - 성적 히스토리 저장/조회/삭제
  - 모의고사 성적 입력 및 추이 차트
  - (선택) PWA 설치/오프라인 캐시 (manifest/service worker 포함)

  ## Tech Stack

  - Frontend: React + Vite (SWC)
  - UI: Radix UI, Tailwind CSS 계열 유틸
  - Charts: Recharts
  - Auth/Data: Supabase
  - Edge Functions: Supabase Edge Functions (Deno)
  - Deploy: Vercel (설정 파일: `vercel.json`)

  ## Project Structure

  - `src/pages`: 라우팅 페이지
  - `src/components`: 재사용 컴포넌트
  - `src/contexts`: 전역 컨텍스트(예: 인증)
  - `src/utils`: 로직/데이터/외부 연동 유틸
  - `supabase/functions`: Supabase Edge Functions (Deno 런타임)
  - `build/`: Vite 빌드 산출물(outDir)

  ## Scripts

  - `npm run dev`: 로컬 개발 서버 실행 (기본 3000 포트)
  - `npm run build`: 프로덕션 빌드 생성 (결과는 `build/`)

  ## 환경 변수 / 설정

  이 프로젝트는 Supabase 설정 정보를 코드로 포함하거나(자동 생성 파일) 환경 변수로 주입할 수 있습니다.
  현재 구성은 `src/utils/supabase/info.tsx` 파일을 사용합니다.

  - `src/utils/supabase/info.tsx`는 자동 생성 파일이며(상단 주석 참고) 직접 수정하지 않는 것을 권장합니다.
  - Supabase URL/Key를 환경 변수로 분리하려면, 이후 `VITE_...` 형태로 옮겨서 사용하는 방식으로 리팩터링할 수 있습니다.

  ## Supabase Edge Functions (Deno)

  `supabase/functions` 및 `src/supabase/functions` 아래 코드는 Deno 런타임을 전제로 작성되어 있습니다.
  VS Code에서 타입 오류(예: `Deno` 전역, `npm:`/`jsr:` import)가 보인다면 Deno 확장 설치가 필요합니다.

  - 권장 확장: `Deno (denoland.vscode-deno)`
  - 이 저장소는 프론트(Vite/React)와 공존하므로, 워크스페이스 전체가 아니라 functions 경로에만 Deno를 활성화하는 구성을 권장합니다.

  ## Deployment

  - Vercel 배포 기준으로 `npm run build` 결과를 사용합니다.
  - 로컬에서 빌드 확인: `npm run build`

  ## Troubleshooting

  - 타입/JSX 관련 빨간줄이 많을 때: `npm i` 후에도 남으면 `typescript`, `@types/react`, `@types/react-dom` 설치 여부를 확인하세요.
  - Supabase functions에서만 타입 오류가 뜰 때: Deno 확장을 설치하고 functions 폴더에만 Deno를 활성화하세요.
