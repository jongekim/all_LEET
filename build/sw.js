// Service Worker for PWA
// 목표: "웹앱처럼" 동작 (항상 네트워크 우선 / 캐시로 인해 업데이트가 막히지 않게)

// 설치 시 즉시 대기(skip) 없이 활성화되도록
self.addEventListener('install', () => {
  self.skipWaiting();
});

// 활성화 시 즉시 클라이언트 점유 + (기존에 남아있을 수 있는) 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
    ])
  );
});

// fetch 핸들러를 두지 않아서: 네트워크 동작은 브라우저 기본값(웹앱처럼)으로 유지
