create or replace function public.claim_anonymous_todos(anonymous_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  migrated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if anonymous_user_id is null then
    raise exception 'Anonymous user id is required.';
  end if;

  if anonymous_user_id = auth.uid() then
    return 0;
  end if;

  if not exists (
    select 1
    from auth.users
    where id = anonymous_user_id
      and raw_app_meta_data ->> 'provider' = 'anonymous'
  ) then
    raise exception 'Source user is not an anonymous account.';
  end if;

  update public.todos
  set user_id = auth.uid()
  where user_id = anonymous_user_id;

  get diagnostics migrated_count = row_count;
  return migrated_count;
end;
$$;

revoke all on function public.claim_anonymous_todos(uuid) from public;
grant execute on function public.claim_anonymous_todos(uuid) to authenticated;
