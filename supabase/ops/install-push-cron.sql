-- OPT-IN ONLY: apply separately after approval. Not part of db push.
-- Vault must contain push_dispatch_url and push_dispatch_secret. Never paste secrets here.
-- https://supabase.com/docs/guides/cron/quickstart
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;
create or replace function private.push_wake(p_recovery boolean default false)
returns bigint language plpgsql security invoker set search_path='' as $$
declare destination text; secret text; request_id bigint;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('push-cron-wake',0)) then return null;end if;
 if not exists(select 1 from private.push_worker_slots where lease_until is null or lease_until<=now()) then return null;end if;
 if p_recovery then
  if not exists(select 1 from private.push_deliveries where (state='leased' and lease_until<=now()) or (state in ('pending','retry_wait') and expires_at<=now())) then return null;end if;
 else
  if not (select enabled from private.push_control) then return null;end if;
  if not exists(select 1 from private.push_deliveries d left join private.push_provider_control pc on pc.provider=d.provider and pc.key_id=d.key_id where d.state in ('pending','retry_wait') and d.next_due_at<=now() and not coalesce(pc.blocked,false) and (pc.cooldown_until is null or pc.cooldown_until<=now())) then return null;end if;
 end if;
 select decrypted_secret into destination from vault.decrypted_secrets where name='push_dispatch_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='push_dispatch_secret';
 if destination is distinct from 'https://jkxxtyaanyhmjbdtybkp.supabase.co/functions/v1/push-dispatch/run' or secret is null or length(secret)<43 then raise exception 'push scheduler configuration unavailable';end if;
 select net.http_post(url:=destination,headers:=jsonb_build_object('Content-Type','application/json','x-push-internal',secret),body:='{}'::jsonb,timeout_milliseconds:=5000) into request_id;
 return request_id;
end $$;
revoke all on function private.push_wake(boolean) from public,anon,authenticated,service_role;
-- postgres owns these two jobs and can read Vault. No browser/service-role Vault grant.
select cron.schedule('leet-push-fast-tick','10 seconds',$$select private.push_wake(false)$$);
select cron.schedule('leet-push-recovery','* * * * *',$$select private.push_wake(true)$$);
-- Idle ticks perform SQL only; no Edge/network request without due/recovery work.
-- Disable: select cron.unschedule('leet-push-fast-tick'); select cron.unschedule('leet-push-recovery');
