-- Local preparation only. Runtime defaults off; no Cron, remote writes, or deletion.
begin;
create table private.push_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false, campaigns_enabled boolean not null default false,
 max_recipients int not null default 10000 check(max_recipients between 1 and 10000),
 daily_requests int not null default 20000 check(daily_requests>0), storage_limit_bytes bigint not null default 268435456,
 session_timebox_seconds int not null default 0, session_inactivity_seconds int not null default 0,
 next_due_at timestamptz, last_worker_at timestamptz
);
insert into private.push_control(singleton) values(true);
create table private.push_limits (bucket text not null, period timestamptz not null, amount int not null, primary key(bucket,period));
create table private.push_installations (
 id uuid primary key, capability_hash text not null check(length(capability_hash)=64), revision bigint not null default 1,
 latest_request uuid, created_at timestamptz not null default now(), last_seen_at timestamptz not null default now()
);
create table private.push_subscriptions (
 id uuid primary key default gen_random_uuid(), installation_id uuid not null references private.push_installations,
 endpoint_hash text not null, fingerprint text not null, encrypted_data jsonb not null, vapid_key_id text not null,
 revision bigint not null, binding_revision bigint not null default 1,
 status text not null check(status in ('active','disabled')), linked_user_id uuid, linked_session_id uuid,
 disabled_reason text, verified_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 check((linked_user_id is null)=(linked_session_id is null))
);
create unique index push_active_endpoint on private.push_subscriptions(endpoint_hash) where status='active';
create unique index push_active_installation on private.push_subscriptions(installation_id) where status='active';
create index push_subscription_member on private.push_subscriptions(linked_user_id) where status='active';
create table private.push_registration_requests (
 id uuid primary key, installation_id uuid not null references private.push_installations, request_hash text not null,
 endpoint_hash text not null, fingerprint text not null, encrypted_data jsonb not null, vapid_key_id text not null,
 prior_owner_id uuid, revision bigint not null, nonce_hash text not null, status text not null default 'pending' check(status in ('pending','verified','expired','failed')),
 subscription_id uuid references private.push_subscriptions, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes', verified_at timestamptz
);
create index push_registration_install on private.push_registration_requests(installation_id,created_at desc);
create table private.push_drafts (
 id uuid primary key, actor uuid not null, content jsonb not null, revision bigint not null default 1,
 saved_at timestamptz not null default now(), last_campaign_id uuid
);
create index push_draft_actor on private.push_drafts(actor,saved_at desc,id);
create table private.push_previews (
 id uuid primary key, actor uuid not null, token_hash text not null, content jsonb not null,
 content_hash text not null, request_hash text not null, test_id uuid, installation_id uuid,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes', campaign_id uuid,
 candidate_count int not null default 0
);
create table private.push_preview_recipients (
 preview_id uuid not null references private.push_previews, subscription_id uuid not null references private.push_subscriptions,
 subscription_revision bigint not null, binding_revision bigint not null, target_user_id uuid, target_session_id uuid,
 primary key(preview_id,subscription_id)
);
create table private.push_campaigns (
 id uuid primary key, actor uuid not null, idempotency_key uuid not null, request_hash text not null,
 kind text not null check(kind in ('manual','test')), content jsonb not null, content_hash text not null,
 audience text not null check(audience in ('all','members','selected','test')), preview_id uuid, draft_id uuid,
 candidate_count int not null, excluded_before int not null default 0, accepted_count int not null,
 state text not null default 'queued' check(state in ('queued','processing','completed','stopping','stopped')),
 stop_reason text, revision bigint not null default 1, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 unique(actor,idempotency_key)
);
create index push_campaign_history on private.push_campaigns(created_at desc,id);
create index push_campaign_duplicate on private.push_campaigns(content_hash,created_at desc) where kind='manual';
create table private.push_campaign_turns(id uuid primary key,last_dispatch_at timestamptz not null default 'epoch');
create table private.push_campaign_members (campaign_id uuid not null references private.push_campaigns, user_id uuid not null, primary key(campaign_id,user_id));
create table private.push_test_confirmations (
 test_id uuid primary key references private.push_campaigns, actor uuid not null, content_hash text not null,
 installation_id uuid not null, subscription_id uuid not null, subscription_revision bigint not null,
 confirmed_at timestamptz not null default now(), expires_at timestamptz not null
);
create table private.push_deliveries (
 id uuid primary key default gen_random_uuid(), campaign_id uuid references private.push_campaigns,
 registration_id uuid references private.push_registration_requests, subscription_id uuid references private.push_subscriptions,
 subscription_revision bigint not null, binding_revision bigint not null default 0, target_user_id uuid, target_session_id uuid,
 provider text not null, key_id text not null, retry_actor uuid,
 state text not null default 'pending' check(state in ('pending','leased','retry_wait','accepted','failed','unknown','skipped')),
 reason text, next_due_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz,
 current_attempt uuid, attempt_no int not null default 0, external_count int not null default 0,
 expires_at timestamptz not null, updated_at timestamptz not null default now(),
 check((campaign_id is null)<>(registration_id is null)), unique(campaign_id,subscription_id,subscription_revision), unique(registration_id)
);
create index push_delivery_due on private.push_deliveries(next_due_at,id) where state in ('pending','retry_wait');
create index push_delivery_lease on private.push_deliveries(lease_until) where state='leased';
create index push_delivery_campaign on private.push_deliveries(campaign_id);
create table private.push_attempts (
 id uuid primary key, delivery_id uuid not null references private.push_deliveries, number int not null,
 lease_token uuid not null, slot int not null, slot_token uuid not null, requested_by uuid,
 created_at timestamptz not null default now(), unique(delivery_id,number)
);
create table private.push_attempt_events (
 id uuid primary key, attempt_id uuid not null references private.push_attempts, kind text not null check(kind in ('started','result','late','recovered')),
 outcome text, http_status int, reason text, created_at timestamptz not null default now(),
 unique(attempt_id,kind)
);
create table private.push_audit (
 id bigint generated always as identity primary key, actor uuid not null, action text not null,
 entity_id uuid, info jsonb not null default '{}', created_at timestamptz not null default now()
);
create table private.push_receipts (
 principal uuid not null, operation text not null, request_id uuid not null, request_hash text not null,
 result jsonb not null, created_at timestamptz not null default now(), primary key(principal,operation,request_id)
);
create table private.push_worker_slots (id int primary key, token uuid, lease_until timestamptz);
insert into private.push_worker_slots(id) values(1),(2);
create table private.push_provider_control (
 provider text not null, key_id text not null, blocked boolean not null default false, cooldown_until timestamptz,
 reason text, primary key(provider,key_id)
);

do $$declare t text;begin
 for t in select tablename from pg_tables where schemaname='private' and tablename like 'push_%' loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on private.%I to service_role',t);
 end loop;
end $$;
revoke update on private.push_attempts,private.push_attempt_events,private.push_audit,private.push_receipts,private.push_test_confirmations from service_role;
grant usage,select on sequence private.push_audit_id_seq to service_role;
grant usage on schema auth,private to service_role;
grant select(id,email,raw_user_meta_data,deleted_at,banned_until) on auth.users to service_role;
grant select(id,user_id,not_after,created_at,refreshed_at) on auth.sessions to service_role;

create function private.push_hash(p jsonb) returns text language sql immutable security invoker set search_path='' as $$select encode(sha256(convert_to(p::text,'UTF8')),'hex')$$;
create function private.push_content_hash(p jsonb) returns text language sql immutable security invoker set search_path='' as $$select private.push_hash(jsonb_build_array(1,p->>'title',p->>'body',p->>'path'))$$;
create function private.push_user_valid(p uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from auth.users where id=p and deleted_at is null and (banned_until is null or banned_until<=now()))$$;
create function private.push_session_valid(p_user uuid,p_session uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select private.push_user_valid(p_user) and exists(select 1 from auth.sessions s cross join private.push_control c where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>now()) and (c.session_timebox_seconds=0 or s.created_at+make_interval(secs=>c.session_timebox_seconds)>now()) and (c.session_inactivity_seconds=0 or coalesce(s.refreshed_at at time zone 'UTC',s.created_at)+make_interval(secs=>c.session_inactivity_seconds)>now()))
$$;
create function private.push_admin(p uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 if not private.push_user_valid(p) or not exists(select 1 from private.admin_roles where user_id=p and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
end $$;
create function private.push_limit(p_bucket text,p_max int,p_period text default 'hour') returns void language plpgsql security invoker set search_path='' as $$declare n int;begin
 insert into private.push_limits values(p_bucket,date_trunc(p_period,now()),1) on conflict(bucket,period) do update set amount=push_limits.amount+1 returning amount into n;
 if n>p_max then raise exception 'RATE_LIMITED';end if;
end $$;
create function private.push_storage_guard() returns void language plpgsql security invoker set search_path='' as $$declare size bigint;begin
 select sum(pg_total_relation_size(c.oid)) into size from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and c.relname like 'push_%';
 if size>(select storage_limit_bytes from private.push_control) then raise exception 'RATE_LIMITED';end if;
end $$;
create function private.push_require_enabled() returns void language plpgsql security invoker set search_path='' as $$begin
 if not (select enabled from private.push_control) then raise exception 'PUSH_DISABLED';end if;
end $$;
create function private.push_state(p_install uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('installationRevision',i.revision,'bindingRevision',coalesce(s.binding_revision,0),'subscriptionRevision',coalesce(s.revision,0),
 'status',case when r.status='pending' and r.expires_at>now() then 'pending' when r.status='pending' then 'expired' when s.id is not null then s.status else coalesce(r.status,'none') end,
 'subscriptionId',s.id,'requestId',r.id,'linkedUserId',s.linked_user_id,'linkedSessionId',s.linked_session_id))
 from private.push_installations i left join private.push_registration_requests r on r.id=i.latest_request
 left join lateral(select * from private.push_subscriptions where installation_id=i.id order by verified_at desc,id desc limit 1) s on true where i.id=p_install
$$;

create function public.push_subscription_action(p_action text,p_input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i private.push_installations; r private.push_registration_requests; s private.push_subscriptions; owner_id uuid; result jsonb;
 iid uuid:=(p_input->>'installationId')::uuid; req uuid:=(p_input->>'requestId')::uuid; cap text:=p_input->>'capabilityHash'; h text:=p_input->>'requestHash'; receipt private.push_receipts; rev bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('push-install:'||iid,0));
 if p_action='register' then
  perform private.push_require_enabled();perform private.push_storage_guard();
  insert into private.push_installations(id,capability_hash) values(iid,cap) on conflict(id) do nothing;
 end if;
 select * into i from private.push_installations where id=iid for update;
 if not found or i.capability_hash is distinct from cap then raise exception 'REGISTRATION_REQUIRED';end if;
 if p_action='state' then perform private.push_limit('state:'||iid,2400);return private.push_state(iid);end if;
 select * into receipt from private.push_receipts where principal=iid and operation=p_action and request_id=req;
 if found then if receipt.request_hash is distinct from h then raise exception 'CONFLICT';end if;return receipt.result;end if;
 if p_action='register' then
  select * into r from private.push_registration_requests where id=req;
  if found then if r.installation_id<>iid or r.request_hash<>h then raise exception 'CONFLICT';end if;return private.push_state(iid);end if;
  perform private.push_limit('register-ip:'||(p_input->>'rateKey'),50);
  perform private.push_limit('register-install:'||iid,6);
  perform private.push_limit('register-endpoint:'||(p_input->>'endpointHash'),12);
  select id into owner_id from private.push_subscriptions where endpoint_hash=p_input->>'endpointHash' and status='active';
  rev=i.revision+1;
  insert into private.push_registration_requests(id,installation_id,request_hash,endpoint_hash,fingerprint,encrypted_data,vapid_key_id,prior_owner_id,revision,nonce_hash)
   values(req,iid,h,p_input->>'endpointHash',p_input->>'fingerprint',p_input->'encryptedData',p_input->>'keyId',owner_id,rev,p_input->>'nonceHash');
  update private.push_installations set latest_request=req,revision=rev,last_seen_at=now() where id=iid;
  insert into private.push_deliveries(registration_id,subscription_revision,provider,key_id,expires_at) values(req,rev,p_input->>'provider',p_input->>'keyId',now()+interval '10 minutes');
  update private.push_control set next_due_at=now();
 elsif p_action='verify' then
  select * into r from private.push_registration_requests where id=req and installation_id=iid for update;
  if not found or r.nonce_hash is distinct from p_input->>'nonceHash' then raise exception 'REGISTRATION_REQUIRED';end if;
  if r.status='verified' then return private.push_state(iid);end if;
  if r.expires_at<=now() then raise exception 'EXPIRED';end if;
  if r.status<>'pending' or i.latest_request<>r.id or i.revision<>r.revision then raise exception 'CONFLICT';end if;
  perform pg_advisory_xact_lock(hashtextextended('push-endpoint:'||r.endpoint_hash,0));
  select id into owner_id from private.push_subscriptions where endpoint_hash=r.endpoint_hash and status='active' for update;
  if owner_id is distinct from r.prior_owner_id then raise exception 'CONFLICT';end if;
  update private.push_subscriptions set status='disabled',disabled_reason='superseded' where status='active' and (installation_id=iid or endpoint_hash=r.endpoint_hash);
  insert into private.push_subscriptions(installation_id,endpoint_hash,fingerprint,encrypted_data,vapid_key_id,revision,status) values(iid,r.endpoint_hash,r.fingerprint,r.encrypted_data,r.vapid_key_id,r.revision,'active') returning * into s;
  update private.push_registration_requests set status='verified',subscription_id=s.id,verified_at=now() where id=req;
 else
  select * into s from private.push_subscriptions where installation_id=iid order by verified_at desc,id desc limit 1 for update;
  if i.revision is distinct from (p_input->>'installationRevision')::bigint or coalesce(s.binding_revision,0) is distinct from (p_input->>'bindingRevision')::bigint or coalesce(s.revision,0) is distinct from (p_input->>'subscriptionRevision')::bigint then raise exception 'CONFLICT';end if;
  if p_action='bind' then
   if s.status<>'active' or not private.push_session_valid((p_input->>'userId')::uuid,(p_input->>'sessionId')::uuid) then raise exception 'REGISTRATION_REQUIRED';end if;
   if s.linked_user_id is distinct from (p_input->>'userId')::uuid or s.linked_session_id is distinct from (p_input->>'sessionId')::uuid then
    update private.push_subscriptions set linked_user_id=(p_input->>'userId')::uuid,linked_session_id=(p_input->>'sessionId')::uuid,binding_revision=binding_revision+1 where id=s.id;
    update private.push_installations set revision=revision+1 where id=iid;
   end if;
  elsif p_action='detach' then
   if s.linked_user_id is not null then
    update private.push_subscriptions set linked_user_id=null,linked_session_id=null,binding_revision=binding_revision+1 where id=s.id;
    update private.push_installations set revision=revision+1 where id=iid;
   end if;
  elsif p_action='sync' then
   if p_input->>'permission'<>'granted' or (p_input->>'hasSubscription')::boolean=false then
    update private.push_subscriptions set status='disabled',disabled_reason='permission_revoked' where id=s.id;
    update private.push_installations set revision=revision+1 where id=iid;
   elsif s.status='active' and s.fingerprint=p_input->>'fingerprint' then update private.push_subscriptions set last_seen_at=now() where id=s.id;
   elsif s.id is not null then raise exception 'REGISTRATION_REQUIRED';end if;
  else raise exception 'INVALID_INPUT';end if;
 end if;
 result=private.push_state(iid);
 insert into private.push_receipts values(iid,p_action,req,h,result,now());
 return result;
end $$;

create function private.push_validate(p jsonb,p_draft boolean default false) returns void language plpgsql security invoker set search_path='' as $$begin
 if jsonb_typeof(p)<>'object' or jsonb_typeof(p->'title')<>'string' or jsonb_typeof(p->'body')<>'string' or jsonb_typeof(p->'path')<>'string'
 or length(p->>'title')>50 or length(p->>'body')>200 or length(p->>'path')>1000 or p->>'audience' not in ('all','members','selected') or jsonb_typeof(p->'members')<>'array' or jsonb_array_length(p->'members')>100 then raise exception 'INVALID_INPUT';end if;
 if not p_draft and (length(btrim(p->>'title'))=0 or length(btrim(p->>'body'))=0 or (p->>'path') !~ '^(/|/terms|/privacy-policy|/community(/[0-9a-f-]{36})?|/past-exams(\?(year=(2009|201[0-9]|202[0-7])(&|$)|subject=(verbal|reasoning)(&|$)|type=(odd|even)(&|$)){1,3})?)$') then raise exception 'INVALID_INPUT';end if;
end $$;
create function private.push_test_valid(p_actor uuid,p_test uuid,p_hash text,p_install uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.push_test_confirmations t join private.push_subscriptions s on s.id=t.subscription_id where t.test_id=p_test and t.actor=p_actor and t.content_hash=p_hash and t.installation_id=p_install and t.expires_at>now() and s.status='active' and s.revision=t.subscription_revision and s.linked_user_id=p_actor and private.push_session_valid(s.linked_user_id,s.linked_session_id))
$$;
create function private.push_recipient_valid(p_sub uuid,p_rev bigint,p_binding bigint,p_user uuid,p_session uuid,p_audience text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.push_subscriptions s where s.id=p_sub and s.status='active' and s.revision=p_rev and (p_user is null or private.push_user_valid(p_user)) and (s.linked_user_id is null or private.push_user_valid(s.linked_user_id)) and
 (p_audience='all' or (s.binding_revision=p_binding and s.linked_user_id=p_user and s.linked_session_id=p_session and private.push_session_valid(p_user,p_session))))
$$;
create function private.push_duplicates(p_preview uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'actor',actor,'createdAt',created_at,'state',state,'overlap',overlap) order by id),'[]') from (
 select c.id,c.actor,c.created_at,c.state,count(*) overlap from private.push_campaigns c join private.push_deliveries d on d.campaign_id=c.id
 join private.push_preview_recipients r on r.preview_id=p_preview and r.subscription_id=d.subscription_id
 where c.kind='manual' and c.content_hash=(select content_hash from private.push_previews where id=p_preview) and c.created_at>now()-interval '10 minutes' group by c.id
 ) x
$$;
create function private.push_campaign_state(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$declare c private.push_campaigns;counts jsonb;pending_count int;begin
 select * into c from private.push_campaigns where id=p_id for update;if not found then raise exception 'INVALID_INPUT';end if;
 select count(*) filter(where state in ('pending','leased','retry_wait')) into pending_count from private.push_deliveries where campaign_id=p_id;
 if pending_count=0 and c.state not in ('completed','stopped') then update private.push_campaigns set state=case when state='stopping' then 'stopped' else 'completed' end,revision=revision+1 where id=p_id returning * into c;end if;
 select coalesce(jsonb_object_agg(state,n),'{}') into counts from(select state,count(*) n from private.push_deliveries where campaign_id=p_id group by state) a;
 return jsonb_build_object('id',c.id,'kind',c.kind,'title',c.content->>'title','body',c.content->>'body','path',c.content->>'path','audience',c.audience,'state',c.state,'revision',c.revision,'candidateCount',c.candidate_count,'excludedBefore',c.excluded_before,'count',c.accepted_count,'counts',counts,'createdAt',c.created_at,'expiresAt',c.expires_at,'updatedAt',clock_timestamp(),'stopReason',c.stop_reason);
end $$;

create function public.push_admin_action(p_actor uuid,p_action text,p_input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare result jsonb; receipt private.push_receipts; d private.push_drafts; v private.push_previews; c private.push_campaigns; s private.push_subscriptions;
 req uuid:=(p_input->>'requestId')::uuid; h text:=private.push_hash(p_input-'capabilityHash'-'verifiedSessionId'); content jsonb:=p_input->'content'; ch text;
 iid uuid:=(p_input->>'installationId')::uuid; v_id uuid:=(p_input->>'id')::uuid; dup jsonb; total int; eligible int; did uuid;
begin
 perform private.push_admin(p_actor);
 if not private.push_session_valid(p_actor,(p_input->>'verifiedSessionId')::uuid) then raise exception 'AUTH_REQUIRED';end if;
 if p_action in ('draft-save','preview','campaigns','test','test-confirm','stop','retry-unknown') then
  perform pg_advisory_xact_lock(hashtextextended('push-admin:'||p_actor,0));
  select * into receipt from private.push_receipts where principal=p_actor and operation=p_action and request_id=req;
  if found then if receipt.request_hash<>h then raise exception 'CONFLICT';end if;return receipt.result;end if;
 end if;
 if p_action='draft-save' then
  perform private.push_validate(content,true);perform private.push_storage_guard();perform private.push_limit('draft:'||p_actor,120);
  select * into d from private.push_drafts where id=v_id for update;
  if found then
   if d.actor<>p_actor then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
   if d.revision is distinct from (p_input->>'revision')::bigint then raise exception 'CONFLICT';end if;
   update private.push_drafts set content=p_input->'content',revision=revision+1,saved_at=now() where push_drafts.id=v_id;
  else insert into private.push_drafts(id,actor,content) values(v_id,p_actor,content);end if;
  insert into private.push_audit(actor,action,entity_id) values(p_actor,p_action,v_id);
  select jsonb_build_object('id',x.id,'content',x.content,'revision',x.revision,'savedAt',x.saved_at,'lastCampaignId',x.last_campaign_id) into result from private.push_drafts x where x.id=v_id;
 elsif p_action='draft-list' then
  return jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.content->>'title','revision',x.revision,'savedAt',x.saved_at,'lastCampaignId',x.last_campaign_id)),'[]') from (select * from private.push_drafts where actor=p_actor and ((p_input->>'before') is null or saved_at<(p_input->>'before')::timestamptz) order by saved_at desc,id limit 50) x));
 elsif p_action='draft-load' then
  select * into d from private.push_drafts where push_drafts.id=v_id and actor=p_actor;if not found then raise exception 'INVALID_INPUT';end if;
  select coalesce(jsonb_agg(member),'[]') into dup from jsonb_array_elements_text(d.content->'members') member where private.push_user_valid(member::uuid);
  return jsonb_build_object('id',d.id,'content',d.content||jsonb_build_object('members',dup),'revision',d.revision,'removedMembers',jsonb_array_length(d.content->'members')-jsonb_array_length(dup),'lastCampaignId',d.last_campaign_id);
 elsif p_action='members' then
  perform private.push_limit('member-search:'||p_actor,240);
  insert into private.push_audit(actor,action,info) values(p_actor,p_action,jsonb_build_object('purpose','push-selection'));
  return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
   select u.id,left(coalesce(u.raw_user_meta_data->>'name',''),100) name,u.email,(select count(*) from private.push_subscriptions s where s.linked_user_id=u.id and s.status='active' and private.push_session_valid(s.linked_user_id,s.linked_session_id)) subscriptions
   from auth.users u where private.push_user_valid(u.id) and (coalesce(p_input->>'search','')='' or strpos(lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'name','')),lower(p_input->>'search'))>0)
   and ((p_input->>'after') is null or u.id>(p_input->>'after')::uuid) order by u.id limit 50) x));
 elsif p_action in ('test','preview') then
  perform private.push_require_enabled();perform private.push_validate(content);perform private.push_storage_guard();
  ch=private.push_content_hash(content);
  if iid is not null and not exists(select 1 from private.push_installations where push_installations.id=iid and capability_hash=p_input->>'capabilityHash') then raise exception 'REGISTRATION_REQUIRED';end if;
  if p_action='preview' and not (select campaigns_enabled from private.push_control) then raise exception 'PUSH_DISABLED';end if;
  if p_action='test' then
   perform private.push_limit('test:'||p_actor,30);
   select * into s from private.push_subscriptions where installation_id=iid and status='active' and linked_user_id=p_actor and private.push_session_valid(linked_user_id,linked_session_id);
   if not found then raise exception 'REGISTRATION_REQUIRED';end if;
   insert into private.push_campaigns(id,actor,idempotency_key,request_hash,kind,content,content_hash,audience,candidate_count,accepted_count) values(v_id,p_actor,req,h,'test',content,ch,'test',1,1);
   insert into private.push_deliveries(campaign_id,subscription_id,subscription_revision,binding_revision,target_user_id,target_session_id,provider,key_id,expires_at)
    values(v_id,s.id,s.revision,s.binding_revision,s.linked_user_id,s.linked_session_id,s.encrypted_data->>'provider',s.vapid_key_id,now()+interval '24 hours');
   insert into private.push_campaign_turns(id) values(v_id);
   update private.push_control set next_due_at=now();result=private.push_campaign_state(v_id);
  else
   perform private.push_limit('preview:'||p_actor,120);
   if content->>'audience' in ('all','members') and not private.push_test_valid(p_actor,(p_input->>'testId')::uuid,ch,iid) then raise exception 'TEST_REQUIRED';end if;
   if content->>'audience'='selected' and exists(select 1 from jsonb_array_elements_text(content->'members') member where not private.push_user_valid(member::uuid)) then raise exception 'CONFLICT';end if;
   insert into private.push_previews(id,actor,token_hash,content,content_hash,request_hash,test_id,installation_id) values(v_id,p_actor,p_input->>'tokenHash',content,ch,private.push_hash(content),(p_input->>'testId')::uuid,iid);
   insert into private.push_preview_recipients
    select v_id,s.id,s.revision,s.binding_revision,s.linked_user_id,s.linked_session_id from private.push_subscriptions s where s.status='active' and (s.linked_user_id is null or private.push_user_valid(s.linked_user_id)) and
    (content->>'audience'='all' or (private.push_session_valid(s.linked_user_id,s.linked_session_id) and (content->>'audience'='members' or content->'members' ? s.linked_user_id::text)));
   get diagnostics total=row_count;
   if total=0 then raise exception 'NO_RECIPIENTS';end if;if total>(select max_recipients from private.push_control) then raise exception 'RATE_LIMITED';end if;
   update private.push_previews set candidate_count=total where push_previews.id=v_id;
   dup=private.push_duplicates(v_id);
   result=jsonb_build_object('id',v_id,'count',total,'members',(select count(distinct target_user_id) from private.push_preview_recipients where preview_id=v_id),'anonymous',(select count(*) from private.push_preview_recipients where preview_id=v_id and target_user_id is null),'expiresAt',now()+interval '5 minutes','duplicates',dup,'duplicateDigest',private.push_hash(dup));
  end if;
  insert into private.push_audit(actor,action,entity_id) values(p_actor,p_action,v_id);
 elsif p_action='test-confirm' then
  select * into c from private.push_campaigns where push_campaigns.id=v_id and actor=p_actor and kind='test';
  select s1.* into s from private.push_deliveries d1 join private.push_subscriptions s1 on s1.id=d1.subscription_id where d1.campaign_id=v_id and d1.state='accepted' and s1.installation_id=iid and s1.status='active' and s1.revision=d1.subscription_revision;
  if c.id is null or s.id is null or c.expires_at<=now() or not exists(select 1 from private.push_installations where push_installations.id=iid and capability_hash=p_input->>'capabilityHash') or (p_input->>'confirmed')::boolean is distinct from true then raise exception 'TEST_REQUIRED';end if;
  perform private.push_validate(content);if c.content_hash<>private.push_content_hash(content) then raise exception 'TEST_REQUIRED';end if;
  insert into private.push_test_confirmations values(v_id,p_actor,c.content_hash,iid,s.id,s.revision,now(),c.expires_at) on conflict(test_id) do nothing;
  insert into private.push_audit(actor,action,entity_id) values(p_actor,p_action,v_id);result=jsonb_build_object('id',v_id,'confirmed',true,'expiresAt',c.expires_at);
 elsif p_action='campaigns' then
  select * into c from private.push_campaigns where actor=p_actor and idempotency_key=req;
  if found then if c.request_hash<>h then raise exception 'CONFLICT';end if;return private.push_campaign_state(c.id);end if;
  perform private.push_require_enabled();if not (select campaigns_enabled from private.push_control) then raise exception 'PUSH_DISABLED';end if;perform private.push_storage_guard();perform private.push_limit('campaign:'||p_actor,10);
  perform pg_advisory_xact_lock(hashtextextended('push-campaign-submit',0));
  select * into v from private.push_previews where push_previews.id=(p_input->>'previewId')::uuid and actor=p_actor for update;
  if not found or v.token_hash is distinct from p_input->>'tokenHash' then raise exception 'CONFLICT';end if;
  if v.expires_at<=now() then raise exception 'EXPIRED';end if;if v.campaign_id is not null or v.request_hash<>private.push_hash(content) then raise exception 'CONFLICT';end if;
  if content->>'audience' in ('all','members') and not private.push_test_valid(p_actor,v.test_id,v.content_hash,v.installation_id) then raise exception 'TEST_REQUIRED';end if;
  dup=private.push_duplicates(v.id);
  if jsonb_array_length(dup)>0 and (coalesce((p_input->>'duplicateConfirmed')::boolean,false)=false or p_input->>'duplicateDigest' is distinct from private.push_hash(dup)) then
   return jsonb_build_object('code','DUPLICATE_REQUIRED','duplicates',dup,'duplicateDigest',private.push_hash(dup));
  end if;
  select count(*) into eligible from private.push_preview_recipients r where preview_id=v.id and private.push_recipient_valid(r.subscription_id,r.subscription_revision,r.binding_revision,r.target_user_id,r.target_session_id,content->>'audience');
  if eligible=0 then raise exception 'NO_RECIPIENTS';end if;
  did=(p_input->>'draftId')::uuid;if did is not null and not exists(select 1 from private.push_drafts where push_drafts.id=did and actor=p_actor) then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
  insert into private.push_campaigns(id,actor,idempotency_key,request_hash,kind,content,content_hash,audience,preview_id,draft_id,candidate_count,excluded_before,accepted_count)
   values(v_id,p_actor,req,h,'manual',content,v.content_hash,content->>'audience',v.id,did,v.candidate_count,v.candidate_count-eligible,eligible);
  insert into private.push_campaign_turns(id) values(v_id);
  insert into private.push_campaign_members select v_id,member::uuid from jsonb_array_elements_text(content->'members') member;
  insert into private.push_deliveries(campaign_id,subscription_id,subscription_revision,binding_revision,target_user_id,target_session_id,provider,key_id,expires_at)
   select v_id,s.id,r.subscription_revision,r.binding_revision,r.target_user_id,r.target_session_id,s.encrypted_data->>'provider',s.vapid_key_id,now()+interval '24 hours'
   from private.push_preview_recipients r join private.push_subscriptions s on s.id=r.subscription_id where r.preview_id=v.id and private.push_recipient_valid(r.subscription_id,r.subscription_revision,r.binding_revision,r.target_user_id,r.target_session_id,content->>'audience');
  get diagnostics eligible=row_count;update private.push_campaigns set accepted_count=eligible,excluded_before=v.candidate_count-eligible where push_campaigns.id=v_id;
  update private.push_previews set campaign_id=v_id where push_previews.id=v.id;
  update private.push_drafts set last_campaign_id=v_id where push_drafts.id=did;
  update private.push_control set next_due_at=now();insert into private.push_audit(actor,action,entity_id,info) values(p_actor,p_action,v_id,jsonb_build_object('count',eligible));
  result=private.push_campaign_state(v_id);
 elsif p_action='campaign-status' then
  if v_id is null then select c1.id into v_id from private.push_campaigns c1 where c1.actor=p_actor and c1.idempotency_key=(p_input->>'idempotencyKey')::uuid;end if;
  if v_id is null then return jsonb_build_object('found',false);end if;return private.push_campaign_state(v_id);
 elsif p_action='campaign-history' then
  return jsonb_build_object('items',(select coalesce(jsonb_agg(private.push_campaign_state(x.id)),'[]') from(select id from private.push_campaigns where ((p_input->>'before') is null or created_at<(p_input->>'before')::timestamptz) and ((p_input->>'since') is null or created_at>=(p_input->>'since')::timestamptz) order by created_at desc,id limit 50) x));
 elsif p_action in ('stop','retry-unknown') then
  select * into c from private.push_campaigns where push_campaigns.id=v_id for update;if not found then raise exception 'INVALID_INPUT';end if;
  if c.revision is distinct from (p_input->>'revision')::bigint then raise exception 'CONFLICT';end if;
  if p_action='stop' then
   update private.push_campaigns set state='stopping',stop_reason='administrator',revision=revision+1 where push_campaigns.id=v_id;
   update private.push_deliveries set state='skipped',reason='stopped',updated_at=now() where campaign_id=v_id and state in ('pending','retry_wait');
  else
   perform private.push_require_enabled();if c.state in ('stopping','stopped') or c.expires_at<=now() or (p_input->>'confirmed')::boolean is distinct from true then raise exception 'CONFLICT';end if;
   perform private.push_limit('retry:'||p_actor,30);
   update private.push_deliveries set state='pending',next_due_at=now(),reason='manual_unknown_retry',retry_actor=p_actor,updated_at=now() where campaign_id=v_id and state='unknown' and external_count<3;
   if not found then raise exception 'CONFLICT';end if;
   update private.push_campaigns set state='processing',revision=revision+1 where push_campaigns.id=v_id;
   update private.push_control set next_due_at=now();
  end if;
  insert into private.push_audit(actor,action,entity_id) values(p_actor,p_action,v_id);result=private.push_campaign_state(v_id);
 else raise exception 'INVALID_INPUT';end if;
 if req is not null then insert into private.push_receipts values(p_actor,p_action,req,h,result,now());end if;
 return result;
end $$;

create function public.push_worker_action(p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
<<worker>>
declare slot private.push_worker_slots; d private.push_deliveries; c private.push_campaigns; r private.push_registration_requests;
 a private.push_attempts; attempt uuid; token uuid; output jsonb:='[]'; reason text; outcome text; begin_time timestamptz:=clock_timestamp();
 started boolean; next_time timestamptz; report jsonb;
begin
 if p_action='claim' then
  if not pg_try_advisory_xact_lock(hashtextextended('push-claim-turns',0)) then return jsonb_build_object('jobs','[]'::jsonb);end if;
  -- Recover a lost worker before leasing. Started calls become unknown; never silently resend.
  for d in select * from private.push_deliveries where state='leased' and lease_until<=begin_time order by lease_until for update skip locked limit 100 loop
   started=exists(select 1 from private.push_attempt_events where attempt_id=d.current_attempt and kind='started');
   update private.push_deliveries set state=case when started then 'unknown' else 'pending' end,reason=case when started then 'lease_expired_after_start' else null end,lease_token=null,lease_until=null,next_due_at=now(),updated_at=now() where id=d.id;
   insert into private.push_attempt_events(id,attempt_id,kind,outcome,reason) values(gen_random_uuid(),d.current_attempt,'recovered',case when started then 'unknown' else 'pending' end,'lease_expired') on conflict(attempt_id,kind) do nothing;
   if d.campaign_id is not null then perform private.push_campaign_state(d.campaign_id);end if;
  end loop;
  -- Expired/stopped unstarted work is finalized even while external dispatch is disabled.
  update private.push_deliveries d1 set state='skipped',reason='expired_or_stopped',updated_at=now() where d1.state in ('pending','retry_wait') and (d1.expires_at<=now() or exists(select 1 from private.push_campaigns c1 where c1.id=d1.campaign_id and c1.state in ('stopping','stopped')));
  if coalesce((p_input->>'recoveryOnly')::boolean,false) or not (select enabled from private.push_control) then return jsonb_build_object('jobs','[]'::jsonb);end if;
  if p_input->>'slotToken' is null then
   select * into slot from private.push_worker_slots where lease_until is null or lease_until<=begin_time order by id for update skip locked limit 1;
   if not found then return jsonb_build_object('jobs','[]'::jsonb);end if;
   token=gen_random_uuid();update private.push_worker_slots set token=worker.token,lease_until=begin_time+interval '60 seconds' where id=slot.id;
  else
   token=(p_input->>'slotToken')::uuid;
   select * into slot from private.push_worker_slots where id=(p_input->>'slot')::int and push_worker_slots.token=worker.token and lease_until>begin_time for update;
   if not found then raise exception 'CONFLICT';end if;
  end if;
  for d in select d1.* from private.push_deliveries d1 left join private.push_provider_control pc on pc.provider=d1.provider and pc.key_id=d1.key_id
   where d1.state in ('pending','retry_wait') and d1.next_due_at<=begin_time and d1.expires_at>begin_time and not coalesce(pc.blocked,false) and (pc.cooldown_until is null or pc.cooldown_until<=begin_time)
   order by coalesce((select last_dispatch_at from private.push_campaign_turns where id=d1.campaign_id),'epoch'::timestamptz), d1.next_due_at, d1.attempt_no, d1.id for update of d1 skip locked limit 5 loop
   attempt=gen_random_uuid();
   update private.push_deliveries set state='leased',lease_token=gen_random_uuid(),lease_until=begin_time+interval '60 seconds',current_attempt=attempt,attempt_no=attempt_no+1,updated_at=begin_time where id=d.id returning * into d;
   insert into private.push_attempts(id,delivery_id,number,lease_token,slot,slot_token,requested_by) values(attempt,d.id,d.attempt_no,d.lease_token,slot.id,token,coalesce(d.retry_actor,(select actor from private.push_campaigns where id=d.campaign_id)));
   if d.registration_id is not null then
    select * into r from private.push_registration_requests where id=d.registration_id;
    report=jsonb_build_object('encryptedData',r.encrypted_data,'installationId',r.installation_id,'requestId',r.id,'fingerprint',r.fingerprint,'revision',r.revision,'registration',true);
   else
    select * into c from private.push_campaigns where id=d.campaign_id;
    update private.push_campaign_turns set last_dispatch_at=begin_time where id=d.campaign_id;
    select jsonb_build_object('encryptedData',s.encrypted_data,'content',c.content,'registration',false) into report from private.push_subscriptions s where s.id=d.subscription_id;
    -- Campaign state changes at start, after the lease transaction has committed.
   end if;
   output=output||jsonb_build_array(report||jsonb_build_object('id',d.id,'attemptId',attempt,'leaseToken',d.lease_token,'keyId',d.key_id,'provider',d.provider,'externalCount',d.external_count,'expiresAt',d.expires_at));
  end loop;
  update private.push_control set last_worker_at=begin_time;
  return jsonb_build_object('slot',slot.id,'slotToken',token,'jobs',output);
 elsif p_action in ('start','finish','release','pause') then
  select * into d from private.push_deliveries where id=(p_input->>'id')::uuid for update;
  select * into a from private.push_attempts where id=(p_input->>'attemptId')::uuid and delivery_id=d.id;
  if d.id is null or a.id is null or a.lease_token is distinct from (p_input->>'leaseToken')::uuid then raise exception 'CONFLICT';end if;
  started=exists(select 1 from private.push_attempt_events where attempt_id=a.id and kind='started');
  if p_action='finish' then
   if not started then raise exception 'CONFLICT';end if;
   outcome=p_input->>'outcome';if outcome not in ('accepted','failed','unknown','retry_wait') then raise exception 'INVALID_INPUT';end if;
   if d.current_attempt<>a.id or d.state<>'leased' or d.lease_token<>a.lease_token or d.lease_until<=begin_time then
    insert into private.push_attempt_events(id,attempt_id,kind,outcome,http_status,reason) values(gen_random_uuid(),a.id,'late',outcome,(p_input->>'httpStatus')::int,p_input->>'reason') on conflict(attempt_id,kind) do nothing;
    return jsonb_build_object('late',true);
   end if;
   insert into private.push_attempt_events(id,attempt_id,kind,outcome,http_status,reason) values(gen_random_uuid(),a.id,'result',outcome,(p_input->>'httpStatus')::int,p_input->>'reason') on conflict(attempt_id,kind) do nothing;
   next_time=begin_time+make_interval(secs=>greatest(5,least(86400,coalesce((p_input->>'retrySeconds')::int,30))));
   if outcome='retry_wait' and next_time>=d.expires_at then outcome='skipped';elsif outcome='retry_wait' and d.external_count>=3 then outcome='failed';end if;
   update private.push_deliveries set state=outcome,reason=p_input->>'reason',next_due_at=next_time,lease_token=null,lease_until=null,updated_at=begin_time where id=d.id;
   if (p_input->>'httpStatus')::int in (404,410) and d.subscription_id is not null then update private.push_subscriptions set status='disabled',disabled_reason='provider_expired' where id=d.subscription_id and revision=d.subscription_revision;end if;
   if (p_input->>'httpStatus')::int in (401,403,429) then
    insert into private.push_provider_control(provider,key_id,blocked,cooldown_until,reason) values(d.provider,d.key_id,(p_input->>'httpStatus')::int in (401,403),next_time,p_input->>'reason')
    on conflict(provider,key_id) do update set blocked=push_provider_control.blocked or excluded.blocked,cooldown_until=greatest(push_provider_control.cooldown_until,excluded.cooldown_until),reason=excluded.reason;
   end if;
   if d.campaign_id is not null then perform private.push_campaign_state(d.campaign_id);end if;
   return jsonb_build_object('state',outcome);
  end if;
  if d.current_attempt<>a.id or d.state<>'leased' or d.lease_token<>a.lease_token or d.lease_until<=begin_time or not exists(select 1 from private.push_worker_slots where id=a.slot and token=a.slot_token and lease_until>begin_time) then raise exception 'CONFLICT';end if;
  if p_action in ('release','pause') then
   if p_action='pause' then insert into private.push_provider_control(provider,key_id,blocked,reason) values(d.provider,d.key_id,true,'prepare_configuration') on conflict(provider,key_id) do update set blocked=true,reason='prepare_configuration';end if;
   if started then raise exception 'CONFLICT';end if;
   update private.push_deliveries set state='pending',lease_token=null,lease_until=null,updated_at=begin_time where id=d.id;
   return jsonb_build_object('released',true);
  end if;
  if started then raise exception 'CONFLICT';end if;
  if not (select enabled from private.push_control) then reason='disabled';
  elsif d.expires_at<=begin_time then reason='expired';
  elsif d.external_count>=3 then reason='attempt_limit';
  elsif exists(select 1 from private.push_provider_control where provider=d.provider and key_id=d.key_id and (blocked or cooldown_until>begin_time)) then reason='provider_paused';
  elsif d.registration_id is not null then
   select * into r from private.push_registration_requests where id=d.registration_id for update;
   if r.status<>'pending' or r.expires_at<=begin_time or not exists(select 1 from private.push_installations where id=r.installation_id and latest_request=r.id and revision=r.revision) then reason='registration_changed';end if;
  else
   select * into c from private.push_campaigns where id=d.campaign_id for update;
   if c.state in ('stopping','stopped') then reason='stopped';
   elsif not private.push_user_valid(c.actor) or not exists(select 1 from private.admin_roles where user_id=c.actor and role='admin') then
    reason='actor_revoked';update private.push_campaigns set state='stopping',stop_reason=reason,revision=revision+1 where id=c.id;
   elsif not private.push_recipient_valid(d.subscription_id,d.subscription_revision,d.binding_revision,d.target_user_id,d.target_session_id,c.audience) then reason='recipient_changed';
   elsif c.state='queued' then update private.push_campaigns set state='processing',revision=revision+1 where id=c.id;end if;
  end if;
  if reason is not null then
   update private.push_deliveries set state=case when reason in ('disabled','provider_paused') then 'pending' else 'skipped' end,reason=worker.reason,lease_token=null,lease_until=null,next_due_at=begin_time+interval '30 seconds',updated_at=begin_time where id=d.id;
   if d.campaign_id is not null then perform private.push_campaign_state(d.campaign_id);end if;
   return jsonb_build_object('allowed',false,'reason',reason);
  end if;
  begin
   perform private.push_limit('external-global',(select daily_requests from private.push_control),'day');
  exception when raise_exception then
   if sqlerrm<>'RATE_LIMITED' then raise;end if;
   update private.push_deliveries set state='retry_wait',reason='daily_quota',next_due_at=date_trunc('day',now())+interval '1 day',lease_token=null,lease_until=null where id=d.id;
   return jsonb_build_object('allowed',false,'reason','daily_quota');
  end;
  insert into private.push_attempt_events(id,attempt_id,kind) values(gen_random_uuid(),a.id,'started');
  update private.push_deliveries set external_count=external_count+1 where id=d.id;
  return jsonb_build_object('allowed',true);
 elsif p_action='close' then
  update private.push_worker_slots set token=null,lease_until=null where id=(p_input->>'slot')::int and token=(p_input->>'slotToken')::uuid;
  update private.push_control set next_due_at=(select min(next_due_at) from private.push_deliveries where state in ('pending','retry_wait'));
  return jsonb_build_object('closed',true);
 elsif p_action='metrics' then
  return jsonb_build_object('enabled',(select enabled from private.push_control),'campaignsEnabled',(select campaigns_enabled from private.push_control),'lastWorkerAt',(select last_worker_at from private.push_control),'backlog',(select count(*) from private.push_deliveries where state in ('pending','retry_wait','leased')),'oldestDueAt',(select min(next_due_at) from private.push_deliveries where state in ('pending','retry_wait')),'storageBytes',(select sum(pg_total_relation_size(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and c.relname like 'push_%'));
 else raise exception 'INVALID_INPUT';end if;
end $$;

do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'push_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
commit;
