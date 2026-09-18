# 서비스 버전 관리

## 기준

서비스 버전은 `package.json`의 `version`을 단일 기준으로 사용한다. `package-lock.json`의 루트 패키지 버전은 반드시 이에 일치해야 한다. 현재 기준 버전은 `1.3.0`이다.

버전은 [Semantic Versioning 2.0.0](https://semver.org/lang/ko/)의 `MAJOR.MINOR.PATCH` 형식을 따른다. 한 번 실서비스에 배포된 버전 번호는 다시 사용하거나 낮추지 않는다.

| 변경 종류 | 올릴 자리 | 예시 | 적용 기준 |
|---|---:|---:|---|
| 호환되지 않는 변경 | MAJOR | `1.0.0` → `2.0.0` | 기존 사용자 흐름, 공개 URL, 저장 데이터 해석 또는 외부 연동을 깨는 변경 |
| 이전 버전과 호환되는 기능 추가 | MINOR | `1.0.0` → `1.1.0` | 새 사용자 기능, 새 관리 기능, 기존 동작을 유지하는 화면·API 확장 |
| 버그 수정·문서·내부 개선 | PATCH | `1.0.0` → `1.0.1` | 동작 호환성을 유지하는 수정, 성능·접근성·UI 개선 |

판단이 불확실하면 사용자 영향이 적은 `PATCH`로 시작하되, 기존 데이터나 주요 흐름의 호환성이 바뀌면 반드시 `MINOR` 또는 `MAJOR`를 선택한다.

## 배포 절차

`main` push가 Vercel 실서비스 배포를 시작한다. 따라서 **배포를 일으키는 모든 `main` push에는 새 서비스 버전이 포함되어야 한다.** 버전 변경만 별도로 먼저 push하지 않고, 배포할 기능·수정과 같은 커밋 또는 PR에 포함한다.

1. 변경 영향에 맞는 버전 명령 하나를 실행한다.

   ```bash
   npm run release:patch
   # 또는 npm run release:minor / npm run release:major
   ```

   이 명령은 Git 태그나 커밋을 만들지 않고 `package.json`, `package-lock.json`만 갱신한다.

2. `npm run version:verify`로 두 파일의 버전 일치와 SemVer 형식을 확인한다.
3. `npm run check`와 관련 읽기 전용 화면 검증을 실행한다.
4. 변경 사항에 버전 파일을 포함해 커밋하고, 배포 의도가 확인된 경우에만 `main`으로 push한다.
5. Vercel 배포 성공과 실서비스 응답을 확인한 뒤, 배포된 버전과 커밋을 작업 기록 또는 릴리스 노트에 남긴다.

운영 환경에 대한 긴급 수정도 예외가 아니다. 배포가 필요하면 최소 `PATCH`를 올린다. 배포하지 않는 로컬 실험이나 PR 초안에는 버전을 올리지 않는다.

## 검증 명령

| 명령 | 역할 |
|---|---|
| `npm run version:verify` | `package.json`·`package-lock.json`의 서비스 버전 일치와 SemVer 형식 검사 |
| `npm run release:patch` | PATCH 버전 증가 |
| `npm run release:minor` | MINOR 버전 증가 및 PATCH 초기화 |
| `npm run release:major` | MAJOR 버전 증가 및 MINOR/PATCH 초기화 |

`release:*` 명령은 작업 트리가 깨끗하지 않으면 npm이 중단할 수 있다. 다른 작업의 변경 사항을 보존하기 위한 안전장치이므로, 해당 변경을 먼저 정리하거나 별도 작업 트리에서 릴리스를 준비한다.

## v1.3.0 변경 내역

v1.3.0은 기출문제 탭에 09예비~2027학년도 워터마크 PDF 78개의 열기·다운로드를 등록한다. 모든 문제지는 Supabase 공개 Storage에서 제공하며, 출처 링크와 HWP 안내는 제거한다. 학년도·과목·문형 선택, 문제지·정답표·환산표 카드의 디자인을 통일하고 PDF 제공 및 법학전문대학원협의회 저작권 안내를 넣는다. 2027학년도는 단일 문형으로 표시하고 없는 정답·환산표는 준비 중으로 안내한다.

워터마크 PDF의 업로드·검증 기록과 공개 파일 목록은 버전 관리하며, 대용량 원본 및 가공 PDF는 로컬 보관 영역에 유지하고 웹 빌드에서 제외한다. [Storage 문서](past-exam-storage.md)에 공개 경로와 검증 내역을 기록한다.

릴리스 전 `npm run version:verify` 및 `npm run check`를 통과했다. 단위 테스트 111개, 화면 테스트 31개, lint·타입 검사·빌드를 확인했다.
