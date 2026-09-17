# 제3자 소프트웨어 고지

all_LEET은 제3자 오픈소스 소프트웨어를 사용합니다. 해당 소프트웨어의 저작권은 각 권리자에게 귀속되며 각 라이선스가 적용됩니다. all_LEET의 자체 저작권 문구는 제3자 라이선스가 부여하는 권리를 제한하지 않습니다. 이 문서는 all_LEET 자체 코드에 새로운 오픈소스 라이선스를 부여하지 않습니다.

- [운영 의존성의 라이선스·저작권·면책 원문](./src/public/third-party-notices.txt)
- [복사된 UI·CSS의 출처](./src/Attributions.md)
- [전체 의존성의 버전·라이선스 근거 목록](./docs/licenses/dependency-inventory.md)
- [개발 의존성 고지 근거](./docs/licenses/development-notices.txt)
- [준수 관리 및 미완료 사항](./docs/open-source-compliance.md)

`src/public/third-party-notices.txt`는 기존 Vite 설정에 따라 다음 빌드에서 `/third-party-notices.txt`로 복사됩니다. 현재 운영 사이트에 이미 제공된다는 뜻은 아니며 명시적인 배포와 응답 확인이 필요합니다.

## Vercel Analytics 소스 취득

사용 버전 `@vercel/analytics` 1.6.1은 [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/)입니다. 해당 버전의 [원본 소스](https://github.com/vercel/analytics/tree/0028584e514ba508911b9b64bb691616ae63b2e6/packages/web) 및 [소스 아카이브](https://github.com/vercel/analytics/archive/0028584e514ba508911b9b64bb691616ae63b2e6.tar.gz)는 무료로 취득할 수 있습니다. 설치된 React 진입점의 구현 소스와 위 커밋의 내용 일치를 확인했습니다. 라이브러리를 수정하면 해당 수정본 소스의 제공과 고지 갱신이 필요합니다.

기준일: 2026-09-17 · 앱 버전: 1.1.3
