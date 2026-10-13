export const PUSH_PERMISSION_HISTORY_KEY = "all-leet:push-permission-granted:v1";

export function hasPushPermissionHistory(): boolean {
  try {
    return window.localStorage.getItem(PUSH_PERMISSION_HISTORY_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberPushPermissionGranted(): void {
  try {
    if (!hasPushPermissionHistory()) {
      window.localStorage.setItem(PUSH_PERMISSION_HISTORY_KEY, "1");
    }
  } catch {
    // 저장소가 차단되어도 권한 허용과 실제 구독 등록은 계속한다.
  }
}
