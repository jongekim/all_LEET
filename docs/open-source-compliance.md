# 오픈소스 라이선스 준수 관리

기준일: 2026-09-17 · 앱 버전: 1.1.3

## 현재 결론과 범위

현재 확인한 의존성은 상업적·비공개 서비스 운영이 가능한 라이선스다. MIT·ISC·BSD·Apache 구성 요소의 고지 보존과 MPL-2.0 구성 요소의 소스 취득 안내가 필요하다. 확인 범위에서 GPL·LGPL·AGPL은 발견되지 않았다. MPL을 사용하는 Analytics 때문에 자체 앱 전체를 공개해야 하는 것은 아니다.

분석 근거는 `package.json`, `package-lock.json`, 설치 패키지 원문, `src/Attributions.md`, 복사된 UI·CSS, 기존 `build/`, Vite public 디렉터리 설정이다. 운영 배포물, 외부 서비스가 제공하는 추적 스크립트, 개발 도구 바이너리의 전체 내장 의존성, 외부 시험 자료의 권리까지 검증한 것은 아니다. 원문 미수집 항목은 준수 완료로 간주하지 않는다.

## 관리 파일

| 파일 | 목적 | 배포 경계 |
|---|---|---|
| [`src/public/third-party-notices.txt`](../src/public/third-party-notices.txt) | 운영 의존성의 저작권·허락·면책 원문, 복사한 구성 요소, Analytics 소스 취득 안내 | 기존 Vite 설정으로 다음 빌드의 `/third-party-notices.txt`에 복사 |
| [`docs/licenses/dependency-inventory.md`](./licenses/dependency-inventory.md) | lockfile 항목 530개의 버전·구분·원문 근거 | 저장소 관리용, 일반 웹 빌드에는 포함되지 않음 |
| [`docs/licenses/development-notices.txt`](./licenses/development-notices.txt) | 개발 의존성 고지 근거, 미수집 상태 | 저장소 관리용, 개발 도구 재배포 시 추가 검토 |
| [`src/Attributions.md`](../src/Attributions.md) | 복사된 shadcn/ui와 Tailwind, 기존 Unsplash 기록 설명 | 저장소 관리용 |

운영 의존성 198개 항목을 넓게 포함했다. 타입 전용·서버용·미사용 UI·중복 설치 항목도 포함되므로 모든 항목이 브라우저에서 실행된다는 뜻은 아니다. 실제 배포에 들어가는 항목을 좁히려면 해당 빌드의 번들 분석이 필요하다. 차트 패키지 `victory-vendor` 내부 D3 등의 개별 LICENSE도 보존한다.

고지문은 각 제3자 소프트웨어의 권리를 보존하기 위한 문서다. 자체 서비스 코드에 MIT 등 하나의 라이선스를 일괄 적용하는 루트 `LICENSE`는 추가하지 않는다. 패키지의 `private: true`도 제3자 고지 의무를 면제하지 않는다.

## 라이선스별 운영 기준

| 라이선스 | 적용 사례 | 관리 사항 |
|---|---|---|
| MIT | React, Radix UI, Recharts, Supabase JS, shadcn/ui, Tailwind | 배포되는 사본에 저작권과 허락문을 포함하고 원문의 면책문도 함께 유지 |
| ISC | Lucide, 일부 D3 의존성 | 해당 버전의 저작권·허락·면책 원문 유지; Lucide의 기존 Feather 권리자 고지를 생략하지 않음 |
| BSD-2/3-Clause | D3·React Transition Group 등의 간접 의존성 | 저작권·조건·면책문 유지; BSD-3-Clause 권리자·기여자 이름으로 무단 보증·홍보하지 않음 |
| Apache-2.0 | class-variance-authority 등 | 라이선스 사본 제공; 원본 NOTICE가 있으면 관련 고지 유지; 원본 파일을 수정하면 변경 사실 표시 |
| MPL-2.0 | @vercel/analytics 1.6.1 | 라이선스 안내와 해당 코드의 소스 취득 방법 제공; MPL 대상 소스를 수정하면 수정본도 제공 |
| CC-BY-4.0 | 개발 의존성 caniuse-lite | 데이터를 재배포한다면 출처·라이선스·변경 여부 등 표시; 단순 빌드 사용과 데이터 재배포를 구분 |

`AND`로 표시된 복합 라이선스는 두 조건을 함께 적용한다. 라이선스 이름이나 링크만 나열한 목록은 원문 고지를 대신하지 않는다. 원문을 한글 설명으로 대체하지 않으며, 압축 과정에 남은 일부 주석만으로 준수를 판정하지 않는다.

원문 근거: [MIT](https://opensource.org/license/mit), [BSD-3-Clause](https://opensource.org/license/bsd-3-clause), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/), [MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Vercel Analytics 소스 취득 안내

`src/App.tsx`는 `@vercel/analytics/react`를 사용한다. 설치 버전 1.6.1은 MPL-2.0이고 기존 빌드 JS에서도 동일한 버전 표식을 확인했다. Mozilla FAQ Q16·Q17은 브라우저로 전달되는 압축 JS를 실행 형태의 배포로 보며 소스 취득 방법 안내가 필요하다고 설명한다.

고지문에 다음 고정 소스를 안내한다.

- [1.6.1 소스 디렉터리](https://github.com/vercel/analytics/tree/0028584e514ba508911b9b64bb691616ae63b2e6/packages/web)
- [소스 전체 아카이브](https://github.com/vercel/analytics/archive/0028584e514ba508911b9b64bb691616ae63b2e6.tar.gz)
- [MPL-2.0 원문](https://www.mozilla.org/en-US/MPL/2.0/)

GitHub의 `1.6.1` 태그는 위 커밋을 가리키며 해당 커밋의 `packages/web/package.json` 버전도 1.6.1이다. 설치 패키지 `dist/react/index.mjs.map`에 담긴 구현 파일 `src/react/index.tsx`, `src/queue.ts`, `src/utils.ts`, `src/generic.ts`, `src/react/utils.ts` 5개를 해당 커밋의 원문과 대조해 모두 일치함을 확인했다. 이를 근거로 해당 React 진입점에 대해 원본 소스 링크를 제공한다. 자체 앱의 모든 소스를 해당 저장소와 대조한 것은 아니다.

추후 Analytics 파일을 직접 수정하거나 원본 코드 일부를 자체 파일에 복사하면 해당 MPL 대상 소스·수정본의 제공 범위를 다시 검토하고 고지를 갱신한다. 단순 사용·번들링 때문에 별도로 작성한 자체 코드 전체가 MPL로 바뀌는 것은 아니다. 외부 서비스가 동적으로 전달하는 수집 스크립트의 이용조건은 별도 검토 대상이다.

## 복사된 구성 요소 및 외부 자료

### shadcn/ui·Tailwind

shadcn/ui의 컴포넌트가 `src/components/ui/`에 복사되어 있다. npm 목록에 없더라도 MIT 원문과 `Copyright (c) 2023 shadcn` 고지가 필요하다. 원본 복사 리비전은 기록이 없어 특정 버전으로 추정하지 않는다. [상위 저장소 원문](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)을 고지문과 Attributions에 수록한다.

`src/index.css` 헤더는 Tailwind CSS 4.1.3을 명시한다. [v4.1.3 원문](https://github.com/tailwindlabs/tailwindcss/blob/v4.1.3/LICENSE)과 `Copyright (c) Tailwind Labs, Inc.`를 고지문에 수록한다. 복사된 코드·생성된 CSS는 lockfile 검사 외에 별도로 확인한다.

### Unsplash·폰트·이미지

기존 Attributions에는 Unsplash 사진 사용 기록이 있지만 현재 저장소의 앱 코드·정적 파일에서 해당 사진이나 URL을 식별하지 못했다. 이 기록을 현재 사용·허가 확인으로 간주하지 않는다. 추후 사진을 추가하면 개별 사진 출처·취득일·적용 라이선스·수정 여부를 기록한다. [일반 Unsplash 라이선스](https://unsplash.com/license)는 Unsplash+ 등 다른 계약을 대신하지 않는다.

현재 CSS는 시스템 폰트 목록을 사용하며 별도 폰트 파일·원격 웹폰트를 확인하지 못했다. 새로운 폰트·아이콘·이미지를 도입하면 해당 파일의 라이선스와 출처를 등록한다. 이미 존재하는 사용자 업로드 파일 전체의 권리를 이 검토가 확인한 것은 아니다.

### LEET 자료

문제지·정답·점수 환산표·학교별 자료는 오픈소스 코드와 권리 검토를 구분한다. 공식 사이트에서 내려받을 수 있다는 사실만으로 재게시 허가가 확인되는 것은 아니다. 현재 `PAST_EXAM_DOCUMENTS`는 비어 있다. PDF 추가 전에는 [기출문제 추가 절차](./past-exams.md)에 따라 출처·재게시 가능 여부를 확인한다.

외부 자료의 관리 기록은 아래 양식을 사용한다. 빈칸은 허가 확인으로 해석하지 않는다.

| 자료/파일 | 원문 출처 | 취득일 | 권리자 | 이용조건/허가 근거 | 수정 여부 | 재게시 확인 상태 |
|---|---|---|---|---|---|---|
| 신규 자료 등록 시 작성 | 원문 URL | YYYY-MM-DD | 확인한 권리자 | 원문/허가 기록 | 구체적인 변경 | 확인 전/확인 완료 |

## 문서만으로 진행한 사항과 후속 사항

| 항목 | 현재 상태 | 완료 조건 |
|---|---|---|
| 운영 의존성 및 복사된 구성 요소의 고지 원문 | 문서 작성 완료 | 이후 버전·의존성 변경 시 갱신 |
| Analytics 1.6.1 소스 취득 안내 | 고정 커밋 안내 작성 및 React 구현 대조 완료 | 배포 고지에 포함하고 링크 유지 |
| Vite 배포용 텍스트 위치 | `src/public/third-party-notices.txt` 추가 | 다음 명시적 배포 후 실제 URL 응답 확인 |
| 기존 운영 사이트의 고지 | 이번 작업으로 운영 상태를 변경하지 않음 | 배포 후 고지 파일 제공 확인 |
| 사이트 하단에서 고지 파일 접근 | 앱 코드 변경이 필요하므로 미적용 | `/third-party-notices.txt`로 연결하는 링크 추가 권장 |
| 홈 저작권 문구·약관의 제3자 예외 | 아래 문안 준비, 화면에는 미적용 | HomePage·TermsPage 수정 및 배포 |
| 개발 도구의 미수집 고지 | 목록과 제한 사항 기록 | 원본/바이너리 재배포 전 별도 확보·내장 의존성 검토 |
| Edge Function의 정확한 운영 의존성 | 소스 import 경계만 기록 | 실제 Deno 해석 버전과 운영 배포물 읽기 전용 확인 |
| 외부 시험 자료·사진의 권리 | 확인 기준과 양식 준비 | 개별 자료의 출처·허가 확인 |

텍스트 고지에 제3자 권리 예외를 명시했으나 현재 화면의 포괄적인 권리 문구를 직접 수정하지는 않았다. 문서 추가만으로 기존 운영 배포물과 화면까지 준수가 완료됐다고 판정하지 않는다.

### 홈 저작권 문구 변경안

> Copyright © all LEET. 자체 제작 콘텐츠의 무단 복제·배포는 금지합니다. 제3자 오픈소스 소프트웨어 및 외부 자료에는 각 권리자의 라이선스와 이용조건이 적용됩니다. 오픈소스 고지: /third-party-notices.txt

### 약관 제16조 변경안

> 회사가 직접 제작한 서비스 및 콘텐츠에 대한 저작권 등 지식재산권은 회사에 귀속됩니다. 제3자 오픈소스 소프트웨어 및 외부 자료의 권리는 각 권리자에게 귀속되며, 해당 부분에는 각 라이선스와 이용조건이 적용됩니다. 이용자는 회사의 사전 승낙 없이 자체 제작 콘텐츠를 복제·전송·배포할 수 없습니다. 다만 법령 또는 제3자 라이선스가 허용하는 이용은 해당 조건에 따릅니다. 오픈소스 소프트웨어의 고지는 /third-party-notices.txt에서 확인할 수 있습니다.

기존 이용자의 입력 데이터 권리 및 개인정보 관련 문장은 별도로 유지·검토한다. 위 문안은 후속 화면 변경을 위한 초안이며 이번 작업에서 기존 약관을 개정한 것은 아니다.

## 갱신 및 배포 검증 절차

1. 의존성을 추가·삭제·갱신하거나 복사한 코드·이미지·폰트를 바꾸면 inventory와 원문 고지를 같은 변경에서 갱신한다. package.json의 범위 문자열 대신 lockfile의 실제 버전을 사용한다.
2. 동봉 LICENSE·NOTICE와 내부 vendored 파일을 우선 수집한다. 원문이 없으면 동일 저장소의 공유 원문 또는 해당 버전의 상위 원문을 확인하고 수집 근거를 기록한다. 권리자·연도를 임의로 만들지 않는다.
3. 개발 의존성과 배포되는 코드·데이터를 구분한다. 개발 의존성이라도 Vite 등 도구가 배포물에 내장하는 코드의 고지를 놓치지 않는다. 개발 도구 자체를 전달한다면 바이너리 내장 의존성까지 별도로 검토한다.
4. `@jsr/supabase__supabase-js`와 `@jsr/supabase__functions-js`는 메타데이터에 라이선스가 없지만 설치된 LICENSE에서 MIT를 확인했다. 향후 버전에도 자동으로 동일하다고 가정하지 않는다.
5. 등록된 Edge Function은 `npm:hono`와 `jsr:@supabase/supabase-js@2.49.8`를 import한다. 특히 버전이 없는 npm import를 프론트 lockfile 버전으로 대신 판정하지 않는다. 서버에서만 실행되고 사용자에게 코드 사본을 전달하지 않는 경계와 원본·컨테이너를 외부에 전달하는 경계를 구분한다.
6. 임시 outDir로 빌드하여 고지 파일이 바이트 단위로 동일하게 복사되는지 확인한다. 예: `npm run build -- --outDir /tmp/all-leet-license-review-build`. 이 확인만으로 일반 품질 게이트를 통과한 것은 아니다.
7. 배포를 요청받은 경우 [버전·배포 절차](./versioning.md)와 `npm run check`를 수행한다. 이번 문서 작업을 배포 권한으로 해석하지 않는다.
8. 배포 후 `/third-party-notices.txt`가 `200` 및 텍스트 본문으로 응답하는지, SPA HTML fallback이 아닌지, Analytics 소스 링크가 유효한지 확인한다. 사이트에서 고지를 발견할 수 있는 경로도 확인한다.

## 초기 문서 검증 기록

- lockfile 530개 항목을 inventory에 수록했다: 운영 198개, 개발 332개.
- 운영 항목 모두에 동봉 원문 또는 명시된 공유·상위 저장소 원문을 수록했다. 실제 번들에서 사용하지 않는 항목도 포함한다.
- 패키지의 라이선스·NOTICE 원문은 수집한 텍스트 그대로 수록하며 출처를 표시했다. 개발 도구의 일부 원문 미수집 항목은 inventory의 마지막 절에 공개한다.
- Analytics React 소스맵 구현 5개와 고정 소스 커밋의 파일 내용을 대조했다.
- 임시 빌드의 고지 파일 복사 및 문서 링크 검증 결과는 아래 최종 검증 기록에 남긴다.

### 최종 검증 기록

아래 빌드·파일 복사 검증은 문서 초안의 앱 버전 1.1.2 시점에 수행했다. 이후 사용자의 커밋·push 요청에 따라 배포 버전 메타데이터만 1.1.3으로 갱신하고 inventory 및 고지문에 새 버전·lockfile 해시를 반영했다. 의존성 버전과 앱 코드는 그대로이며 사용자 요청에 따라 추가 품질 검증은 생략한다. 아래 고지 파일 크기·해시는 검증 당시 초안의 값이다.

- 2026-09-17: `git diff --check` 통과.
- 운영 198개·개발 332개 항목의 수록 여부와 수집한 원문 텍스트의 보존을 대조해 통과. inventory의 lockfile 행 530개 및 내부 Markdown 파일 링크의 존재를 확인했다.
- `npm run build -- --outDir /tmp/all-leet-license-review-build` 성공. 프로젝트의 기존 `build/`를 덮어쓰지 않았다. 빌드에는 큰 JS 청크에 대한 경고가 있으며 이번 문서 추가는 청크 구성 변경을 포함하지 않는다.
- 임시 빌드의 `third-party-notices.txt`가 원본과 바이트 단위로 동일함을 확인했다: 335,894 bytes, SHA-256 `de5600aab1a441d733f9431968164e45c21d7f824b2ca4ee985ef3a4bf7f28d1`.
- 원문 미수집 항목 10개는 개발 의존성이다: SWC의 `Apache-2.0 AND MIT` 플랫폼 항목 9개 및 `stackback` 0.0.2. SWC 상위 Apache 원문은 다른 SWC 항목에 보존했지만 복합 라이선스의 MIT 대상 고지와 바이너리 내장 의존성 전체를 확보했다고 주장하지 않는다. 해당 도구 자체를 외부에 전달하기 전 추가 확인이 필요하다.
- 문서 초안 작성 시 앱 코드·설정·package.json·lockfile·기존 build 파일을 변경하지 않았다. 이후 배포 준비에서 package.json·lockfile의 루트 버전만 1.1.3으로 갱신했다. 전체 `npm run check`와 운영 URL 응답 검증은 실행하지 않았다.
