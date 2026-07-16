begin;

-- Privacy actions are the only durable marker retained after product data is
-- deleted. The marker is tenant-scoped and never contains workout media.
create table if not exists privacy_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  action text not null check (action in ('account_deleted')),
  idempotency_key text not null,
  manifest jsonb not null,
  completed_at timestamptz not null default now(),
  unique (user_id, action)
);
create index if not exists privacy_action_log_user_completed_idx on privacy_action_log(user_id, completed_at desc);
alter table privacy_action_log enable row level security;
alter table privacy_action_log force row level security;
drop policy if exists privacy_action_log_owner on privacy_action_log;
create policy privacy_action_log_owner on privacy_action_log for all
  using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
  with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

-- Keep a tombstone for deleted Supabase subjects so a later token cannot
-- silently create a fresh product account and resume synchronization.
create or replace function resolve_auth_identity(p_subject text)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid;
begin
  if p_subject is null or length(trim(p_subject)) = 0 or length(p_subject) > 200 then
    raise exception 'subject is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supabase:' || p_subject,0));
  select ai.user_id into v_user_id
    from auth_identities ai
    join users u on u.id = ai.user_id
   where ai.provider='supabase'
     and ai.provider_subject=p_subject
     and u.status='active';
  if v_user_id is null then
    if exists (select 1 from auth_identities where provider='supabase' and provider_subject=p_subject) then
      return;
    end if;
    insert into users default values returning id into v_user_id;
    insert into auth_identities(user_id,provider,provider_subject) values(v_user_id,'supabase',p_subject);
  else
    update auth_identities set last_seen_at=now()
     where provider='supabase' and provider_subject=p_subject;
  end if;
  return query select v_user_id;
end;
$$;
revoke all on function resolve_auth_identity(text) from public;

commit;
