create extension if not exists pgcrypto;

create table if not exists users (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create table if not exists auth_identities (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, provider text not null, provider_subject text not null, created_at timestamptz not null default now(), unique(provider, provider_subject));
create table if not exists profiles (user_id uuid primary key references users(id) on delete cascade, display_name text not null default '', locale text not null default 'id-ID', goals jsonb not null default '[]', equipment jsonb not null default '[]', limitations jsonb not null default '[]', schedule jsonb not null default '{}', updated_at timestamptz not null default now());
create table if not exists consents (user_id uuid not null references users(id) on delete cascade, consent_type text not null, version text not null, granted_at timestamptz not null default now(), primary key(user_id, consent_type));
create table if not exists exercise_definitions (id uuid primary key default gen_random_uuid(), exercise_key text not null, version text not null, definition jsonb not null, scoring_version text not null, pose_model_version text not null, published_at timestamptz, unique(exercise_key, version));
create table if not exists workout_sessions (id uuid primary key, user_id uuid not null references users(id) on delete cascade, client_idempotency_key text not null, status text not null, started_at timestamptz not null, completed_at timestamptz, summary jsonb not null default '{}', unique(user_id, client_idempotency_key));
create table if not exists xp_ledger (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, source text not null, source_id uuid, amount integer not null, created_at timestamptz not null default now());
create table if not exists processed_client_events (user_id uuid not null references users(id) on delete cascade, idempotency_key text not null, response jsonb not null, created_at timestamptz not null default now(), primary key(user_id, idempotency_key));
alter table profiles enable row level security;
alter table consents enable row level security;
alter table workout_sessions enable row level security;
alter table xp_ledger enable row level security;
