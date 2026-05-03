-- Secure RLS for cached_quries

create or replace function public.current_user_is_registrar_or_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = auth.uid()::text
      and u.role in ('registrar', 'admin')
      and coalesce(u.is_allowed, true) = true
  )
$$;

revoke execute on function public.current_user_is_registrar_or_admin() from public;
revoke execute on function public.current_user_is_registrar_or_admin() from anon;
grant execute on function public.current_user_is_registrar_or_admin() to authenticated;
grant execute on function public.current_user_is_registrar_or_admin() to service_role;

alter table public.cached_quries enable row level security;

drop policy if exists cached_quries_select_staff_only on public.cached_quries;
create policy cached_quries_select_staff_only
  on public.cached_quries
  for select
  to authenticated
  using (public.current_user_is_registrar_or_admin());

drop policy if exists cached_quries_insert_staff_only on public.cached_quries;
create policy cached_quries_insert_staff_only
  on public.cached_quries
  for insert
  to authenticated
  with check (public.current_user_is_registrar_or_admin());

drop policy if exists cached_quries_update_staff_only on public.cached_quries;
create policy cached_quries_update_staff_only
  on public.cached_quries
  for update
  to authenticated
  using (public.current_user_is_registrar_or_admin())
  with check (public.current_user_is_registrar_or_admin());

drop policy if exists cached_quries_delete_staff_only on public.cached_quries;
create policy cached_quries_delete_staff_only
  on public.cached_quries
  for delete
  to authenticated
  using (public.current_user_is_registrar_or_admin());

