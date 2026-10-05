// Synthetic PostgreSQL; this test cannot access the operational service.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function main() {
  const db = new PGlite();
  const actor = id(1), target = id(2);
  type SqlResult = {
    items: { record: Record<string, unknown> }[];
    total: number;
    snapshot: string;
    selection?: Record<string, unknown>[];
    round: number;
    groupTimestamp: number;
    impact: Record<string, number>;
    operation_id: string;
    state: string;
  };
  const rpc = async <T = SqlResult>(name: string, args: unknown[]) =>
    (await db.query<{ data: T }>(
      `select public.${name}(${
        args.map((_, i) => `$${i + 1}`).join(",")
      }) data`,
      args,
    )).rows[0].data;
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),confirmed_at timestamptz,encrypted_password text);
 grant usage on schema public,auth to service_role;
 create table private.admin_roles(user_id uuid,role text);alter table private.admin_roles enable row level security;
 create table public.kv_store_cd835c22(key text primary key,value jsonb);alter table public.kv_store_cd835c22 enable row level security;grant select on public.kv_store_cd835c22 to service_role;`,
    );
    for (const n of [1, 2, 3]) {
      await db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
        [
          id(n),
          `member${n}@example.test`,
          JSON.stringify({
            name: "합성 계정",
            birth_date: "2000-01-01",
            university: "합성 대학",
          }),
        ],
      );
    }
    await db.query("insert into private.admin_roles values($1,'admin')", [
      actor,
    ]);
    await db.exec(
      await readFile(
        new URL("fixtures/user-data-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    for (
      const file of [
        "20261003141220_product_usage_analytics.sql",
        "20261004050638_admin_dashboard_and_member_options.sql",
        "20261005052901_admin_user_data.sql",
      ]
    ) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    }
    assert.equal(
      (await rpc("user_data_members", [actor, "", null])).items.length,
      3,
    );
    await db.exec("set role service_role");
    const base = {
      year: "2026",
      subject: "verbal",
      timestamp: 100,
      groupTimestamp: 100,
      userAnswers: { 1: 2 },
      standardScore: 50,
      correct: 1,
      percentile: 40,
      total: 30,
      examType: "odd",
      fieldAnalysis: [],
    };
    const first = await rpc("user_history_mutate", [
      target,
      "history",
      "append",
      JSON.stringify(base),
    ]);
    assert.equal(first.round, 1);
    assert.equal(first.groupTimestamp, 100);
    assert.equal(
      (await rpc("user_history_mutate", [
        target,
        "history",
        "append",
        JSON.stringify(base),
      ])).round,
      2,
    );
    await db.query(
      "insert into public.grading_notes(user_id,group_timestamp,year,exam_type,subject,question_no,content) values($1,100,2026,'odd','verbal',1,'합성 메모')",
      [target],
    );
    const page = await rpc("user_data_read", [
      actor,
      target,
      "history",
      0,
      null,
    ]);
    assert.equal(page.items.length, 2);
    assert.equal(page.items[0].record.userAnswers, undefined);
    const selector = { indices: [0], snapshot: page.snapshot };
    const prepared = await rpc("user_data_prepare", [
      actor,
      target,
      "history",
      "delete",
      JSON.stringify(selector),
      "{}",
      null,
    ]);
    assert.equal(prepared.impact.notes, 1);
    assert.equal(prepared.selection?.[0]?.groupTimestamp, 100);
    assert.equal(typeof prepared.selection?.[0]?.timestamp, "number");
    assert.equal(prepared.selection?.[0]?.userAnswers, undefined);
    await assert.rejects(
      rpc("user_data_commit", [actor, prepared.operation_id, " 승인"]),
      /APPROVAL_REQUIRED/,
    );
    await rpc("user_history_mutate", [
      target,
      "history",
      "append",
      JSON.stringify(base),
    ]);
    assert.equal(
      (await rpc("user_data_commit", [actor, prepared.operation_id, "승인"]))
        .state,
      "conflict",
    );
    const fresh = await rpc("user_data_read", [
      actor,
      target,
      "history",
      0,
      null,
    ]);
    const remove = await rpc("user_data_prepare", [
      actor,
      target,
      "history",
      "delete",
      JSON.stringify({ indices: [0, 1], snapshot: fresh.snapshot }),
      "{}",
      null,
    ]);
    assert.equal(
      (await rpc("user_data_commit", [actor, remove.operation_id, "승인"]))
        .state,
      "succeeded",
    );
    assert.equal(
      (await rpc("user_data_commit", [actor, remove.operation_id, "승인"]))
        .state,
      "succeeded",
    );
    assert.equal(
      (await rpc("user_data_read", [actor, target, "history", 0, null])).total,
      1,
    );
    assert.equal(
      (await db.query("select * from public.grading_notes")).rows.length,
      0,
    );
    await assert.rejects(
      rpc("user_data_prepare", [
        actor,
        target,
        "history",
        "update",
        JSON.stringify({
          indices: [0],
          snapshot:
            (await rpc("user_data_read", [actor, target, "history", 0, null]))
              .snapshot,
        }),
        JSON.stringify({ year: "2025" }),
        null,
      ]),
      /INVALID_FIELD/,
    );
    // Exact cascade impact includes other authors; equal counts with replaced rows conflict.
    await db.query(
      "insert into public.community_posts(id,user_id,tag,title,content) values($1,$2,'질문','합성 게시글','내용')",
      [id(20), target],
    );
    await db.query(
      "insert into public.community_comments(id,user_id,post_id,content) values($1,$2,$3,'타인 댓글')",
      [id(21), id(3), id(20)],
    );
    const post =
      (await rpc("user_data_read", [actor, target, "posts", 0, null]))
        .items[0] as unknown as Record<string, unknown>;
    const postSelector = JSON.stringify({ id: id(20) });
    const cascade = await rpc("user_data_prepare", [
      actor,
      target,
      "posts",
      "delete",
      postSelector,
      "{}",
      post._snapshot,
    ]);
    assert.equal(cascade.impact.comments, 1);
    await db.query("delete from public.community_comments where id=$1", [
      id(21),
    ]);
    await db.query(
      "insert into public.community_comments(id,user_id,post_id,content) values($1,$2,$3,'다른 댓글')",
      [id(22), id(3), id(20)],
    );
    assert.equal(
      (await rpc("user_data_commit", [actor, cascade.operation_id, "승인"]))
        .state,
      "conflict",
    );
    const freshPost =
      (await rpc("user_data_read", [actor, target, "posts", 0, null]))
        .items[0] as unknown as Record<string, unknown>;
    const deletePost = await rpc("user_data_prepare", [
      actor,
      target,
      "posts",
      "delete",
      postSelector,
      "{}",
      freshPost._snapshot,
    ]);
    assert.equal(
      (await rpc("user_data_commit", [actor, deletePost.operation_id, "승인"]))
        .state,
      "succeeded",
    );
    assert.equal(
      (await db.query("select * from public.community_comments")).rows.length,
      0,
    );
    // A failed success audit rolls back the record mutation and operation consumption.
    const official = await rpc("user_data_read", [
      actor,
      target,
      "history",
      0,
      null,
    ]);
    const edit = await rpc("user_data_prepare", [
      actor,
      target,
      "history",
      "update",
      JSON.stringify({ indices: [0], snapshot: official.snapshot }),
      JSON.stringify({ standardScore: 82 }),
      null,
    ]);
    await db.exec(
      "reset role;create function private.synthetic_fail_audit() returns trigger language plpgsql as $$begin if new.status='succeeded' and new.action='update' then raise exception 'SYNTHETIC_AUDIT_FAIL';end if;return new;end$$;create trigger synthetic_fail before insert on private.user_data_audit for each row execute function private.synthetic_fail_audit();set role service_role;",
    );
    await assert.rejects(
      rpc("user_data_commit", [actor, edit.operation_id, "승인"]),
      /SYNTHETIC_AUDIT_FAIL/,
    );
    assert.equal(
      (await rpc("user_data_operation", [actor, edit.operation_id])).state,
      "prepared",
    );
    assert.equal(
      (await rpc("user_data_read", [actor, target, "history", 0, null]))
        .items[0].record.standardScore,
      50,
    );
    await db.exec(
      "reset role;drop trigger synthetic_fail on private.user_data_audit;drop function private.synthetic_fail_audit();set role service_role;",
    );
    assert.equal(
      (await rpc("user_data_commit", [actor, edit.operation_id, "승인"])).state,
      "succeeded",
    );
    // Profile propagation and its complete historical-message impact.
    await db.query(
      "insert into public.chat_profiles(user_id,nickname) values($1,'예전 이름')",
      [target],
    );
    await db.query(
      "insert into public.chat_messages(id,user_id,nickname,content) values($1,$2,'예전 이름','합성 메시지')",
      [id(30), target],
    );
    const profile =
      (await rpc("user_data_read", [actor, target, "profile", 0, null]))
        .items[0] as unknown as Record<string, unknown>;
    const nickname = await rpc("user_data_prepare", [
      actor,
      target,
      "profile",
      "update",
      JSON.stringify({ id: target }),
      JSON.stringify({ nickname: "새 이름" }),
      profile._snapshot,
    ]);
    assert.equal(nickname.impact.chat, 1);
    await rpc("user_data_commit", [actor, nickname.operation_id, "승인"]);
    assert.equal(
      (await db.query<{ nickname: string }>(
        "select nickname from public.chat_messages",
      )).rows[0].nickname,
      "새 이름",
    );
    // Analysis executions are idempotent, permanently retained, and cannot be resurrected.
    await rpc("admission_execution_save", [
      target,
      id(40),
      JSON.stringify({ leet: 120, gpa: 98 }),
      JSON.stringify([{ synthetic: true }]),
      "synthetic-v1",
    ]);
    await rpc("admission_execution_save", [
      target,
      id(40),
      JSON.stringify({ leet: 10, gpa: 20 }),
      "[]",
      "synthetic-v1",
    ]);
    const admission =
      (await rpc("user_data_read", [actor, target, "admission", 0, null]))
        .items[0] as unknown as Record<string, unknown>;
    assert.equal((admission.input as { leet: number }).leet, 120);
    const deleteAdmission = await rpc("user_data_prepare", [
      actor,
      target,
      "admission",
      "delete",
      JSON.stringify({ id: id(40) }),
      "{}",
      admission._snapshot,
    ]);
    await rpc("user_data_commit", [
      actor,
      deleteAdmission.operation_id,
      "승인",
    ]);
    assert.equal(
      (await rpc<{ state: string }>("admission_execution_save", [
        target,
        id(40),
        "{}",
        "[]",
        "synthetic-v1",
      ])).state,
      "administratively_changed",
    );
    await rpc("admission_execution_save", [
      id(99),
      id(41),
      JSON.stringify({ leet: 120, gpa: 98 }),
      "[]",
      "synthetic-v1",
    ]);
    assert.equal(
      (await rpc("user_data_members", [actor, "", null])).items.length,
      4,
    ); // retained, removed Auth identity
    // Usage event tombstones block both the original UUID and a new UUID semantic retry.
    await db.exec(
      "update private.product_analytics_settings set collection_enabled=true,started_at=now()-interval '400 days'",
    );
    const event = {
      event_id: id(50),
      session_id: id(51),
      page_instance_id: id(52),
      page_entry_id: id(53),
      event_sequence: 1,
      occurred_at: new Date().toISOString(),
      metric_version: "1",
      event_name: "grading_completed",
      feature: "grading",
      route: "/",
      execution_channel: "browser",
      display_mode: "browser",
      detection_method: "media_query",
      detection_version: 1,
      os_family: "android",
      device_class: "mobile",
      attributes: {
        input_flow_id: id(54),
        grading_run_id: id(55),
        subjects: "both",
      },
    };
    await rpc("product_analytics_ingest", [
      target,
      JSON.stringify([event]),
      "synthetic-actor",
    ]);
    const usage =
      (await rpc("user_data_read", [actor, target, "usage", 0, null]))
        .items[0] as unknown as Record<string, unknown>;
    const accepted = (await db.query<{ n: number }>(
      "select accepted::int n from private.product_usage_ingestion_quality",
    )).rows[0].n;
    const usageDelete = await rpc("user_data_prepare", [
      actor,
      target,
      "usage",
      "delete",
      JSON.stringify({ id: id(50) }),
      "{}",
      usage._snapshot,
    ]);
    assert.equal(usageDelete.impact.activity_days, 1);
    await rpc("user_data_commit", [actor, usageDelete.operation_id, "승인"]);
    await rpc("product_analytics_ingest", [
      target,
      JSON.stringify([event, { ...event, event_id: id(56) }]),
      "synthetic-actor",
    ]);
    assert.equal(
      (await rpc("user_data_read", [actor, target, "usage", 0, null])).total,
      0,
    );
    assert.equal(
      (await db.query<{ n: number }>(
        "select accepted::int n from private.product_usage_ingestion_quality",
      )).rows[0].n,
      accepted,
    );
    assert.equal(
      (await db.query<{ known: boolean }>(
        "select first_usage_known known from private.product_member_first_usage where user_id=$1",
        [target],
      )).rows[0].known,
      false,
    );
    assert.equal(
      (await db.query(
        "select * from private.product_member_activity_days where user_id=$1",
        [target],
      )).rows.length,
      0,
    );
    // A prepared whole-array deletion also removes the last row, not only the first page.
    const all = await rpc("user_data_read", [
      actor,
      target,
      "history",
      0,
      null,
    ]);
    const clear = await rpc("user_data_prepare", [
      actor,
      target,
      "history",
      "delete",
      JSON.stringify({ all: true, snapshot: all.snapshot }),
      "{}",
      null,
    ]);
    await rpc("user_data_commit", [actor, clear.operation_id, "승인"]);
    assert.equal(
      (await rpc("user_data_read", [actor, target, "history", 0, null])).total,
      0,
    );
    // Image manifests remain intent-only until uploaded bytes are confirmed.
    const imageUrl =
      `https://synthetic.supabase.co/storage/v1/object/public/community-post-images/${target}/added.png`;
    const imagePost = id(70);
    const manifest = {
      id: id(71),
      name: "synthetic.png",
      mime: "image/png",
      size: 8,
      sha256: "a".repeat(64),
      path: `${target}/added.png`,
      url: imageUrl,
    };
    await db.query(
      "insert into public.community_posts(id,user_id,tag,title,content) values($1,$2,'질문','이미지 테스트','내용')",
      [imagePost, target],
    );
    const postHash = async () =>
      String(
        ((await rpc("user_data_read", [actor, target, "posts", 0, null])).items
          .find((item) =>
            (item as unknown as { id: string }).id === imagePost
          ) as unknown as { _snapshot: string })._snapshot,
      );
    const imagePrepare = async () =>
      rpc("user_data_prepare", [
        actor,
        target,
        "posts",
        "update",
        JSON.stringify({ id: imagePost }),
        JSON.stringify({ image_urls: [imageUrl] }),
        await postHash(),
        JSON.stringify([manifest]),
      ]);
    const upload = await imagePrepare();
    assert.equal(upload.impact.images_added, 1);
    assert.equal(
      (await rpc("user_data_commit", [actor, upload.operation_id, "승인"]))
        .state,
      "executing",
    );
    assert.deepEqual(
      (await db.query<{ image_urls: string[] }>(
        "select image_urls from public.community_posts where id=$1",
        [imagePost],
      )).rows[0].image_urls,
      [],
    );
    assert.equal(
      (await rpc("user_data_commit", [
        actor,
        upload.operation_id,
        "승인",
        true,
      ])).state,
      "succeeded",
    );
    assert.equal(
      (await rpc("user_data_commit", [
        actor,
        upload.operation_id,
        "승인",
        true,
      ])).state,
      "succeeded",
    );
    // Storage metadata is never deleted directly; linked files cannot be deleted.
    await db.exec("reset role");
    await db.query(
      "insert into storage.objects(id,bucket_id,name,metadata) values($1,'community-post-images',$2,'{}')",
      [id(72), `${target}/added.png`],
    );
    await db.exec("set role service_role");
    await assert.rejects(
      rpc("user_data_prepare", [
        actor,
        target,
        "storage_images",
        "delete",
        JSON.stringify({ id: id(72), url: imageUrl }),
        "{}",
        null,
      ]),
      /FILE_IN_USE/,
    );
    const detach = await rpc("user_data_prepare", [
      actor,
      target,
      "posts",
      "update",
      JSON.stringify({ id: imagePost }),
      JSON.stringify({ image_urls: [] }),
      await postHash(),
    ]);
    assert.equal(detach.impact.images_removed, 1);
    assert.equal(
      (await rpc("user_data_commit", [actor, detach.operation_id, "승인"]))
        .state,
      "partial",
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.community_posts set image_urls=$1 where id=$2", [[
        imageUrl,
      ], imagePost]),
      /FILE_IN_USE/,
    );
    const stored = await rpc("user_data_read", [
      actor,
      target,
      "storage_images",
      0,
      null,
    ]);
    const orphan = await rpc("user_data_prepare", [
      actor,
      target,
      "storage_images",
      "delete",
      JSON.stringify({ id: id(72), url: imageUrl }),
      "{}",
      (stored.items[0] as unknown as { _snapshot: string })._snapshot,
    ]);
    assert.equal(
      (await rpc("user_data_commit", [actor, orphan.operation_id, "승인"]))
        .state,
      "partial",
    );
    // A post changed while uploads were external is not overwritten; uploaded files are queued for cleanup.
    const conflictUrl = imageUrl.replace("added.png", "conflict.png");
    const conflicting = await rpc("user_data_prepare", [
      actor,
      target,
      "posts",
      "update",
      JSON.stringify({ id: imagePost }),
      JSON.stringify({ image_urls: [conflictUrl] }),
      await postHash(),
      JSON.stringify([{
        ...manifest,
        url: conflictUrl,
        path: `${target}/conflict.png`,
      }]),
    ]);
    await rpc("user_data_commit", [actor, conflicting.operation_id, "승인"]);
    await db.query(
      "update public.community_posts set title='다른 변경' where id=$1",
      [imagePost],
    );
    assert.equal(
      (await rpc("user_data_commit", [
        actor,
        conflicting.operation_id,
        "승인",
        true,
      ])).state,
      "conflict",
    );
    assert.equal(
      (await rpc<{ items: unknown[] }>("user_data_cleanup", [
        actor,
        conflicting.operation_id,
      ])).items.length,
      1,
    );
    // Real role permissions, not only a superuser test.
    await assert.rejects(db.exec("delete from private.user_data_audit"));
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        rpc("user_data_read", [actor, target, "history", 0, null]),
      );
      await assert.rejects(db.exec("select * from private.admission_history"));
      await db.exec("reset role");
    }
    await assert.rejects(
      rpc("user_data_members", [target, "", null]),
      /ADMIN_REQUIRED/,
    );
    console.log(
      "사용자 데이터 SQL (추가: 동일 건수 교체 충돌·감사 실패 롤백·과거 닉네임·영구 분석·사용 이벤트 재수신 차단·전체 삭제): 회원 범위, 서버 요약, 원자 이력·회독, 메모 연쇄 삭제, 승인·충돌·중복 실행, 불변 필드, RLS·감사 권한 통과",
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
