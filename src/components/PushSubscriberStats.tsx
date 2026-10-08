import { useEffect, useState } from "react";
import type { PushSubscriberStatistics } from "../types/push";
import { PushApiError, pushRequest } from "../utils/pushApi";

type State =
  | { status: "loading" }
  | { status: "ready"; data: PushSubscriberStatistics }
  | { status: "error" };
const metrics = [
  ["members", "알림 구독 회원", "명"],
  ["devices", "전체 구독 기기", "개"],
  ["memberDevices", "회원 연결 기기", "개"],
  ["anonymousDevices", "비회원 기기", "개"],
] as const;

function statistics(value: unknown): PushSubscriberStatistics {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_STATISTICS");
  }
  const data = value as PushSubscriberStatistics;
  if (
    metrics.some(([key]) =>
      !Number.isSafeInteger(data[key]) || data[key] < 0
    ) ||
    data.devices !== data.memberDevices + data.anonymousDevices ||
    data.members > data.memberDevices ||
    typeof data.queriedAt !== "string" ||
    !Number.isFinite(Date.parse(data.queriedAt))
  ) throw new Error("INVALID_STATISTICS");
  return data;
}

export function PushSubscriberStats({ actorId, enabled, onDenied }: {
  actorId?: string;
  enabled: boolean;
  onDenied: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !actorId) return;
    const controller = new AbortController();
    void pushRequest<unknown>(
      "admin-push",
      "statistics",
      {},
      controller.signal,
      actorId,
    )
      .then(statistics)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("push statistics", {
          code: error instanceof PushApiError ? error.code : "REQUEST_FAILED",
        });
        if (
          error instanceof PushApiError && [401, 403].includes(error.status)
        ) {
          onDenied();
        } else setState({ status: "error" });
      });
    return () => controller.abort();
  }, [actorId, enabled, revision, onDenied]);
  const loading = enabled && !!actorId && state.status === "loading";
  const data = enabled && state.status === "ready" ? state.data : null;
  return (
    <section
      className="push-panel push-statistics"
      aria-label="푸시 구독 현황"
      aria-busy={loading}
    >
      <div className="push-statistics-heading">
        <h2>푸시 구독 현황</h2>
        <button
          type="button"
          disabled={!enabled || !actorId || loading}
          onClick={() => {
            setState({ status: "loading" });
            setRevision((value) => value + 1);
          }}
        >
          통계 새로고침
        </button>
      </div>
      <dl className="push-statistics-grid">
        {metrics.map(([key, label, unit]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {data ? `${data[key].toLocaleString("ko-KR")}${unit}` : "—"}
            </dd>
          </div>
        ))}
      </dl>
      {loading && <p role="status">구독 현황을 불러오는 중입니다.</p>}
      {enabled && state.status === "error" && (
        <p className="push-error" role="alert">
          구독 현황을 불러오지 못했습니다. 통계 새로고침으로 다시 확인해주세요.
        </p>
      )}
      {!enabled && (
        <p className="push-small">
          현재 환경에서는 구독 통계를 조회하지 않습니다.
        </p>
      )}
      {data && (
        <p className="push-small">
          조회 시각: {new Date(data.queriedAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })} (한국 시간)
        </p>
      )}
      <p className="push-small">
        알림 등록이 완료된 구독 기준입니다. 회원은 중복을 제외하며, 비회원은
        기기 수만 집계합니다. 같은 기기도 브라우저·설치 앱마다 별도로
        계산합니다. 해지·만료·탈퇴 계정의 구독은 제외합니다.
      </p>
    </section>
  );
}
