import { describe, expect, it } from "vitest";
import { isNaverInAppBrowser } from "./naverBrowser";

describe("네이버앱 브라우저 감지", () => {
  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) AppleWebKit/605.1.15 NAVER(inapp; search; 620; 10.10.2; XR)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1 NAVER (inapp; search; 550; 8.2.0; 7PLUS)",
    "Mozilla/5.0 (Linux; Android 14; wv) Mobile Safari/537.36 NAVER (higgs; search; 550; 8.2.0; 20.50.533.26)",
    "Mozilla/5.0 (iPad) naver(inapp; search; 620; 10.10.2)",
  ])("공식 표식은 Safari 토큰·공백·기기와 관계없이 감지한다: %s", (ua) => {
    expect(isNaverInAppBrowser(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (iPhone) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh) Whale/3.28.266.14 Safari/537.36",
    "Yeti/1.1 (+http://help.naver.com/robots/)",
    "",
  ])("일반 브라우저·웨일·검색봇을 네이버앱으로 오인하지 않는다: %s", (ua) => {
    expect(isNaverInAppBrowser(ua)).toBe(false);
  });
});
