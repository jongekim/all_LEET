-- The table is intentionally private. This policy documents and enforces that
-- authenticated browser clients cannot query or alter role assignments.
drop policy if exists admin_roles_direct_access_denied on private.admin_roles;
create policy admin_roles_direct_access_denied
on private.admin_roles
as restrictive
for all
to authenticated
using (false)
with check (false);
