import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import {
  adminUserDataApi as api,
  UserDataError,
} from "../utils/adminUserDataApi";
import {
  DATA_DOMAINS,
  type DataDomain,
  type DataMember,
  type DataOperation,
  type DataPage,
  type DataRow,
  EDIT_FIELDS,
} from "../../supabase/functions/_shared/user-data-contract";
import {
  UserDataApproval,
  UserDataEditor,
} from "../components/admin/UserDataDialogs";
import { UserDataRecord } from "../components/admin/UserDataRecord";
import { HistoryPage } from "./HistoryPage";
import { ResultPage } from "./ResultPage";
import { AdmissionResultPage } from "./AdmissionResultPage";
import type { GradingResult, Subject } from "../App";
import type { MockExamRecord } from "../types/mockExam";
import type { LawSchoolAnalysis } from "../utils/lawschool";
import { Button } from "../components/ui/button";
import "../styles/admin.css";
import "../styles/admin-user-data.css";
interface Detail {
  domain: DataDomain;
  page: DataPage;
}
interface Editor {
  domain: DataDomain;
  row: DataRow;
  reference: string;
}
const emptyPage: DataPage = { items: [], total: 0 };
function reference(row: DataRow) {
  if (typeof row._reference !== "string") {
    throw new UserDataError("INVALID_RESPONSE");
  }
  return row._reference;
}
function listTitle(domain: DataDomain, row: DataRow, index: number) {
  if (domain === "admission") {
    const input = row.input as { leet: number; gpa: number };
    return `LEET ${input.leet} / GPA ${input.gpa} · ${String(row.created_at)}`;
  }
  return String(
    row.title || row.nickname || row.event_name || row.content || row.name ||
      row.execution_id || row.id || `기록 ${index + 1}`,
  ).slice(0, 140);
}
export function AdminUserDataPage() {
  const { currentUser, isAdmin } = useAuth();
  const owner = currentUser?.id || "";
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<DataMember[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [target, setTarget] = useState<DataMember | null>(null);
  const [domain, setDomain] = useState<DataDomain>("history");
  const [data, setData] = useState<DataPage>(emptyPage);
  const [mock, setMock] = useState<DataPage>(emptyPage);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [operation, setOperation] = useState<DataOperation | null>(null);
  const [offset, setOffset] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [pendingFiles, setPendingFiles] = useState<
    { id: string; file: File }[]
  >([]);
  const generation = useRef(0);
  const controller = useRef(new AbortController());
  const mounted = useRef(true);
  const reset = useCallback(() => {
    generation.current++;
    controller.current.abort();
    controller.current = new AbortController();
    setData(emptyPage);
    setMock(emptyPage);
    setDetail(null);
    setEditor(null);
    setOperation(null);
    setPendingFiles([]);
    setOffset(0);
    setHistoryPage(0);
    setError("");
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current.abort();
    };
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        reset();
        setTarget(null);
        setMembers([]);
        setCursor(null);
        setRevoked(false);
      }
    });
    return () => {
      active = false;
    };
  }, [owner, isAdmin, reset]);
  const handleError = useCallback((e: unknown) => {
    if (!mounted.current) return;
    const message = e instanceof Error ? e.message : "처리하지 못했습니다.";
    if (e instanceof UserDataError && (e.status === 401 || e.status === 403)) {
      reset();
      setTarget(null);
      setMembers([]);
      setCursor(null);
      setMemberError(message);
      setRevoked(true);
    }
    setError(message);
  }, [reset]);
  useEffect(() => {
    if (!owner || !isAdmin || revoked) return;
    const request = new AbortController();
    const timer = setTimeout(() => {
      setMemberError("");
      void api.members(owner, query, null, request.signal).then((page) => {
        if (!request.signal.aborted) {
          setMembers(page.items);
          setCursor(page.next_cursor);
        }
      }).catch((e) => {
        if (!request.signal.aborted) {
          setMemberError(
            e instanceof Error ? e.message : "사용자를 불러오지 못했습니다.",
          );
          handleError(e);
        }
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [owner, isAdmin, query, handleError, revoked]);
  useEffect(() => {
    if (!target || !owner || !isAdmin || revoked) return;
    const id = ++generation.current;
    controller.current.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    queueMicrotask(() => {
      if (id === generation.current) {
        setBusy(true);
        setData(emptyPage);
        setMock(emptyPage);
        setDetail(null);
        setEditor(null);
        setOperation(null);
        setError("");
      }
    });
    const read = domain === "history" || domain === "mock_history"
      ? Promise.all([
        api.read(
          owner,
          target.user_id,
          "history_summary",
          0,
          undefined,
          signal,
        ),
        api.read(owner, target.user_id, "mock_summary", 0, undefined, signal),
      ])
      : api.read(owner, target.user_id, domain, offset, undefined, signal).then(
        (page) => [page, emptyPage],
      );
    void read.then(([page, mockPage]) => {
      if (id === generation.current) {
        setData(page);
        setMock(mockPage);
      }
    }).catch((e) => {
      if (id === generation.current && !signal.aborted) handleError(e);
    }).finally(() => {
      if (id === generation.current) setBusy(false);
    });
    return () => {
      if (!signal.aborted) controller.current.abort();
    };
  }, [target, domain, owner, isAdmin, offset, revision, handleError, revoked]);
  const select = (member: DataMember | null) => {
    if (mutating) return;
    reset();
    setTarget(member);
  };
  const chooseDomain = (next: DataDomain) => {
    if (mutating) return;
    reset();
    setDomain(next);
  };
  async function scoped<T>(
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    const id = generation.current;
    const signal = controller.current.signal;
    try {
      const result = await work(signal);
      return mounted.current && id === generation.current && !signal.aborted
        ? result
        : undefined;
    } catch (e) {
      if (mounted.current && id === generation.current && !signal.aborted) {
        handleError(e);
      }
      return undefined;
    }
  }
  async function openRows(next: DataDomain, references: string[]) {
    if (!target) return;
    const requestGeneration = generation.current;
    setBusy(true);
    const page = await scoped((signal) =>
      api.read(owner, target.user_id, next, 0, references, signal)
    );
    if (page) setDetail({ domain: next, page });
    if (requestGeneration === generation.current) setBusy(false);
  }
  async function loadContext(contextOffset: number) {
    if (!target || !detail) return;
    const requestGeneration = generation.current;
    setBusy(true);
    const page = await scoped((signal) =>
      api.context(
        owner,
        target.user_id,
        detail.domain,
        reference(detail.page.items[0]),
        contextOffset,
        signal,
      )
    );
    if (page) setDetail({ domain: detail.domain, page });
    if (requestGeneration === generation.current) setBusy(false);
  }
  async function prepare(
    next: DataDomain,
    action: "update" | "delete",
    references: string[],
    payload: DataRow = {},
    recalculate: string[] = [],
    files: File[] = [],
  ) {
    if (!target) return;
    setMutating(true);
    setError("");
    try {
      const localFiles = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));
      const uploads = await Promise.all(localFiles.map(async (item) => ({
        id: item.id,
        name: item.file.name,
        mime: item.file.type,
        size: item.file.size,
        sha256: Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await item.file.arrayBuffer(),
            ),
          ),
          (value) => value.toString(16).padStart(2, "0"),
        ).join(""),
      })));
      const prepared = await scoped((signal) =>
        api.prepare(
          owner,
          target.user_id,
          next,
          action,
          references,
          payload,
          recalculate,
          signal,
          uploads,
        )
      );
      if (prepared) {
        setPendingFiles(localFiles);
        setEditor(null);
        setOperation(prepared);
      }
    } catch (e) {
      handleError(e);
    } finally {
      setMutating(false);
    }
  }
  async function commit(approval: string) {
    if (!operation) return;
    setMutating(true);
    setError("");
    const saved = await scoped((signal) =>
      api.commit(owner, operation.operation_id, approval, signal, pendingFiles)
    );
    if (saved) setOperation({ ...operation, ...saved });
    else if (mounted.current) {
      setOperation((previous) =>
        previous ? { ...previous, state: "unknown" } : null
      );
    }
    setMutating(false);
  }
  async function checkOperation(id = operation?.operation_id) {
    if (!id) return;
    setMutating(true);
    const state = await scoped((signal) => api.operation(owner, id, signal));
    if (state && state.target && state.target !== target?.user_id) {
      setError(
        "현재 선택 사용자와 승인 작업 대상이 다릅니다. 해당 사용자를 다시 선택해주세요.",
      );
    } else if (state) {
      setOperation((previous) => ({
        ...previous,
        ...state,
        impact: state.impact || previous?.impact || {},
      }));
    }
    setMutating(false);
  }
  const finishOperation = () => {
    const refresh = operation?.state !== "prepared";
    setOperation(null);
    setPendingFiles([]);
    if (refresh) setRevision((n) => n + 1);
  };
  const officialRecords = useMemo(
    () =>
      data.items.map((row) => ({
        ...row.record as GradingResult,
        __reference: reference(row),
      })),
    [data],
  );
  const mockRecords = useMemo(
    () =>
      mock.items.map((row) => ({
        ...row.record as unknown as MockExamRecord,
        __reference: reference(row),
      })),
    [mock],
  );
  const recordRef = (record: unknown) =>
    String((record as { __reference: string }).__reference);
  const clearHistory = (kind: "history" | "mock_history") => {
    const page = kind === "history" ? data : mock;
    if (!page.items.length || !page.collection_reference) return;
    void prepare(kind, "delete", [page.collection_reference]);
  };
  const detailResults = useMemo(
    () =>
      detail?.domain === "history"
        ? detail.page.items.map((row) => row.record as unknown as GradingResult)
        : [],
    [detail],
  );
  const noteRows = useRef<DataRow[]>([]);
  const resultAdmin = useMemo(() => ({
    results: detailResults,
    onBack: () => setDetail(null),
    loadNotes: async () => {
      if (!target || !detailResults.length) return [];
      const first = detailResults[0];
      let page: DataPage;
      try {
        page = await api.notes(
          owner,
          target.user_id,
          first.groupTimestamp ?? first.timestamp,
          controller.current.signal,
        );
      } catch (e) {
        handleError(e);
        throw e;
      }
      noteRows.current = page.items;
      return page.items as unknown as {
        subject: Subject;
        question_no: number;
        content: string;
      }[];
    },
    changeNote: async (
      subject: Subject,
      question: number,
      content: string | null,
    ) => {
      const note = noteRows.current.find((row) =>
        row.subject === subject && row.question_no === question
      );
      if (!note) {
        setError("관리자 화면에서는 기존 메모의 수정·삭제만 가능합니다.");
        return;
      }
      await prepare(
        "notes",
        content ? "update" : "delete",
        [reference(note)],
        content ? { content } : {},
      );
    },
    // Callbacks intentionally belong to this selected target and this detail snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [detailResults, target, owner]);
  const admissionAdmin = useMemo(
    () =>
      detail?.domain === "admission"
        ? {
          analyses: detail.page.items[0]?.analyses as LawSchoolAnalysis[],
          input: detail.page.items[0]?.input as { leet: number; gpa: number },
          onBack: () => setDetail(null),
        }
        : undefined,
    [detail],
  );
  const targetLabel = target
    ? `${target.name || "이름 없음"} · ${
      target.email || "탈퇴한 계정"
    } · ${target.user_id}`
    : "";
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="사용자 데이터"
        description="선택 사용자의 실제 기록을 조회하고 승인 후 수정·삭제합니다."
        backTo="/admin"
      />
      <main className="admin-shell">
        <div className="admin-user-data-container">
          <section className="admin-panel mb-5">
            <label className="block text-sm font-semibold">
              사용자 검색<input
                aria-label="사용자 검색"
                value={query}
                disabled={mutating || revoked}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름·이메일·사용자 ID"
                className="mt-2 w-full border rounded px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold mt-3">
              사용자 선택<select
                aria-label="사용자 선택"
                value={target?.user_id || ""}
                disabled={mutating || revoked}
                onChange={(e) =>
                  select(
                    members.find((m) => m.user_id === e.target.value) || null,
                  )}
                className="mt-2 w-full border rounded px-3 py-2"
              >
                <option value="">사용자를 선택해주세요</option>
                {target && !members.some((m) => m.user_id === target.user_id) &&
                  <option value={target.user_id}>{targetLabel}</option>}
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name || "이름 없음"} ·{" "}
                    {member.email || "탈퇴한 계정"} · {member.user_id}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-gray-600 mt-2">
              관리자·테스트 계정도 선택할 수 있습니다. 새로고침하면 선택과 편집
              입력을 초기화합니다.
            </p>
            {cursor && (
              <Button
                className="mt-3"
                variant="outline"
                disabled={mutating}
                onClick={() =>
                  void scoped((signal) =>
                    api.members(owner, query, cursor, signal)
                  ).then((page) => {
                    if (page) {
                      setMembers((previous) => [...previous, ...page.items]);
                      setCursor(page.next_cursor);
                    }
                  })}
              >
                사용자 더 보기
              </Button>
            )}
            {memberError && (
              <p role="alert" className="text-red-700 mt-3">{memberError}</p>
            )}
          </section>
          {target && (
            <>
              <div className="admin-panel mb-5">
                <p className="font-semibold break-all">{targetLabel}</p>
                <p className="text-sm text-gray-600 mt-1">
                  관리자 데이터 조회 모드
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(DATA_DOMAINS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      disabled={mutating}
                      aria-pressed={domain === key}
                      onClick={() => chooseDomain(key as DataDomain)}
                      className={`border rounded px-3 py-2 text-sm ${
                        domain === key
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <div role="alert" className="admin-panel text-red-700 mb-4">
                  {error}
                  <Button
                    variant="outline"
                    className="ml-3"
                    disabled={mutating}
                    onClick={() =>
                      setRevision((n) =>
                        n + 1
                      )}
                  >
                    다시 조회
                  </Button>
                </div>
              )}
              {error && !data.items.length && !busy
                ? <div className="admin-panel">조회를 완료하지 못했습니다.</div>
                : busy
                ? (
                  <div role="status" className="admin-panel">
                    기록을 불러오는 중…
                  </div>
                )
                : detail
                ? (
                  <>
                    <div className="admin-panel flex flex-wrap gap-2 mb-4">
                      <Button
                        variant="outline"
                        onClick={() => setDetail(null)}
                      >
                        목록으로
                      </Button>
                      {detail.page.items.map((row, index) => (
                        <div key={reference(row)} className="flex gap-2">
                          {Boolean(EDIT_FIELDS[detail.domain]?.length) && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                setEditor({
                                  domain: detail.domain,
                                  row: (row.record || row) as DataRow,
                                  reference: reference(row),
                                })}
                            >
                              {detail.domain === "history"
                                ? `${
                                  (row.record as GradingResult).subject ===
                                      "verbal"
                                    ? "언어"
                                    : "추리"
                                } 수정`
                                : "수정"}
                            </Button>
                          )}
                          {!["account", "profile"].includes(detail.domain) && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                void prepare(detail.domain, "delete", [
                                  reference(row),
                                ])}
                            >
                              기록 {index + 1} 삭제
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {detail.domain === "history"
                      ? (
                        <ResultPage
                          key={`${target.user_id}:${revision}`}
                          admin={resultAdmin}
                        />
                      )
                      : detail.domain === "admission" && admissionAdmin
                      ? <AdmissionResultPage admin={admissionAdmin} />
                      : detail.page.items.map((row) => (
                        <UserDataRecord
                          key={reference(row)}
                          domain={detail.domain}
                          record={row}
                          context={detail.page.context}
                          target={target.user_id}
                        />
                      ))}
                    {detail.page.context_posts?.filter((post) =>
                      detail.domain !== "posts" ||
                      post.id !== detail.page.items[0]?.id
                    ).map((post) => (
                      <div key={String(post.id)} className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">
                          관련 게시글 · 조회 전용
                        </p>
                        <UserDataRecord
                          domain="posts"
                          record={post}
                          context={detail.page.context}
                          target={target.user_id}
                        />
                      </div>
                    ))}
                    {!!detail.page.context_total && (
                      <div className="admin-panel mt-4">
                        <p>
                          관련 댓글 {detail.page.context_total}건 · 한 번에 50건
                        </p>
                        <div className="flex gap-3 mt-2">
                          <Button
                            variant="outline"
                            disabled={!detail.page.context_offset}
                            onClick={() =>
                              void loadContext(
                                Math.max(
                                  0,
                                  (detail.page.context_offset || 0) - 50,
                                ),
                              )}
                          >
                            이전 댓글
                          </Button>
                          <Button
                            variant="outline"
                            disabled={detail.page.context_next_offset == null}
                            onClick={() =>
                              void loadContext(
                                detail.page.context_next_offset || 0,
                              )}
                          >
                            다음 댓글
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
                : domain === "history" || domain === "mock_history"
                ? (
                  <>
                    <HistoryPage
                      key={`${target.user_id}:${domain}:${revision}`}
                      history={officialRecords}
                      mockHistory={mockRecords}
                      onClearHistory={() => clearHistory("history")}
                      onClearMockHistory={() => clearHistory("mock_history")}
                      onDeleteRecord={() => {}}
                      onDeleteMockRecord={() => {}}
                      admin={{
                        page: historyPage,
                        onPageChange: setHistoryPage,
                        initialTab: domain === "mock_history"
                          ? "mock"
                          : "official",
                        onBack: () => select(null),
                        onOpen: (group) =>
                          void openRows("history", group.map(recordRef)),
                        onDelete: (group) =>
                          void prepare(
                            "history",
                            "delete",
                            group.map(recordRef),
                          ),
                        onDeleteMock: (record) =>
                          void prepare("mock_history", "delete", [
                            recordRef(record),
                          ]),
                        onEditMock: (record) =>
                          void openRows("mock_history", [recordRef(record)]),
                      }}
                    />
                  </>
                )
                : (
                  <section className="admin-panel">
                    <h2>{DATA_DOMAINS[domain]} · 실제 기록 {data.total}건</h2>
                    {!data.items.length && (
                      <p className="mt-4 text-gray-600">실제 기록 0건</p>
                    )}
                    <ul className="admin-list">
                      {data.items.map((row, index) => (
                        <li
                          key={String(
                            row.id || row.execution_id || row.event_id ||
                              row._reference || index,
                          )}
                        >
                          <div className="admin-list-copy">
                            <h3 className="font-semibold">
                              {listTitle(domain, row, index)}
                            </h3>
                            {domain === "account"
                              ? (
                                <UserDataRecord
                                  domain={domain}
                                  record={row}
                                  target={target.user_id}
                                />
                              )
                              : (
                                <p>
                                  {String(
                                    row.created_at || row.received_at ||
                                      row.day || "",
                                  )}
                                </p>
                              )}
                            {domain === "audit" && Boolean(row.operation_id) &&
                              row.actor === owner &&
                              row.target === target.user_id &&
                              row.status !== "prepared" && (
                              <button
                                type="button"
                                className="text-blue-600 text-sm"
                                onClick={() =>
                                  void checkOperation(String(row.operation_id))}
                              >
                                처리 결과 확인
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!data.readonly && domain !== "audit" && (
                              <>
                                {!["account", "profile"].includes(domain) && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      void openRows(domain, [reference(row)])}
                                  >
                                    자세히 보기
                                  </Button>
                                )}
                                {Boolean(EDIT_FIELDS[domain]?.length) && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      setEditor({
                                        domain,
                                        row,
                                        reference: reference(row),
                                      })}
                                  >
                                    수정
                                  </Button>
                                )}
                                {!["account", "profile"].includes(domain) && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      void prepare(domain, "delete", [
                                        reference(row),
                                      ])}
                                  >
                                    삭제
                                  </Button>
                                )}
                              </>
                            )}
                            {(data.readonly || domain === "audit") && (
                              <details>
                                <summary>기록 보기</summary>
                                <UserDataRecord
                                  domain={domain}
                                  record={row}
                                  target={target.user_id}
                                />
                              </details>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        disabled={offset === 0}
                        onClick={() => setOffset((n) => Math.max(0, n - 50))}
                      >
                        이전
                      </Button>
                      <Button
                        variant="outline"
                        disabled={data.next_offset == null}
                        onClick={() => setOffset(data.next_offset ?? 0)}
                      >
                        다음
                      </Button>
                    </div>
                  </section>
                )}
            </>
          )}
          {!target && !memberError && (
            <p className="admin-panel text-gray-600">
              사용자를 선택하면 서버에 저장된 실제 데이터를 확인할 수 있습니다.
            </p>
          )}
        </div>
      </main>
      {editor && (
        <UserDataEditor
          key={`${editor.domain}:${editor.reference}`}
          domain={editor.domain}
          record={editor.row}
          busy={mutating}
          requestError={error}
          onCancel={() => setEditor(null)}
          onPrepare={(patch, recalculate, files) =>
            prepare(
              editor.domain,
              "update",
              [editor.reference],
              patch,
              recalculate,
              files,
            )}
        />
      )}
      {operation && target && (
        <UserDataApproval
          key={operation.operation_id}
          operation={operation}
          targetLabel={targetLabel}
          busy={mutating}
          error={error}
          files={pendingFiles.map((item) => item.file)}
          onClose={finishOperation}
          onCommit={(approval) =>
            void commit(approval)}
          onCheck={() => void checkOperation()}
        />
      )}
    </div>
  );
}
