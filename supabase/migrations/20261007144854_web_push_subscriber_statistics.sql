-- Read-only summary. No endpoint, key, account identity, or tracking data is returned.
begin;

create function public.push_subscriber_statistics(p_actor uuid, p_session uuid)
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.push_admin(p_actor);
  if not private.push_session_valid(p_actor, p_session) then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Match the account/status boundary of the 'all subscribers' audience.
  -- Expired login sessions do not revoke a device's service-wide subscription.
  select jsonb_build_object(
    'members', count(distinct s.linked_user_id),
    'devices', count(*),
    'memberDevices', count(*) filter (where s.linked_user_id is not null),
    'anonymousDevices', count(*) filter (where s.linked_user_id is null),
    'queriedAt', statement_timestamp()
  ) into result
  from private.push_subscriptions s
  left join auth.users u on u.id = s.linked_user_id
  where s.status = 'active'
    and (s.linked_user_id is null or (
      u.id is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
    ));

  return result;
end;
$$;

revoke all on function public.push_subscriber_statistics(uuid, uuid) from public, anon, authenticated;
grant execute on function public.push_subscriber_statistics(uuid, uuid) to service_role;

commit;
