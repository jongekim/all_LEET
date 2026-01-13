
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";

  if ('serviceWorker' in navigator) {
    let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
    let lastUpdateCheckAt = 0;

    const ensureRegistration = () => {
      if (!registrationPromise) {
        registrationPromise = navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      }
      return registrationPromise;
    };

    const checkForSwUpdate = async () => {
      const now = Date.now();
      // 너무 자주 호출되면 의미 없고, iOS/안드로이드 복귀 시 이벤트가 중복으로 올 수 있어 throttle
      if (now - lastUpdateCheckAt < 10_000) return;
      lastUpdateCheckAt = now;

      try {
        const registration = await ensureRegistration();
        await registration.update();
      } catch (error) {
        console.log('❌ Service Worker update check failed:', error);
      }
    };

    window.addEventListener('load', () => {
      checkForSwUpdate();

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    });

    // 백그라운드 → 전면 복귀 시점에도 업데이트 체크
    window.addEventListener('pageshow', () => {
      checkForSwUpdate();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForSwUpdate();
      }
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
  