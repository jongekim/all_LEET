import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../contexts/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { usePushSubscription } from "../hooks/usePushSubscription";
import {
  composition,
  contentKey,
  PushApiError,
  type PushComposition,
  pushEnabled,
  pushErrorMessage,
  pushRequest,
  safePath,
} from "../utils/pushApi";
import { installationProof } from "../utils/pushInstallation";
import "../styles/admin.css";
import "../styles/push.css";
type Member = {
  id: string;
  name: string;
  email: string;
  subscriptions: number;
};
type Draft = {
  id: string;
  title: string;
  revision: number;
  savedAt?: string;
  lastCampaignId?: string;
};
type Campaign = {
  id: string;
  kind: string;
  title: string;
  body: string;
  path: string;
  audience: string;
  state: string;
  revision: number;
  count: number;
  candidateCount: number;
  excludedBefore: number;
  counts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
type Preview = {
  id: string;
  previewToken: string;
  count: number;
  members: number;
  anonymous: number;
  expiresAt: string;
  duplicates: Array<
    { id: string; createdAt: string; state: string; overlap: number }
  >;
  duplicateDigest: string;
};
const empty: PushComposition = {
  title: "",
  body: "",
  path: "/",
  audience: "all",
  members: [],
};
const audiences = {
  all: "전체 구독자 · 비로그인 포함",
  members: "전체 회원의 구독 기기",
  selected: "선택 회원의 구독 기기",
};
export function AdminPushPage() {
  const [denied, setDenied] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="푸시 알림"
        description="동의한 기기로 운영 안내를 작성·발송합니다."
      />
      <main className="admin-shell">
        <div className="admin-container">
          {denied
            ? (
              <p role="alert">
                관리자 권한이 변경되었습니다. 다시 로그인해 권한을 확인해주세요.
              </p>
            )
            : <PushEditor onDenied={() => setDenied(true)} />}
        </div>
      </main>
    </div>
  );
}
function PushEditor({ onDenied }: { onDenied: () => void }) {
  const [tab, setTab] = useState<"compose" | "drafts" | "history">("compose"),
    [input, setInput] = useState<PushComposition>(empty),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ id: string; revision: number } | null>(
      null,
    ),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [draftBefore, setDraftBefore] = useState<string | undefined>();
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [searchAfter, setSearchAfter] = useState<string | undefined>();
  const [preview, setPreview] = useState<Preview | null>(null),
    [duplicateAck, setDuplicateAck] = useState(false),
    [test, setTest] = useState<
      { id: string; key: string; accepted: boolean; confirmed: boolean } | null
    >(null);
  const [history, setHistory] = useState<Campaign[]>([]),
    [historyBefore, setHistoryBefore] = useState<string | undefined>(),
    [historySince, setHistorySince] = useState("");
  const [uncertain, setUncertain] = useState<
    {
      id: string;
      requestId: string;
      payload: Record<string, unknown>;
      action: "test" | "campaigns" | "draft-save";
    } | null
  >(null);
  const generation = useRef(0), mounted = useRef(true);
  const { currentUser } = useAuth();
  const actorId = currentUser?.id;
  const push = usePushSubscription(), enabled = pushEnabled();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const handleError = useCallback((e: unknown) => {
    console.warn("push", {
      code: e instanceof PushApiError ? e.code : "REQUEST_FAILED",
    });
    if (e instanceof PushApiError && e.status > 0 && e.status < 500) {
      setUncertain(null);
    }
    if (e instanceof PushApiError && [401, 403].includes(e.status)) {
      onDenied();
      return;
    }
    if (mounted.current) {
      setError(
        pushErrorMessage(e),
      );
    }
  }, [onDenied]);
  const request = useCallback(
    async <T,>(action: string, args: unknown): Promise<T> =>
      pushRequest<T>("admin-push", action, args, undefined, actorId),
    [actorId],
  );
  function change(patch: Partial<PushComposition>) {
    const next = { ...input, ...patch };
    setInput(next);
    setPreview(null);
    setDuplicateAck(false);
    setError("");
    setNotice("");
    generation.current++;
    if (contentKey(next) !== contentKey(input)) setTest(null);
  }
  async function work(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      handleError(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function membersPage(append = false) {
    const epoch = generation.current;
    const result = await request<{ items: Member[] }>("members", {
      search,
      after: append ? searchAfter : undefined,
    });
    if (!mounted.current || epoch !== generation.current) return;
    setMemberNames((old) => ({
      ...old,
      ...Object.fromEntries(result.items.map((m) => [m.id, m.name || m.email])),
    }));
    setMembers((old) => append ? [...old, ...result.items] : result.items);
    setSearchAfter(
      result.items.length === 50 ? result.items.at(-1)?.id : undefined,
    );
  }
  async function draftsPage(append = false) {
    const result = await request<{ items: Draft[] }>("draft-list", {
      before: append ? draftBefore : undefined,
    });
    if (!mounted.current) return;
    setDrafts((old) => append ? [...old, ...result.items] : result.items);
    setDraftBefore(
      result.items.length === 50 ? result.items.at(-1)?.savedAt : undefined,
    );
  }
  const historyPage = useCallback(async (append = false) => {
    const result = await request<{ items: Campaign[] }>("campaign-history", {
      before: append ? historyBefore : undefined,
      since: historySince
        ? new Date(historySince).toISOString()
        : new Date(Date.now() - 90 * 86400000).toISOString(),
    });
    if (!mounted.current) return;
    setHistory((old) => append ? [...old, ...result.items] : result.items);
    setHistoryBefore(
      result.items.length === 50 ? result.items.at(-1)?.createdAt : undefined,
    );
  }, [request, historyBefore, historySince]);
  useEffect(() => {
    if (tab !== "history" || !enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void Promise.all(
          history.filter((c) =>
            ["queued", "processing", "stopping"].includes(c.state)
          ).map((c) => request<Campaign>("campaign-status", { id: c.id })),
        ).then((updated) => {
          if (mounted.current) {
            setHistory((old) =>
              old.map((c) => updated.find((x) => x.id === c.id) || c)
            );
          }
        }).catch(handleError);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [tab, enabled, history, request, handleError]);
  useEffect(() => {
    if (!test || test.accepted || !enabled) return;
    const id = test.id;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void request<Campaign>("campaign-status", { id }).then((result) => {
        if (!mounted.current) return;
        if (result.counts.accepted === 1) {
          setTest((old) => old?.id === id ? { ...old, accepted: true } : old);
        } else if (["completed", "stopped"].includes(result.state)) {
          setTest((old) => old?.id === id ? null : old);
          setError(
            "테스트 접수 결과를 확인하지 못했습니다. 새 테스트가 필요합니다.",
          );
        }
      }).catch(handleError);
    }, 2000);
    return () => clearInterval(timer);
  }, [test, enabled, request, handleError]);
  async function sendTest() {
    const content = {
      ...composition({ ...input, audience: "all", members: [] }),
    };
    await push.refresh();
    const proof = await installationProof(),
      id = crypto.randomUUID(),
      requestId = crypto.randomUUID();
    const payload = { id, requestId, content, ...proof };
    setUncertain({ id, requestId, payload, action: "test" });
    const epoch = generation.current;
    const result = await request<Campaign>("test", payload);
    if (epoch === generation.current && mounted.current) {
      setTest({
        id: result.id,
        key: contentKey(content),
        accepted: result.counts.accepted === 1,
        confirmed: false,
      });
    }
    setUncertain(null);
    setNotice(
      "현재 기기 테스트를 접수했습니다. 알림 표시와 클릭 이동을 확인해주세요.",
    );
  }
  async function confirmTest() {
    if (!test?.accepted) return;
    await request("test-confirm", {
      id: test.id,
      requestId: crypto.randomUUID(),
      content: { ...input, audience: "all", members: [] },
      ...await installationProof(),
      confirmed: true,
    });
    setTest({ ...test, confirmed: true });
    setNotice("현재 내용의 기기 확인을 기록했습니다.");
  }
  async function prepare() {
    const content = composition(input);
    if (content.audience !== "selected" && !test?.confirmed) {
      throw new Error("같은 내용의 기기 테스트·표시·이동 확인을 완료해주세요.");
    }
    let proof = {};
    try {
      proof = await installationProof();
    } catch {
      if (content.audience !== "selected") {
        throw new Error("현재 기기에서 알림 등록 확인을 완료해주세요.");
      }
    }
    const epoch = generation.current;
    const result = await request<Preview>("preview", {
      id: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      content,
      testId: test?.confirmed ? test.id : undefined,
      ...proof,
    });
    if (epoch === generation.current && mounted.current) {
      setPreview(result);
      setDuplicateAck(false);
    }
  }
  async function submit() {
    if (!preview) return;
    const id = crypto.randomUUID(),
      requestId = crypto.randomUUID(),
      payload = {
        id,
        requestId,
        content: composition(input),
        previewId: preview.id,
        previewToken: preview.previewToken,
        duplicateDigest: preview.duplicateDigest,
        duplicateConfirmed: duplicateAck,
        draftId: draft?.id,
      };
    setUncertain({ id, requestId, payload, action: "campaigns" });
    try {
      const result = await request<Campaign>("campaigns", payload);
      setUncertain(null);
      setPreview(null);
      setHistory((old) => [result, ...old]);
      setTab("history");
    } catch (e) {
      if (
        e instanceof PushApiError && e.code === "DUPLICATE_REQUIRED" &&
        e.details
      ) {
        setUncertain(null);
        setPreview({
          ...preview,
          duplicates: e.details.duplicates as Preview["duplicates"],
          duplicateDigest: String(e.details.duplicateDigest),
        });
        setDuplicateAck(false);
      } else setPreview(null);
      throw e;
    }
  }
  async function reconcile() {
    if (!uncertain || uncertain.action === "draft-save") return;
    const existing = await request<Campaign & { found?: boolean }>(
      "campaign-status",
      { idempotencyKey: uncertain.requestId },
    );
    if (existing.found === false) {
      setNotice(
        "기존 요청은 아직 확인되지 않았습니다. 같은 요청으로 다시 대조·접수할 수 있습니다.",
      );
      return;
    }
    if (uncertain.action === "test") {
      setTest({
        id: existing.id,
        key: contentKey(uncertain.payload.content as PushComposition),
        accepted: existing.counts.accepted === 1,
        confirmed: false,
      });
    } else {
      setHistory((old) => [
        existing,
        ...old.filter((c) => c.id !== existing.id),
      ]);
      setTab("history");
      setPreview(null);
    }
    setUncertain(null);
  }
  async function retryOriginal() {
    if (!uncertain) return;
    const result = await request<Campaign>(uncertain.action, uncertain.payload);
    if (uncertain.action === "test") {
      setTest({
        id: result.id,
        key: contentKey(uncertain.payload.content as PushComposition),
        accepted: result.counts.accepted === 1,
        confirmed: false,
      });
    } else if (uncertain.action === "draft-save") {
      setDraft({ id: result.id, revision: result.revision });
      setNotice("내 초안을 서버에 저장했습니다.");
    } else {
      setHistory((old) => [result, ...old]);
      setTab("history");
      setPreview(null);
    }
    setUncertain(null);
  }
  async function loadDraft(d: Draft) {
    if (
      (input.title || input.body) &&
      !window.confirm(
        "현재 미저장 입력을 이 초안으로 바꿀까요? 테스트는 다시 확인합니다.",
      )
    ) return;
    const result = await request<
      {
        id: string;
        revision: number;
        content: PushComposition;
        removedMembers: number;
      }
    >("draft-load", { id: d.id });
    setInput(result.content);
    setDraft({ id: result.id, revision: result.revision });
    setPreview(null);
    setTest(null);
    generation.current++;
    setTab("compose");
    setNotice(
      result.removedMembers
        ? `현재 유효하지 않은 회원 ${result.removedMembers}명을 선택에서 제외했습니다.`
        : "초안을 불러왔습니다. 대상과 테스트를 다시 확인해주세요.",
    );
  }
  const locked = busy || !enabled || !!uncertain;
  return (
    <>
      <div className="push-tabs" role="tablist" aria-label="푸시 관리">
        {(["compose", "drafts", "history"] as const).map((name) => (
          <button
            role="tab"
            key={name}
            aria-selected={tab === name}
            onClick={() => {
              setTab(name);
              if (enabled && name === "drafts") void work(() => draftsPage());
              if (enabled && name === "history") {
                void work(() => historyPage());
              }
            }}
          >
            {name === "compose"
              ? "새 발송"
              : name === "drafts"
              ? "초안"
              : "발송 이력"}
          </button>
        ))}
      </div>
      {!enabled && (
        <p className="push-notice">
          운영 알림 기능이 아직 활성화되지 않았습니다. 입력·화면을 확인할 수
          있으며 서버 저장·발송은 실행되지 않습니다.
        </p>
      )}
      {error && <p className="push-error" role="alert">{error}</p>}
      {notice && <p className="push-notice" role="status">{notice}</p>}
      {uncertain && (
        <div className="push-notice" role="status">
          <p>
            요청 결과를 확인 중입니다. 새 요청으로 자동 재발송하지 않습니다.
          </p>
          <div className="push-actions">
            {uncertain.action !== "draft-save" && (
              <button
                disabled={busy}
                onClick={() => void work(reconcile)}
              >
                기존 요청 접수 확인
              </button>
            )}
            <button disabled={busy} onClick={() => void work(retryOriginal)}>
              같은 요청으로 다시 접수
            </button>
          </div>
        </div>
      )}
      {tab === "compose" && (
        <div className="push-grid">
          <section className="push-panel">
            <h2>새 알림 작성</h2>
            <label>
              제목<input
                aria-label="제목"
                value={input.title}
                disabled={busy || !!uncertain}
                onChange={(e) => change({ title: e.target.value })}
              />
              <small>{[...input.title.trim()].length} / 50자</small>
            </label>
            <label>
              본문<textarea
                aria-label="본문"
                value={input.body}
                disabled={busy || !!uncertain}
                rows={3}
                onChange={(e) => change({ body: e.target.value })}
              />
              <small>{[...input.body.trim()].length} / 200자</small>
            </label>
            <label>
              이동 페이지 선택<select
                aria-label="이동 페이지 선택"
                value={["/", "/past-exams", "/community"].includes(input.path)
                  ? input.path
                  : "custom"}
                disabled={busy || !!uncertain}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    change({ path: e.target.value });
                  }
                }}
              >
                <option value="/">홈</option>
                <option value="/past-exams">기출문제</option>
                <option value="/community">커뮤니티</option>
                <option value="custom">직접 입력</option>
              </select>
            </label>
            <label>
              이동 주소<input
                aria-label="이동 주소"
                value={input.path}
                disabled={busy || !!uncertain}
                onChange={(e) => change({ path: e.target.value })}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                try {
                  window.open(
                    new URL(safePath(input.path), location.origin).href,
                    "_blank",
                    "noopener,noreferrer",
                  );
                } catch (e) {
                  handleError(e);
                }
              }}
            >
              이동 페이지 열기
            </button>
            <label>
              발송 대상<select
                aria-label="발송 대상"
                value={input.audience}
                disabled={busy || !!uncertain}
                onChange={(e) =>
                  change({
                    audience: e.target.value as PushComposition["audience"],
                    members: [],
                  })}
              >
                {Object.entries(audiences).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            {input.audience === "selected" && (
              <section>
                <label>
                  회원 이름·이메일 검색<input
                    aria-label="회원 검색"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSearchAfter(undefined);
                      generation.current++;
                    }}
                  />
                </label>
                <button
                  disabled={locked}
                  onClick={() => void work(() => membersPage())}
                >
                  회원 검색
                </button>
                <div className="push-member-list">
                  {members.map((m) => (
                    <label className="push-check" key={m.id}>
                      <input
                        type="checkbox"
                        checked={input.members.includes(m.id)}
                        disabled={busy || !!uncertain}
                        onChange={(e) =>
                          change({
                            members: e.target.checked
                              ? [...input.members, m.id]
                              : input.members.filter((id) => id !== m.id),
                          })}
                      />
                      <span>
                        {m.name || m.email} · 구독 {m.subscriptions}개
                      </span>
                    </label>
                  ))}
                </div>
                {searchAfter && (
                  <button
                    disabled={locked}
                    onClick={() => void work(() => membersPage(true))}
                  >
                    회원 더 보기
                  </button>
                )}
                <div className="push-member-list" aria-label="선택한 회원">
                  {input.members.map((id) => (
                    <div key={id}>
                      <span>{memberNames[id] || id}</span>
                      <button
                        disabled={locked}
                        onClick={() =>
                          change({
                            members: input.members.filter((value) =>
                              value !== id
                            ),
                          })}
                      >
                        선택 해제
                      </button>
                    </div>
                  ))}
                </div>
                <p className="push-small">
                  선택{" "}
                  {input.members.length}명 · 구독이 없는 회원은 발송 대상 기기가
                  없습니다.
                </p>
              </section>
            )}
            <div className="push-notice">
              {test?.confirmed
                ? "현재 내용 · 기기 확인 완료"
                : test?.accepted
                ? "현재 내용 · 푸시 서비스 접수. 기기 표시·클릭 확인이 필요합니다."
                : test
                ? "현재 기기 테스트 처리 중"
                : input.audience === "selected"
                ? "선택 회원 발송도 기기 테스트를 권장합니다."
                : "전체 구독자·전체 회원은 같은 내용의 기기 테스트·확인이 필수입니다."}
            </div>
            <div className="push-actions">
              <button disabled={locked} onClick={() => void work(sendTest)}>
                내 기기로 테스트
              </button>
              <button
                disabled={locked || !test?.accepted || test.confirmed}
                onClick={() => void work(confirmTest)}
              >
                기기에서 표시·이동 확인했습니다
              </button>
            </div>
            {push.state?.status !== "active" && (
              <div className="push-notice">
                <p>테스트 전에 현재 브라우저의 알림 등록 확인이 필요합니다.</p>
                {push.needsInstall
                  ? <p>iPhone에서는 홈 화면에 추가한 앱에서 진행해주세요.</p>
                  : (
                    <button
                      disabled={locked || push.busy || !push.supported}
                      onClick={() => void push.subscribe()}
                    >
                      현재 기기 알림 등록
                    </button>
                  )}
                {push.error && <p role="alert">{push.error}</p>}
              </div>
            )}
            <div className="push-actions">
              <button
                disabled={locked}
                onClick={() =>
                  void work(async () => {
                    const id = draft?.id || crypto.randomUUID(),
                      requestId = crypto.randomUUID();
                    const payload = {
                      id,
                      requestId,
                      revision: draft?.revision,
                      content: composition(input, true),
                    };
                    setUncertain({
                      id,
                      requestId,
                      payload,
                      action: "draft-save",
                    });
                    const result = await request<
                      { id: string; revision: number }
                    >("draft-save", payload);
                    setUncertain(null);
                    setDraft(result);
                    setNotice("내 초안을 서버에 저장했습니다.");
                  })}
              >
                초안 저장
              </button>
              <button
                className="push-primary"
                disabled={locked}
                onClick={() => void work(prepare)}
              >
                발송 내용 확인
              </button>
            </div>
          </section>
          <aside className="push-panel">
            <h2>알림 미리보기</h2>
            <div className="push-notification">
              <small>all LEET · 표시 예시</small>
              <strong>{input.title || "알림 제목"}</strong>
              <p>{input.body || "알림 본문"}</p>
            </div>
            <p className="push-small">
              클릭 시 {input.path || "/"}{" "}
              이동 · 기기에 따라 일부 생략될 수 있습니다.
            </p>
          </aside>
        </div>
      )}
      {tab === "drafts" && (
        <section className="push-panel">
          <h2>내 초안</h2>
          <p className="push-small">
            현재 관리자 소유 초안만 조회합니다. 불러온 초안의 대상과 테스트는
            다시 확인합니다.
          </p>
          {!drafts.length && <p>저장된 초안이 없습니다.</p>}
          {drafts.map((d) => (
            <div className="push-draft" key={d.id}>
              <strong>{d.title || "제목 없는 초안"}</strong>
              <p>
                저장 버전 {d.revision} ·{" "}
                {d.lastCampaignId ? "발송 기록 있음" : "미발송"}
              </p>
              <button
                disabled={locked}
                onClick={() => void work(() => loadDraft(d))}
              >
                불러오기
              </button>
            </div>
          ))}
          {draftBefore && (
            <button
              disabled={locked}
              onClick={() => void work(() => draftsPage(true))}
            >
              초안 더 보기
            </button>
          )}
        </section>
      )}
      {tab === "history" && (
        <section className="push-panel">
          <h2>발송 이력</h2>
          <p className="push-notice">
            푸시 서비스 접수는 실제 기기 표시·읽음과 다릅니다. 미전송 중단으로
            이미 접수한 알림을 회수할 수 없습니다.
          </p>
          <label>
            조회 시작일<input
              type="date"
              aria-label="이력 조회 시작일"
              value={historySince}
              onChange={(e) => setHistorySince(e.target.value)}
            />
          </label>
          <button
            disabled={locked}
            onClick={() => void work(() => historyPage())}
          >
            이력 조회
          </button>
          {!history.length && <p>조회된 발송 이력이 없습니다.</p>}
          {history.map((c) => (
            <article className="push-campaign" key={c.id}>
              <h3>{c.title} {c.kind === "test" && "· 본인 테스트"}</h3>
              <p>
                {c.state === "stopping"
                  ? "중단 처리 중"
                  : c.state === "stopped"
                  ? "중단 완료"
                  : c.state === "completed"
                  ? "처리 완료"
                  : "처리 중"} · {c.path}
              </p>
              <p>
                접수 {c.counts.accepted || 0} · 실패 {c.counts.failed || 0}{" "}
                · 결과 미확인 {c.counts.unknown || 0} · 제외{" "}
                {c.counts.skipped || 0} · 처리 중{" "}
                {(c.counts.pending || 0) + (c.counts.leased || 0) +
                  (c.counts.retry_wait || 0)} / 접수 대상 {c.count}개
              </p>
              <p className="push-small">
                확인 후보 {c.candidateCount}개 · 접수 전 제외{" "}
                {c.excludedBefore}개 · 마지막 갱신{" "}
                {new Date(c.updatedAt).toLocaleString("ko-KR")}
              </p>
              <div className="push-actions">
                {["queued", "processing"].includes(c.state) && (
                  <button
                    disabled={locked}
                    onClick={() =>
                      void work(async () => {
                        const updated = await request<Campaign>("stop", {
                          id: c.id,
                          revision: c.revision,
                          requestId: crypto.randomUUID(),
                        });
                        setHistory((old) =>
                          old.map((item) => item.id === c.id ? updated : item)
                        );
                      })}
                  >
                    미전송 중단
                  </button>
                )}
                {(c.counts.unknown || 0) > 0 &&
                  !["stopping", "stopped"].includes(c.state) && (
                  <button
                    disabled={locked}
                    onClick={() => {
                      if (
                        window.confirm(
                          "결과 미확인 기기에 같은 알림이 중복 표시될 수 있습니다. 기존 TTL과 시도 한도 내에서 재전송할까요?",
                        )
                      ) {
                        void work(async () => {
                          const updated = await request<Campaign>(
                            "retry-unknown",
                            {
                              id: c.id,
                              revision: c.revision,
                              requestId: crypto.randomUUID(),
                              confirmed: true,
                            },
                          );
                          setHistory((old) =>
                            old.map((item) => item.id === c.id ? updated : item)
                          );
                        });
                      }
                    }}
                  >
                    미확인 기기 재전송
                  </button>
                )}
              </div>
            </article>
          ))}
          {historyBefore && (
            <button
              disabled={locked}
              onClick={() => void work(() => historyPage(true))}
            >
              이력 더 보기
            </button>
          )}
        </section>
      )}
      {preview && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy && !uncertain) setPreview(null);
          }}
        >
          <DialogContent
            className="push-modal"
            overlayClassName="push-modal-overlay"
            closeLabel="발송 확인 닫기"
            aria-describedby={undefined}
            onEscapeKeyDown={(e) => {
              if (busy || uncertain) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (busy || uncertain) e.preventDefault();
            }}
          >
            <DialogTitle>발송 내용 확인</DialogTitle>
            <p>
              <strong>{input.title}</strong>
            </p>
            <p>{input.body}</p>
            <p>이동: {input.path}</p>
            <p>{audiences[input.audience]} · 후보 구독 {preview.count}개</p>
            <p>
              연결 회원 {preview.members}명 · 비로그인 구독{" "}
              {preview.anonymous}개
            </p>
            <p className="push-small">
              확인 이후 철회·만료한 기기는 제외하고 새 구독자는 추가하지
              않습니다. 유효기간:{" "}
              {new Date(preview.expiresAt).toLocaleTimeString("ko-KR")}
            </p>
            {preview.duplicates.length > 0 && (
              <div className="push-warning">
                <p>
                  최근 동일 내용 발송{" "}
                  {preview.duplicates.length}건과 대상이 겹칩니다.
                </p>
                <label className="push-check">
                  <input
                    type="checkbox"
                    checked={duplicateAck}
                    onChange={(e) => setDuplicateAck(e.target.checked)}
                  />중복 가능성을 확인하고 진행합니다.
                </label>
              </div>
            )}
            <div className="push-actions">
              <button
                disabled={busy || !!uncertain}
                onClick={() => setPreview(null)}
              >
                돌아가기
              </button>
              <button
                className="push-primary"
                disabled={locked ||
                  (preview.duplicates.length > 0 && !duplicateAck)}
                onClick={() => void work(submit)}
              >
                발송 접수
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
