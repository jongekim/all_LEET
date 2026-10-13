/** NAVER 공식 inapp/higgs 표식만 확인한다. Safari 토큰도 포함될 수 있다. */
export function isNaverInAppBrowser(userAgent: string): boolean {
  return /\bNAVER\s*\(\s*(?:inapp|higgs)\s*;/i.test(userAgent);
}
