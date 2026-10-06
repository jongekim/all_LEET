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
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),confirmed_at timestamptz,encrypted_password text,deleted_at timestamptz);
 grant usage on schema public,auth to service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to authenticated,anon;
 create table private.admin_roles(user_id uuid references auth.users(id) on delete cascade,role text);alter table private.admin_roles enable row level security;
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
    // A historical Auth deletion can leave KV history without an admission run.
    await db.query('insert into public.kv_store_cd835c22 values($1,$2)', [`history:${id(98)}`, JSON.stringify([{ timestamp: 100 }])]);
    for (
      const file of [
        "20261003141220_product_usage_analytics.sql",
        "20261004050638_admin_dashboard_and_member_options.sql",
        "20261005052901_admin_user_data.sql",
        "20261006104150_user_data_recent_activity.sql",
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
    await db.exec("reset role");
    await db.query("insert into auth.users(id) values($1)", [id(99)]);
    await db.exec("set role service_role");
    await rpc("admission_execution_save", [
      id(99),
      id(41),
      JSON.stringify({ leet: 120, gpa: 98 }),
      "[]",
      "synthetic-v1",
    ]);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [id(99)]);
    await db.exec("set role service_role");
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
    // Server sorting and grouped counts use synthetic records, never operational data.
    const grouped = async (records: unknown) => (await db.query<{ count: number | null }>(
      'select private.user_data_grading_count($1::jsonb) as count', [JSON.stringify(records)],
    )).rows[0].count;
    assert.equal(await grouped([{ groupTimestamp: 1000 }, { groupTimestamp: 1000 }, { timestamp: 2000 }]), 2);
    assert.equal(await grouped([{ timestamp: 0 }, { timestamp: 900 }, { timestamp: 1800 }]), 2);
    assert.equal(await grouped([]), 0);
    assert.equal(await grouped([{ timestamp: 'broken' }]), null);
    assert.equal(await grouped({ timestamp: 1 }), null);
    for (let n = 201; n <= 266; n++) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',
        [id(n), `recent${n}@example.test`, JSON.stringify({ name: '정렬 검증' })]);
      if (n < 260) await db.query("insert into private.user_last_activity values($1,'2026-10-06T00:00:00Z'::timestamptz + ($2::integer * interval '1 minute'))", [id(n), n]);
    }
    await db.query('insert into public.kv_store_cd835c22 values($1,$2),($3,$4)', [
      `history:${id(259)}`, JSON.stringify([{ timestamp: 100, subject: 'verbal' }, { timestamp: 100, subject: 'reasoning' }, { timestamp: 5000, subject: 'verbal' }]),
      `mock_history:${id(259)}`, JSON.stringify([{}, {}, {}]),
    ]);
    await db.query('insert into public.kv_store_cd835c22 values($1,null),($2,$3)', [
      `history:${id(258)}`, `mock_history:${id(258)}`, JSON.stringify({ broken: true }),
    ]);
    type MemberPage = { items: { user_id: string; name: string | null; email: string | null; grading_count: number | null; mock_count: number | null; last_seen_at: string | null; is_deleted: boolean }[]; next_cursor: unknown };
    await db.exec('set role service_role');
    const legacyRetired = (await rpc<MemberPage>('user_data_members_recent', [actor, id(98), null])).items[0];
    assert.equal(legacyRetired.is_deleted, true);
    assert.equal(legacyRetired.grading_count, 1);
    assert.equal(legacyRetired.name, null);
    const recent = await rpc<MemberPage>('user_data_members_recent', [actor, '정렬 검증', null]);
    assert.equal(recent.items.length, 50);
    assert.equal(recent.items[0].user_id, id(259));
    assert.equal(recent.items[0].grading_count, 2);
    assert.equal(recent.items[0].mock_count, 3);
    assert.equal(recent.items[1].grading_count, null);
    assert.equal(recent.items[1].mock_count, null);
    assert.equal(recent.items[2].grading_count, 0);
    const second = await rpc<MemberPage>('user_data_members_recent', [actor, '정렬 검증', JSON.stringify(recent.next_cursor)]);
    assert.deepEqual([...recent.items, ...second.items].map(m => m.user_id), [
      ...Array.from({ length: 59 }, (_, n) => id(259 - n)), ...Array.from({ length: 7 }, (_, n) => id(260 + n)),
    ]);
    assert.equal(second.next_cursor, null);
    assert.deepEqual((await rpc<MemberPage>('user_data_members_recent', [actor, 'recent266', null])).items.map(m => m.user_id), [id(266)]);
    assert.equal((await rpc<{ updated: boolean }>('service_activity_touch', [actor])).updated, true);
    assert.equal((await rpc<{ updated: boolean }>('service_activity_touch', [actor])).updated, false);
    const allRecent = await rpc<MemberPage>('user_data_members_recent', [actor, '', null]);
    assert.equal(allRecent.items[0].user_id, actor); // Admins are not excluded from presence.
    await assert.rejects(rpc('user_data_members_recent', [id(266), '', null]), /ADMIN_REQUIRED/);
    await assert.rejects(rpc('service_activity_touch', [id(999)]), /OWNER_MISMATCH/);
    await db.exec('reset role');
    for (let n = 401; n <= 452; n++) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id(n), `tied${n}@example.test`, JSON.stringify({ name: '동일 시각 검증' })]);
      await db.query("insert into private.user_last_activity values($1,'2026-10-06T00:00:00Z')", [id(n)]);
    }
    for (let n = 501; n <= 551; n++) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id(n), `unknown${n}@example.test`, JSON.stringify({ name: '미접속 검증' })]);
    }
    await db.exec('set role service_role');
    for (const [query, firstId, size] of [['동일 시각 검증', 401, 52], ['미접속 검증', 501, 51]] as const) {
      const firstPage = await rpc<MemberPage>('user_data_members_recent', [actor, query, null]);
      const nextPage = await rpc<MemberPage>('user_data_members_recent', [actor, query, JSON.stringify(firstPage.next_cursor)]);
      assert.deepEqual([...firstPage.items, ...nextPage.items].map(m => m.user_id), Array.from({ length: size }, (_, n) => id(firstId + n)));
      assert.equal(nextPage.next_cursor, null);
    }
    await db.exec('reset role');
    await db.query("insert into private.admission_history(execution_id,user_id,input,analyses,rules_version) values($1,$2,'{}','[]','synthetic')", [id(901), id(451)]);
    await db.query('delete from auth.users where id=$1', [id(451)]);
    assert.equal((await db.query('select * from private.user_last_activity where user_id=$1', [id(451)])).rows.length, 1);
    await db.exec('set role service_role');
    const departed = await rpc<MemberPage>('user_data_members_recent', [actor, id(451), null]);
    assert.equal(departed.items[0].user_id, id(451));
    assert.equal(departed.items[0].is_deleted, true);
    assert.equal(departed.items[0].name, '동일 시각 검증');
    assert.equal(departed.items[0].email, 'tied451@example.test');
    assert.notEqual(departed.items[0].last_seen_at, null);
    await assert.rejects(rpc('service_activity_touch', [id(451)]), /OWNER_MISMATCH/);
    await db.exec('reset role');
    // Auth's role has no access to private tables: only the narrowly scoped trigger can preserve display fields.
    await db.exec('create role synthetic_auth_admin; grant usage on schema auth to synthetic_auth_admin; grant select,update,delete on auth.users to synthetic_auth_admin');
    await db.query('insert into auth.users(id,email,raw_user_meta_data,encrypted_password) values($1,$2,$3,$4)', [id(902), 'retained@example.test', JSON.stringify({ name: '탈퇴 전 이름', birth_date: '2000-01-01', university: '보관 대학' }), 'never-copy-password']);
    await db.exec('set role synthetic_auth_admin');
    await db.query("update auth.users set email='hashed',deleted_at=now() where id=$1", [id(902)]);
    await db.query("update auth.users set raw_user_meta_data='{}' where id=$1", [id(902)]);
    await db.exec('reset role; set role service_role');
    const soft = await rpc<MemberPage>('user_data_members_recent', [actor, 'retained@example.test', null]);
    assert.equal(soft.items[0].is_deleted, true);
    assert.equal(soft.items[0].name, '탈퇴 전 이름');
    assert.equal(soft.items[0].email, 'retained@example.test');
    await assert.rejects(rpc('service_activity_touch', [id(902)]), /OWNER_MISMATCH/);
    await db.exec('reset role;set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(902)]);
    assert.equal((await db.query<{ active: boolean }>('select private.user_data_active_actor() active')).rows[0].active, false);
    await db.exec('reset role;set role service_role');
    await assert.rejects(rpc('user_history_mutate', [id(902), 'history', 'append', JSON.stringify(base)]), /OWNER_MISMATCH/);
    await assert.rejects(rpc('admission_execution_save', [id(902), id(2902), '{}', '[]', 'synthetic']), /OWNER_MISMATCH/);
    await assert.rejects(rpc('product_analytics_ingest', [id(902), '[]', 'retired']), /OWNER_MISMATCH/);
    await assert.rejects(db.exec("insert into private.user_data_member_archive values('00000000-0000-4000-8000-000000009999','forged','forged')"));
    await db.exec('reset role; set role synthetic_auth_admin');
    await db.query('delete from auth.users where id=$1', [id(902)]);
    await db.exec('reset role; set role service_role');
    const archive = (await db.query<Record<string, unknown>>('select * from private.user_data_member_archive where user_id=$1', [id(902)])).rows[0];
    assert.equal(archive.user_id, id(902));
    assert.equal(archive.name, '탈퇴 전 이름');
    assert.equal(archive.email, 'retained@example.test');
    assert.equal(archive.is_deleted, true);
    assert.deepEqual(archive.user_metadata, { name: '탈퇴 전 이름', birth_date: '2000-01-01', university: '보관 대학' });
    assert.equal(JSON.stringify(archive).includes('never-copy-password'), false);
    assert.equal((await rpc<MemberPage>('user_data_members_recent', [actor, 'retained@example.test', null])).items.length, 1);
    await db.exec('reset role');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(rpc('service_activity_touch', [actor]));
      await assert.rejects(rpc('user_data_members_recent', [actor, '', null]));
      await assert.rejects(db.exec('select * from private.user_last_activity'));
      await assert.rejects(db.exec('select * from private.user_data_member_archive'));
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const livingAccount = (await rpc('user_data_read', [actor, target, 'account', 0, null])).items[0] as unknown as Record<string, unknown>;
    const livingChange = await rpc('user_data_prepare', [actor, target, 'account', 'update', '{}', '{"name":"현재 계정 이름"}', livingAccount._snapshot]);
    const livingIntent = await rpc<{ state: string; external: boolean }>('user_data_commit', [actor, livingChange.operation_id, '승인']);
    assert.equal(livingIntent.state, 'executing');
    assert.equal(livingIntent.external, true);
    await rpc('user_data_operation', [actor, livingChange.operation_id, 'succeeded']);
    await db.exec('reset role');
    // Exercise actual owner FKs with both soft and hard Auth deletion. Public
    // content and other members' context must remain byte-for-byte intact.
    const retainedTables = ['grading_notes','chat_profiles','chat_messages','chat_rate_limits',
      'community_posts','community_comments','community_post_likes','community_comment_likes',
      'community_post_reports','community_comment_reports','home_announcement_comments','home_announcement_likes'];
    for (const n of [910, 911, 912]) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id(n), `retention${n}@example.test`, JSON.stringify({ name: `보관 회원 ${n}`, birth_date: '2000-02-02', university: '합성 대학', custom_profile: '보관' })]);
    }
    // Registering a new account through Auth's restricted role also works.
    await db.exec('grant insert on auth.users to synthetic_auth_admin;set role synthetic_auth_admin');
    await db.query('insert into auth.users(id,email) values($1,$2)', [id(913), 'new@example.test']);
    await db.exec('reset role');
    assert.equal((await db.query('select user_id from private.user_data_member_archive where user_id=$1', [id(913)])).rows.length, 1);
    const snapshots = async () => Object.fromEntries(await Promise.all(retainedTables.map(async table => [table,
      (await db.query<{ data: unknown }>(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data from public.${table} t`)).rows[0].data])));
    for (const n of [910, 912]) {
      const owner = id(n), postId = id(n + 100), commentId = id(n + 200), otherComment = id(n + 300);
      await db.query("insert into public.grading_notes(user_id,group_timestamp,year,exam_type,subject,question_no,content) values($1,100,'2026','odd','verbal',1,'보관 메모')", [owner]);
      await db.query("insert into public.chat_profiles(user_id,nickname) values($1,$2)", [owner, `보관 닉네임 ${n}`]);
      await db.query("insert into public.chat_messages(user_id,nickname,content) values($1,$2,'보관 대화')", [owner, `보관 닉네임 ${n}`]);
      await db.query('insert into public.chat_rate_limits values($1,now(),1)', [owner]);
      await db.query("insert into public.community_posts(id,user_id,tag,title,content,image_urls) values($1,$2,'질문','보관 게시글','보관 본문',array[$3])", [postId, owner, `https://example.test/${owner}/retained.png`]);
      await db.query("insert into public.community_comments(id,user_id,post_id,content) values($1,$2,$3,'보관 댓글'),($4,$5,$3,'타인 맥락 댓글')", [commentId, owner, postId, otherComment, id(911)]);
      for (const table of ['community_post_likes','community_post_reports']) await db.query(`insert into public.${table}(post_id,user_id) values($1,$2),($1,$3)`, [postId, owner, id(911)]);
      for (const table of ['community_comment_likes','community_comment_reports']) await db.query(`insert into public.${table}(comment_id,user_id) values($1,$2),($1,$3)`, [commentId, owner, id(911)]);
      await db.query("insert into public.home_announcement_comments(announcement_id,user_id,nickname,content) values($1,$2,'닉네임','보관 공지 댓글')", [id(1200), owner]);
      await db.query('insert into public.home_announcement_likes(announcement_id,user_id) values($1,$2)', [id(1200), owner]);
      await db.query("insert into storage.objects(id,bucket_id,name,owner_id) values($1,'community-post-images',$2,$3)", [id(n + 400), `${owner}/retained.png`, owner]);
      await rpc('user_history_mutate', [owner, 'history', 'append', JSON.stringify(base)]);
      await rpc('user_history_mutate', [owner, 'mock_history', 'append', '{}']);
      await rpc('admission_execution_save', [owner, id(n + 500), '{}', '[]', 'synthetic']);
      await rpc('service_activity_touch', [owner]);
      await rpc('product_analytics_ingest', [owner, JSON.stringify([{ ...event, event_id: id(n + 600), attributes: { ...event.attributes, grading_run_id: id(n + 700) } }]), `retention-actor-${n}`]);
      const before = await snapshots();
      const activeAccount = (await rpc('user_data_read', [actor, owner, 'account', 0, null])).items[0] as unknown as Record<string, unknown>;
      const pending = await rpc('user_data_prepare', [actor, owner, 'account', 'update', '{}', '{"name":"탈퇴 이전 승인"}', activeAccount._snapshot]);
      const externalName = n === 910 ? `보관 회원 ${n}` : '미완료 외부 이름';
      const external = await rpc('user_data_prepare', [actor, owner, 'account', 'update', '{}', JSON.stringify({ name: externalName }), activeAccount._snapshot]);
      assert.equal((await rpc('user_data_commit', [actor, external.operation_id, '승인'])).state, 'executing');
      if (n === 912) {
        await rpc('user_data_operation', [actor, external.operation_id, 'unknown']);
        await db.query("insert into private.admin_roles values($1,'admin')", [owner]);
        await db.query("update auth.users set email='hashed',deleted_at=now(),raw_user_meta_data='{}' where id=$1", [owner]);
        assert.equal((await db.query('select * from private.admin_roles where user_id=$1', [owner])).rows.length, 0);
        await assert.rejects(rpc('user_data_read', [owner, owner, 'account', 0, null]), /ADMIN_REQUIRED/);
        assert.deepEqual(await snapshots(), before);
      }
      await db.exec('set role synthetic_auth_admin');
      await db.query('delete from auth.users where id=$1', [owner]);
      await db.exec('reset role;set role service_role');
      assert.deepEqual(await snapshots(), before);
      const finishedExternal = await rpc<{ state: string; code: string; payload: unknown }>('user_data_operation', [actor, external.operation_id]);
      assert.equal(finishedExternal.state, n === 910 ? 'succeeded' : 'failed');
      assert.equal(finishedExternal.code, n === 910 ? 'WITHDRAWN_NAME_CONFIRMED' : 'ACCOUNT_WITHDRAWN');
      assert.deepEqual(finishedExternal.payload, {});
      assert.equal((await rpc('user_data_operation', [actor, external.operation_id, 'unknown'])).state, finishedExternal.state);
      const account = (await rpc('user_data_read', [actor, owner, 'account', 0, null])).items[0] as unknown as Record<string, unknown>;
      assert.equal(account.name, `보관 회원 ${n}`);
      assert.equal(account.email, `retention${n}@example.test`);
      assert.equal(account.birth_date, '2000-02-02');
      assert.equal(account.university, '합성 대학');
      assert.notEqual(account.created_at, null);
      assert.equal((await rpc('user_data_commit', [actor, pending.operation_id, '승인'])).state, 'conflict');
      for (const domain of ['history','mock_history','notes','admission','usage','storage_images','posts','comments','chat','profile','chat_limits','announcement_comments','announcement_likes']) {
        assert.equal((await rpc('user_data_read', [actor, owner, domain, 0, null])).total, 1, `retained ${domain}`);
      }
      const summary = (await rpc<MemberPage>('user_data_members_recent', [actor, `retention${n}@example.test`, null])).items[0];
      assert.equal(summary.is_deleted, true);
      assert.equal(summary.grading_count, 1);
      assert.equal(summary.mock_count, 1);
      assert.notEqual(summary.last_seen_at, null);
      const nameChange = await rpc('user_data_prepare', [actor, owner, 'account', 'update', '{}', '{"name":"보관 이름 변경"}', account._snapshot]);
      await assert.rejects(rpc('user_data_commit', [actor, nameChange.operation_id, '']), /APPROVAL_REQUIRED/);
      assert.equal((await rpc('user_data_commit', [actor, nameChange.operation_id, '승인'])).state, 'succeeded');
      assert.equal((await rpc('user_data_commit', [actor, nameChange.operation_id, '승인'])).state, 'succeeded');
      assert.equal(((await rpc('user_data_read', [actor, owner, 'account', 0, null])).items[0] as unknown as { name: string }).name, '보관 이름 변경');
      await assert.rejects(rpc('user_data_prepare', [actor, owner, 'account', 'update', '{}', '{"email":"forged@example.test"}', ((await rpc('user_data_read', [actor, owner, 'account', 0, null])).items[0] as unknown as { _snapshot: string })._snapshot]), /INVALID_FIELD/);
      await db.exec('reset role');
    }
    // Reproduce the operational permissive policies as well as the new guard.
    await db.exec(`grant usage on schema public,storage to anon,authenticated;
      grant select on public.community_posts,public.community_comments,public.chat_messages,public.chat_profiles,storage.objects to anon;
      grant select,insert,update,delete on public.grading_notes,public.community_posts,public.community_comments,public.chat_messages,public.chat_profiles,storage.objects to authenticated;
      create policy synthetic_notes_owner on public.grading_notes for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
      create policy synthetic_posts_read on public.community_posts for select using(true);
      create policy synthetic_posts_owner on public.community_posts for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
      create policy synthetic_comments_read on public.community_comments for select using(true);
      create policy synthetic_chat_read on public.chat_messages for select using(true);
      create policy synthetic_profiles_read on public.chat_profiles for select using(true);
      create policy synthetic_images_read on storage.objects for select using(bucket_id='community-post-images');
      create policy synthetic_images_owner on storage.objects for all to authenticated using(split_part(name,'/',1)=auth.uid()::text) with check(split_part(name,'/',1)=auth.uid()::text);`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(911)]);
    await db.exec('set role authenticated');
    assert.equal((await db.query<{ active: boolean }>('select private.user_data_active_actor() active')).rows[0].active, true);
    assert.equal((await db.query('select * from public.community_posts where user_id=$1', [id(910)])).rows.length, 1);
    await db.query("insert into public.grading_notes(user_id,group_timestamp,year,exam_type,subject,question_no,content) values($1,200,'2026','odd','verbal',1,'정상 소유자 쓰기')", [id(911)]);
    await assert.rejects(db.query("insert into public.grading_notes(user_id,group_timestamp,year,exam_type,subject,question_no,content) values($1,200,'2026','odd','verbal',2,'타인 위장')", [id(910)]));
    // Even a still-valid JWT cannot access private notes or mutate retained data.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(910)]);
    assert.equal((await db.query<{ active: boolean }>('select private.user_data_active_actor() active')).rows[0].active, false);
    assert.equal((await db.query('select * from public.grading_notes where user_id=$1', [id(910)])).rows.length, 0);
    assert.equal((await db.query("update public.community_posts set title='forged' where user_id=$1 returning id", [id(910)])).rows.length, 0);
    await assert.rejects(db.query("insert into public.community_posts(user_id,tag,title,content) values($1,'질문','forged','forged')", [id(910)]));
    await assert.rejects(db.query("insert into storage.objects(id,bucket_id,name,owner_id) values($1,'community-post-images',$2,$3)", [id(2000), `${id(910)}/forged.png`, id(910)]));
    assert.equal((await db.query('delete from storage.objects where owner_id=$1 returning id', [id(910)])).rows.length, 0);
    assert.equal((await db.query("update storage.objects set version='forged' where owner_id=$1 returning id", [id(910)])).rows.length, 0);
    await db.exec('reset role;set role anon');
    for (const table of ['community_posts','community_comments','chat_messages','chat_profiles']) assert.equal((await db.query(`select * from public.${table} where user_id=$1`, [id(910)])).rows.length, 1, `public retained ${table}`);
    assert.equal((await db.query('select * from storage.objects where owner_id=$1', [id(910)])).rows.length, 1);
    await db.exec('reset role');
    console.log('탈퇴 보관 SQL: 12개 실제 Auth FK·soft/hard 삭제·타인 댓글/좋아요·계정 상세·승인 충돌/수정·이력/이용/이미지 보존·공개 조회·남은 JWT 접근 차단 통과');
    console.log('최근 이용순 SQL: 전체 정렬·50건 커서·미접속 하단·두 과목 1회·0건·권한·서버 시각·쓰기 제한 통과');
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
