import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const admin = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002",
  session = "00000000-0000-4000-8000-000000000003";
const newId = () => crypto.randomUUID();
async function main() {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema auth;
 create table private.admin_roles(user_id uuid,role text);grant select on private.admin_roles to service_role;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz,refreshed_at timestamp);
 insert into auth.users values('${admin}','admin@example.invalid','{}',null,null),('${member}','member@example.invalid','{}',null,null);
 insert into private.admin_roles values('${admin}','admin');insert into auth.sessions values('${session}','${admin}',null,now(),now());
 alter default privileges in schema public grant all on tables to anon,authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261007044858_web_push_notifications.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(await readFile(new URL(
      "../supabase/migrations/20261007141129_web_push_safe_updates.sql",
      import.meta.url,
    ), "utf8"));
    await db.exec("update private.push_control set enabled=true,campaigns_enabled=true where singleton");
    const role = async (name = "service_role") => {
      await db.exec("reset role");
      await db.exec(`set role ${name}`);
    };
    await role();
    const call = async (name: string, args: unknown[]) =>
      (await db.query<{ value: Record<string, unknown> }>(
        `select public.${name}(${
          args.map((_, i) => "$" + (i + 1)).join(",")
        }) value`,
        args,
      )).rows[0].value;
    const sub = (action: string, input: unknown) =>
      call("push_subscription_action", [action, JSON.stringify(input)]);
    const adm = (action: string, input: unknown, actor = admin) =>
      call("push_admin_action", [
        actor,
        action,
        JSON.stringify({
          ...input as Record<string, unknown>,
          verifiedSessionId: session,
        }),
      ]);
    const worker = (action: string, input: unknown = {}) =>
      call("push_worker_action", [action, JSON.stringify(input)]);
    const install = newId(),
      register = newId(),
      cap = "a".repeat(64),
      endpoint = "e".repeat(64),
      proof = { installationId: install, capabilityHash: cap };
    const input = {
      ...proof,
      requestId: register,
      requestHash: "register",
      endpointHash: endpoint,
      fingerprint: "f".repeat(64),
      keyId: "v1",
      provider: "fcm.googleapis.com",
      rateKey: "ip1",
      nonceHash: "n".repeat(64),
      encryptedData: { provider: "fcm.googleapis.com", ciphertext: "example" },
    };
    const pending = await sub("register", input);
    assert.equal(pending.status, "pending");
    assert.equal(
      (await sub("register", input)).installationRevision,
      pending.installationRevision,
    );
    const attacker = newId();
    await sub("register", {
      ...input,
      installationId: attacker,
      requestId: newId(),
      capabilityHash: "b".repeat(64),
      rateKey: "ip2",
    }); // pending does not reserve endpoint ownership.
    const active = await sub("verify", {
      ...proof,
      requestId: register,
      requestHash: "verify",
      nonceHash: input.nonceHash,
    });
    assert.equal(active.status, "active");
    assert.equal(
      (await sub("verify", {
        ...proof,
        requestId: register,
        requestHash: "verify",
        nonceHash: input.nonceHash,
      })).subscriptionId,
      active.subscriptionId,
    );
    const bindInput = {
      ...proof,
      requestId: newId(),
      requestHash: "bind",
      installationRevision: active.installationRevision,
      bindingRevision: active.bindingRevision,
      subscriptionRevision: active.subscriptionRevision,
      userId: admin,
      sessionId: session,
    };
    const bound = await sub("bind", bindInput);
    assert.equal(bound.linkedUserId, admin);
    await assert.rejects(
      sub("detach", {
        ...bindInput,
        requestId: newId(),
        requestHash: "detach",
      }),
      /CONFLICT/,
    );
    const same = await sub("bind", {
      ...bindInput,
      requestId: newId(),
      requestHash: "same",
      installationRevision: bound.installationRevision,
      bindingRevision: bound.bindingRevision,
    });
    assert.equal(same.bindingRevision, bound.bindingRevision);
    const content = {
      title: "안내",
      body: "서비스 안내입니다.",
      path: "/past-exams",
      audience: "all",
      members: [],
    };
    const draftId = newId(),
      draft = await adm("draft-save", {
        id: draftId,
        requestId: newId(),
        content,
      });
    assert.equal(draft.revision, 1);
    const updated = await adm("draft-save", {
      id: draftId,
      requestId: newId(),
      revision: 1,
      content: { ...content, title: "새 제목" },
    });
    assert.equal(updated.revision, 2);
    assert.equal((await adm("draft-load", { id: draftId })).revision, 2);
    await assert.rejects(
      adm("draft-save", {
        id: draftId,
        requestId: newId(),
        revision: 1,
        content,
      }),
      /CONFLICT/,
    );
    await assert.rejects(
      adm("draft-load", { id: draftId }, member),
      /ADMIN_REQUIRED/,
    );
    const testId = newId();
    await adm("test", { id: testId, requestId: newId(), content, ...proof });
    await assert.rejects(
      adm("preview", {
        id: newId(),
        requestId: newId(),
        content,
        ...proof,
        tokenHash: "token",
      }),
      /TEST_REQUIRED/,
    );
    // All claim/start/result calls exercise actual SQL fencing, including registration jobs.
    for (let n = 0; n < 3; n++) {
      const batch = await worker("claim") as {
        slot: number;
        slotToken: string;
        jobs: Array<Record<string, unknown>>;
      };
      for (const job of batch.jobs) {
        const lease = {
          id: job.id,
          attemptId: job.attemptId,
          leaseToken: job.leaseToken,
        };
        const permission = await worker("start", lease);
        if (permission.allowed) {
          await worker("finish", {
            ...lease,
            outcome: "accepted",
            httpStatus: 201,
            reason: "provider_accepted",
          });
        }
      }
      if (batch.slotToken) {
        await worker("close", { slot: batch.slot, slotToken: batch.slotToken });
      }
    }
    const confirmed = await adm("test-confirm", {
      id: testId,
      requestId: newId(),
      content,
      ...proof,
      confirmed: true,
    });
    assert.equal(confirmed.confirmed, true);
    const previewId = newId(),
      preview = await adm("preview", {
        id: previewId,
        requestId: newId(),
        content,
        ...proof,
        testId,
        tokenHash: "token",
      });
    assert.equal(preview.count, 1);
    const campaignInput = {
      id: newId(),
      requestId: newId(),
      content,
      previewId,
      tokenHash: "token",
      duplicateDigest: preview.duplicateDigest,
    };
    const campaign = await adm("campaigns", campaignInput);
    assert.equal(campaign.count, 1);
    assert.equal((await adm("campaigns", campaignInput)).id, campaign.id);
    const batch = await worker("claim") as {
      slot: number;
      slotToken: string;
      jobs: Array<Record<string, unknown>>;
    };
    assert.equal(batch.jobs.length, 1);
    const job = batch.jobs[0],
      lease = {
        id: job.id,
        attemptId: job.attemptId,
        leaseToken: job.leaseToken,
      };
    await worker("start", lease);
    await assert.rejects(worker("start", lease), /CONFLICT/);
    await worker("finish", { ...lease, outcome: "unknown", reason: "timeout" });
    assert.equal(
      ((await adm("campaign-status", { id: campaign.id })).counts as Record<
        string,
        number
      >).unknown,
      1,
    );
    const status = await adm("campaign-status", { id: campaign.id });
    await adm("retry-unknown", {
      id: campaign.id,
      requestId: newId(),
      revision: status.revision,
      confirmed: true,
    });
    await worker("finish", {
      ...lease,
      outcome: "accepted",
      httpStatus: 201,
      reason: "late",
    });
    assert.equal(
      ((await adm("campaign-status", { id: campaign.id })).counts as Record<
        string,
        number
      >).pending,
      1,
    );
    const again = await worker("claim", {
      slot: batch.slot,
      slotToken: batch.slotToken,
    }) as { jobs: Array<Record<string, unknown>> };
    assert.equal(again.jobs.length, 1);
    const beforeStop = await adm("campaign-status", { id: campaign.id });
    await adm("stop", {
      id: campaign.id,
      requestId: newId(),
      revision: beforeStop.revision,
    });
    const blocked = await worker("start", {
      id: again.jobs[0].id,
      attemptId: again.jobs[0].attemptId,
      leaseToken: again.jobs[0].leaseToken,
    });
    assert.equal(blocked.allowed, false);
    assert.equal(
      (await adm("campaign-status", { id: campaign.id })).state,
      "stopped",
    );
    await assert.rejects(
      adm("draft-save", { id: draftId, requestId: newId(), content }),
      /CONFLICT/,
    );
    await assert.rejects(
      adm("preview", {
        id: newId(),
        requestId: newId(),
        content: { ...content, title: "다른 내용" },
        ...proof,
        testId,
        tokenHash: "different",
      }),
      /TEST_REQUIRED/,
    );
    await assert.rejects(
      sub("state", { ...proof, capabilityHash: "wrong" }),
      /REGISTRATION_REQUIRED/,
    );
    await db.exec("reset role");
    await db.exec(
      `update auth.sessions set not_after=now()-interval '1 second' where id='${session}'`,
    );
    await role();
    await assert.rejects(adm("draft-list", {}), /AUTH_REQUIRED/);
    await db.exec("reset role");
    await db.exec(
      `update auth.sessions set not_after=null where id='${session}'`,
    );
    await role();
    async function seedRecipients(from: number, to: number) {
      await db.exec(
        `with installations as (insert into private.push_installations(id,capability_hash) select gen_random_uuid(),repeat('c',64) from generate_series(${from},${to}) returning id)
       insert into private.push_subscriptions(installation_id,endpoint_hash,fingerprint,encrypted_data,vapid_key_id,revision,status)
       select id,encode(sha256(convert_to(id::text,'UTF8')),'hex'),repeat('f',64),'{"provider":"fcm.googleapis.com","ciphertext":"synthetic-only"}','v1',1,'active' from installations`,
      );
    }
    await seedRecipients(1, 999);
    const startedAt = performance.now(),
      smallId = newId(),
      small = await adm("preview", {
        id: smallId,
        requestId: newId(),
        content,
        ...proof,
        testId,
        tokenHash: "small",
      });
    assert.equal(small.count, 1000);
    await seedRecipients(1000, 9999);
    const bulkId = newId(),
      bulk = await adm("preview", {
        id: bulkId,
        requestId: newId(),
        content,
        ...proof,
        testId,
        tokenHash: "bulk",
      });
    assert.equal(bulk.count, 10000);
    // Snapshot additions are forbidden; one later revocation only reduces the frozen 1,000.
    await db.exec(
      `update private.push_subscriptions set status='disabled' where id=(select subscription_id from private.push_preview_recipients where preview_id='${smallId}' and target_user_id is null limit 1)`,
    );
    const smallCampaign = await adm("campaigns", {
      id: newId(),
      requestId: newId(),
      content,
      previewId: smallId,
      tokenHash: "small",
      duplicateDigest: small.duplicateDigest,
      duplicateConfirmed: true,
    });
    assert.equal(smallCampaign.count, 999);
    assert.equal(smallCampaign.excludedBefore, 1);
    const bulkInput = {
      id: newId(),
      requestId: newId(),
      content,
      previewId: bulkId,
      tokenHash: "bulk",
      duplicateDigest: bulk.duplicateDigest,
      duplicateConfirmed: true,
    };
    const duplicateChanged = await adm("campaigns", bulkInput);
    assert.equal(duplicateChanged.code, "DUPLICATE_REQUIRED");
    const bulkCampaign = await adm("campaigns", {
      ...bulkInput,
      duplicateDigest: duplicateChanged.duplicateDigest,
    });
    assert.equal(bulkCampaign.count, 9999);
    console.log(
      `Synthetic PostgreSQL 1,000/10,000 candidate snapshots and reduced submission: ${
        Math.round(performance.now() - startedAt)
      }ms (not an Edge throughput benchmark)`,
    );
    await worker("close", { slot: batch.slot, slotToken: batch.slotToken });
    const turn1 = await worker("claim") as {
      slot: number;
      slotToken: string;
      jobs: Array<Record<string, unknown>>;
    };
    assert.equal(turn1.jobs.length, 5);
    const turn2 = await worker("claim") as {
      slot: number;
      slotToken: string;
      jobs: Array<Record<string, unknown>>;
    };
    assert.equal(turn2.jobs.length, 5);
    const ids1 = turn1.jobs.map((j) => j.id),
      ids2 = turn2.jobs.map((j) => j.id);
    const campaignsFor = async (ids: unknown[]) =>
      new Set(
        (await db.query<{ campaign_id: string }>(
          "select campaign_id from private.push_deliveries where id=any($1::uuid[])",
          [ids],
        )).rows.map((x) => x.campaign_id),
      );
    assert.equal((await campaignsFor(ids1)).size, 1);
    assert.equal((await campaignsFor(ids2)).size, 1);
    assert.notDeepEqual(await campaignsFor(ids1), await campaignsFor(ids2));
    const unknownLease = {
      id: turn1.jobs[0].id,
      attemptId: turn1.jobs[0].attemptId,
      leaseToken: turn1.jobs[0].leaseToken,
    };
    await worker("start", unknownLease);
    await db.exec("reset role");
    await db.exec(
      `update private.push_deliveries set lease_until=now()-interval '1 second' where id='${unknownLease.id}'`,
    );
    await role();
    await worker("claim", { recoveryOnly: true });
    assert.equal(
      (await db.query<{ state: string }>(
        "select state from private.push_deliveries where id=$1",
        [unknownLease.id],
      )).rows[0].state,
      "unknown",
    );
    await worker("finish", {
      ...unknownLease,
      outcome: "accepted",
      httpStatus: 201,
      reason: "late",
    });
    assert.equal(
      (await db.query<{ state: string }>(
        "select state from private.push_deliveries where id=$1",
        [unknownLease.id],
      )).rows[0].state,
      "unknown",
    );
    // Admin withdrawal before a leased external call prevents provider start.
    await db.exec("reset role");
    await db.exec(`delete from private.admin_roles where user_id='${admin}'`);
    await role();
    const revoked = await worker("start", {
      id: turn2.jobs[0].id,
      attemptId: turn2.jobs[0].attemptId,
      leaseToken: turn2.jobs[0].leaseToken,
    });
    assert.equal(revoked.allowed, false);
    assert.equal(revoked.reason, "actor_revoked");
    await db.exec("reset role");
    await db.exec(`insert into private.admin_roles values('${admin}','admin')`);
    await role();
    for (const name of ["anon", "authenticated"]) {
      await role(name);
      await assert.rejects(sub("state", proof));
      await assert.rejects(
        db.query("select * from private.push_subscriptions"),
      );
      await assert.rejects(adm("members", { search: "" }));
    }
    await role();
    await assert.rejects(db.query("delete from private.push_audit"));
    await assert.rejects(
      db.query("update private.push_attempt_events set reason=reason"),
    );
    console.log(
      "푸시 SQL 검증 통과: 등록 선점·ACK 멱등, 연결 CAS, 초안 격리/충돌, 필수 테스트, 원자 접수, lease·늦은 결과·중단, private 권한",
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
