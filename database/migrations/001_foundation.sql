begin;

create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','disabled','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'supabase',
  provider_subject text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (user_id, provider)
);
create index auth_identities_user_id_idx on auth_identities(user_id);

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'id' check (locale in ('id','en')),
  timezone text not null default 'Asia/Jakarta',
  primary_goal text not null check (primary_goal in ('build_strength','improve_mobility','build_consistency','reduce_stress')),
  experience_level text not null check (experience_level in ('foundation','beginner','intermediate')),
  equipment text[] not null default '{}',
  limitations text[] not null default '{}',
  schedule_days text[] not null default '{}',
  session_duration_minutes smallint not null check (session_duration_minutes between 10 and 120),
  onboarding_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy','camera_processing','fitness_guidance','analytics')),
  granted boolean not null,
  version text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, consent_type)
);
create index consents_user_id_idx on consents(user_id);

create table devices (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  platform text not null check (platform in ('android')),
  application_version text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index devices_user_id_last_seen_idx on devices(user_id,last_seen_at desc);

create table catalog_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  status text not null check (status in ('draft','published','retired')),
  content_base_url text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index catalog_versions_one_published_idx on catalog_versions(status) where status='published';

create table tracks (
  id uuid primary key,
  catalog_version integer not null references catalog_versions(version),
  slug text not null,
  title jsonb not null,
  description jsonb not null,
  sort_order smallint not null,
  unique(catalog_version,slug)
);
create index tracks_catalog_order_idx on tracks(catalog_version,sort_order);

create table courses (
  id uuid primary key,
  track_id uuid not null references tracks(id) on delete cascade,
  slug text not null unique,
  title jsonb not null,
  description jsonb not null,
  accent text not null,
  sort_order smallint not null
);
create index courses_track_order_idx on courses(track_id,sort_order);

create table units (
  id uuid primary key,
  course_id uuid not null references courses(id) on delete cascade,
  title jsonb not null,
  sort_order smallint not null
);
create index units_course_order_idx on units(course_id,sort_order);

create table exercise_definitions (
  id uuid primary key,
  exercise_key text not null,
  version integer not null check(version > 0),
  scoring_version text not null,
  pose_model_version text not null,
  name jsonb not null,
  category text not null check(category in ('strength','yoga','mobility')),
  mode text not null check(mode in ('repetition','hold')),
  camera_view text not null check(camera_view in ('front','side')),
  content_path text not null,
  configuration jsonb not null default '{}',
  status text not null check(status in ('draft','published','retired')),
  published_at timestamptz,
  unique(exercise_key,version)
);
create index exercise_definitions_status_key_idx on exercise_definitions(status,exercise_key,version desc);

create table lessons (
  id uuid primary key,
  unit_id uuid not null references units(id) on delete cascade,
  exercise_definition_id uuid not null references exercise_definitions(id),
  title jsonb not null,
  summary jsonb not null,
  sort_order smallint not null,
  target_type text not null check(target_type in ('reps','seconds')),
  target_value smallint not null check(target_value > 0),
  xp_reward smallint not null check(xp_reward between 0 and 500),
  minimum_level smallint not null default 1 check(minimum_level > 0),
  required_mastery_keys text[] not null default '{}',
  required_equipment text[] not null default '{}',
  publishing_status text not null default 'published' check(publishing_status in ('draft','published','retired'))
);
create index lessons_unit_order_idx on lessons(unit_id,sort_order);
create index lessons_exercise_definition_id_idx on lessons(exercise_definition_id);

create table lesson_prerequisites (
  lesson_id uuid not null references lessons(id) on delete cascade,
  prerequisite_lesson_id uuid not null references lessons(id) on delete cascade,
  primary key(lesson_id,prerequisite_lesson_id),
  check(lesson_id <> prerequisite_lesson_id)
);
create index lesson_prerequisites_prerequisite_idx on lesson_prerequisites(prerequisite_lesson_id,lesson_id);

create table assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null check(status in ('in_progress','completed','cancelled')),
  assessment_version text not null,
  exercise_definition_version text not null default '1',
  scoring_version text not null default '1.0.0',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb
);
create index assessment_sessions_user_started_idx on assessment_sessions(user_id,started_at desc);
create index assessment_sessions_user_status_idx on assessment_sessions(user_id,status);

create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  assessment_session_id uuid references assessment_sessions(id),
  revision integer not null check(revision > 0),
  status text not null check(status in ('active','superseded','archived')),
  reason jsonb not null,
  lesson_ids uuid[] not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,revision)
);
create index workout_plans_user_status_revision_idx on workout_plans(user_id,status,revision desc);
create index workout_plans_assessment_session_id_idx on workout_plans(assessment_session_id);
create unique index workout_plans_one_active_idx on workout_plans(user_id) where status='active';

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  lesson_id uuid not null references lessons(id),
  status text not null check(status in ('in_progress','completed','stopped_for_safety','abandoned')),
  started_at timestamptz not null,
  completed_at timestamptz,
  device_id uuid,
  application_version text not null,
  average_form_score numeric(5,2),
  completion_score numeric(5,2),
  perceived_difficulty smallint check(perceived_difficulty between 1 and 10),
  pain_reported boolean not null default false,
  client_idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id,client_idempotency_key)
);
create index workout_sessions_user_started_idx on workout_sessions(user_id,started_at desc);
create index workout_sessions_user_status_idx on workout_sessions(user_id,status,started_at desc);
create index workout_sessions_lesson_id_idx on workout_sessions(lesson_id);

create table exercise_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  client_result_id uuid not null,
  exercise_definition_id uuid not null references exercise_definitions(id),
  exercise_definition_version integer not null,
  scoring_version text not null,
  pose_model_version text not null,
  set_number smallint not null check(set_number > 0),
  total_reps smallint not null check(total_reps >= 0),
  valid_reps smallint not null check(valid_reps between 0 and total_reps),
  form_score numeric(5,2),
  completion_score numeric(5,2) not null,
  control_score numeric(5,2) not null,
  consistency_score numeric(5,2) not null,
  main_feedback_code text,
  tracking_eligible boolean not null,
  duration_ms integer not null check(duration_ms >= 0),
  created_at timestamptz not null default now(),
  unique(workout_session_id,client_result_id),
  check((tracking_eligible and form_score is not null) or (not tracking_eligible and form_score is null))
);
create index exercise_results_user_id_idx on exercise_results(user_id);
create index exercise_results_workout_set_idx on exercise_results(workout_session_id,set_number);
create index exercise_results_exercise_definition_id_idx on exercise_results(exercise_definition_id);

create table user_course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null check(status in ('available','in_progress','completed')),
  updated_at timestamptz not null default now(),
  unique(user_id,course_id)
);
create index user_course_progress_user_status_idx on user_course_progress(user_id,status);
create index user_course_progress_course_id_idx on user_course_progress(course_id);

create table lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  lesson_id uuid not null references lessons(id),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  completed boolean not null,
  form_score numeric(5,2),
  completion_score numeric(5,2) not null,
  perceived_difficulty smallint not null check(perceived_difficulty between 1 and 10),
  completed_at timestamptz not null default now(),
  unique(user_id,workout_session_id)
);
create index lesson_attempts_user_lesson_completed_idx on lesson_attempts(user_id,lesson_id,completed,completed_at desc);
create index lesson_attempts_lesson_id_idx on lesson_attempts(lesson_id);
create index lesson_attempts_workout_session_id_idx on lesson_attempts(workout_session_id);

create table skill_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exercise_key text not null,
  best_form_score smallint not null default 0 check(best_form_score between 0 and 100),
  qualifying_sessions smallint not null default 0 check(qualifying_sessions >= 0),
  mastered boolean not null default false,
  restricted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id,exercise_key)
);
create index skill_mastery_user_state_idx on skill_mastery(user_id,mastered,restricted);

create table unlock_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  lesson_id uuid not null references lessons(id),
  reason text not null,
  source_event_id uuid,
  created_at timestamptz not null default now()
);
create index unlock_events_user_created_idx on unlock_events(user_id,created_at desc);
create index unlock_events_lesson_id_idx on unlock_events(lesson_id);

create table xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  event_id uuid not null,
  points smallint not null check(points between 0 and 500),
  idempotency_key text not null,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index xp_ledger_user_created_idx on xp_ledger(user_id,created_at desc);
create index xp_ledger_user_local_date_idx on xp_ledger(user_id,local_date,event_type);
create index xp_ledger_event_id_idx on xp_ledger(event_id);

create table streak_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  local_date date not null,
  day_type text not null check(day_type in ('workout','recovery','alternative_activity')),
  status text not null check(status in ('completed','protected','missed')),
  source_event_id uuid,
  timezone text not null,
  created_at timestamptz not null default now(),
  unique(user_id,local_date)
);
create index streak_days_user_date_idx on streak_days(user_id,local_date desc);

create table achievements (
  key text primary key,
  title jsonb not null,
  description jsonb not null,
  xp_reward smallint not null default 0
);

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  achievement_key text not null references achievements(key),
  unlocked_at timestamptz not null default now(),
  unique(user_id,achievement_key)
);
create index user_achievements_user_unlocked_idx on user_achievements(user_id,unlocked_at desc);
create index user_achievements_key_idx on user_achievements(achievement_key);

create table processed_client_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  idempotency_key text not null,
  event_type text not null,
  payload_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index processed_client_events_user_created_idx on processed_client_events(user_id,created_at desc);

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','processed','failed')),
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index outbox_events_status_available_idx on outbox_events(status,available_at,created_at) where status in ('pending','failed');
create index outbox_events_user_created_idx on outbox_events(user_id,created_at desc);

-- Supabase subjects map to Azure-owned users. The advisory lock prevents a
-- concurrent first request from creating an orphan identity.
create or replace function resolve_auth_identity(p_subject text)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid;
begin
  if p_subject is null or length(trim(p_subject)) = 0 then raise exception 'subject is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('supabase:' || p_subject,0));
  select ai.user_id into v_user_id from auth_identities ai where ai.provider='supabase' and ai.provider_subject=p_subject;
  if v_user_id is null then
    insert into users default values returning id into v_user_id;
    insert into auth_identities(user_id,provider,provider_subject) values(v_user_id,'supabase',p_subject);
  else
    update auth_identities set last_seen_at=now() where provider='supabase' and provider_subject=p_subject;
  end if;
  return query select v_user_id;
end;
$$;
revoke all on function resolve_auth_identity(text) from public;

-- V1 side effects (XP, streak and mastery) are committed in the originating
-- transaction. This consumer acknowledges the durable integration events;
-- later notification/analytics consumers can replace it without changing writes.
create or replace function process_outbox_batch(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'invalid batch size'; end if;
  with claimed as (
    select id from outbox_events
    where status in ('pending','failed') and available_at <= now()
    order by available_at,created_at
    for update skip locked
    limit p_limit
  ), processed as (
    update outbox_events e set status='processed',processed_at=now(),attempt_count=e.attempt_count+1
    from claimed where e.id=claimed.id returning e.id
  ) select count(*) into v_count from processed;
  return v_count;
end;
$$;
revoke all on function process_outbox_batch(integer) from public;

-- Manifest builder keeps API reads deterministic while the normalized tables
-- remain the catalog source of truth.
create or replace function build_catalog_manifest(p_version integer)
returns jsonb language sql stable set search_path=public as $$
with lesson_payload as (
  select l.unit_id,jsonb_agg(jsonb_build_object(
    'id',l.id,'unitId',l.unit_id,'exerciseDefinitionId',l.exercise_definition_id,
    'title',l.title,'summary',l.summary,'order',l.sort_order,
    'target',jsonb_build_object('type',l.target_type,'value',l.target_value),'xpReward',l.xp_reward,
    'requirements',jsonb_build_object(
      'minimumLevel',l.minimum_level,
      'prerequisiteLessonIds',coalesce((select jsonb_agg(lp.prerequisite_lesson_id) from lesson_prerequisites lp where lp.lesson_id=l.id),'[]'::jsonb),
      'requiredMasteryKeys',to_jsonb(l.required_mastery_keys),
      'requiredEquipment',to_jsonb(l.required_equipment))) order by l.sort_order) as payload
  from lessons l where l.publishing_status='published' group by l.unit_id
), unit_payload as (
  select u.course_id,jsonb_agg(jsonb_build_object(
    'id',u.id,'courseId',u.course_id,'title',u.title,'order',u.sort_order,
    'lessons',coalesce(lp.payload,'[]'::jsonb)) order by u.sort_order) as payload
  from units u left join lesson_payload lp on lp.unit_id=u.id group by u.course_id
), course_payload as (
  select c.track_id,jsonb_agg(jsonb_build_object(
    'id',c.id,'trackId',c.track_id,'slug',c.slug,'title',c.title,'description',c.description,
    'accent',c.accent,'order',c.sort_order,'units',coalesce(up.payload,'[]'::jsonb)) order by c.sort_order) as payload
  from courses c left join unit_payload up on up.course_id=c.id group by c.track_id
), track_payload as (
  select t.catalog_version,jsonb_agg(jsonb_build_object(
    'id',t.id,'slug',t.slug,'title',t.title,'description',t.description,'order',t.sort_order,
    'courses',coalesce(cp.payload,'[]'::jsonb)) order by t.sort_order) as payload
  from tracks t left join course_payload cp on cp.track_id=t.id group by t.catalog_version
), exercise_payload as (
  select jsonb_agg(jsonb_build_object(
    'id',ed.id,'exerciseKey',ed.exercise_key,'version',ed.version,'scoringVersion',ed.scoring_version,
    'poseModelVersion',ed.pose_model_version,'name',ed.name,'category',ed.category,'mode',ed.mode,
    'cameraView',ed.camera_view,'contentUrl',cv.content_base_url || ed.content_path) order by ed.exercise_key) as payload
  from exercise_definitions ed cross join catalog_versions cv
  where ed.status='published' and cv.version=p_version
)
select jsonb_build_object(
  'version',cv.version,'publishedAt',cv.published_at,'contentBaseUrl',cv.content_base_url,
  'exercises',coalesce(ep.payload,'[]'::jsonb),'tracks',coalesce(tp.payload,'[]'::jsonb))
from catalog_versions cv
left join track_payload tp on tp.catalog_version=cv.version
cross join exercise_payload ep
where cv.version=p_version;
$$;
revoke all on function build_catalog_manifest(integer) from public;

insert into catalog_versions(version,status,content_base_url,published_at) values(1,'published','https://content.pockettrainer.app',now());
insert into tracks(id,catalog_version,slug,title,description,sort_order) values
('20000000-0000-4000-8000-000000000001',1,'strength','{"id":"Kekuatan","en":"Strength"}','{"id":"Kuasai pola gerak utama.","en":"Master essential movement patterns."}',1),
('20000000-0000-4000-8000-000000000002',1,'yoga','{"id":"Yoga","en":"Yoga"}','{"id":"Bangun keseimbangan dan fokus.","en":"Build balance and focus."}',2),
('20000000-0000-4000-8000-000000000003',1,'mobility','{"id":"Mobilitas","en":"Mobility"}','{"id":"Pulihkan rentang gerak.","en":"Restore range and control."}',3);
insert into courses(id,track_id,slug,title,description,accent,sort_order) values
('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','strength-foundations','{"id":"Fondasi kuat","en":"Strong foundations"}','{"id":"Squat dan dorong dengan bentuk yang baik.","en":"Squat and push with confident form."}','#ff5368',1),
('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','yoga-foundations','{"id":"Aliran dasar","en":"Flow foundations"}','{"id":"Tahan pose dengan kontrol.","en":"Hold foundational poses with control."}','#a987ff',1),
('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','mobility-reset','{"id":"Reset harian","en":"Daily reset"}','{"id":"Sesi singkat untuk hari pemulihan.","en":"Short sessions for recovery days."}','#68dcb5',1);
insert into units(id,course_id,title,sort_order) values
('30000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','{"id":"Kaki stabil","en":"Steady legs"}',1),
('30000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','{"id":"Tubuh atas","en":"Upper body"}',2),
('30000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000002','{"id":"Keseimbangan","en":"Balance"}',1),
('30000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000003','{"id":"Mulai bergerak","en":"Move again"}',1);
insert into exercise_definitions(id,exercise_key,version,scoring_version,pose_model_version,name,category,mode,camera_view,content_path,status,published_at) values
('10000000-0000-4000-8000-000000000001','body_squat',1,'1.0.0','mediapipe-pose-landmarker-1','{"id":"Squat tubuh","en":"Body squat"}','strength','repetition','side','/v1/exercises/body-squat/preview.mp4','published',now()),
('10000000-0000-4000-8000-000000000002','incline_push_up',1,'1.0.0','mediapipe-pose-landmarker-1','{"id":"Push-up miring","en":"Incline push-up"}','strength','repetition','side','/v1/exercises/incline-push-up/preview.mp4','published',now()),
('10000000-0000-4000-8000-000000000003','warrior_two',1,'1.0.0','mediapipe-pose-landmarker-1','{"id":"Warrior II","en":"Warrior II"}','yoga','hold','front','/v1/exercises/warrior-two/preview.mp4','published',now()),
('10000000-0000-4000-8000-000000000004','tree_pose',1,'1.0.0','mediapipe-pose-landmarker-1','{"id":"Pose pohon","en":"Tree pose"}','yoga','hold','front','/v1/exercises/tree-pose/preview.mp4','published',now());
insert into lessons(id,unit_id,exercise_definition_id,title,summary,sort_order,target_type,target_value,xp_reward,minimum_level,required_mastery_keys,required_equipment) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"id":"Fondasi squat","en":"Squat foundations"}','{"id":"Bangun kontrol tubuh bagian bawah.","en":"Build lower-body control."}',1,'reps',8,60,1,'{}','{}'),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"id":"Kontrol squat","en":"Squat control"}','{"id":"Bergerak stabil melalui rentang penuh.","en":"Move steadily through full range."}',2,'reps',12,80,2,'{body_squat}','{}'),
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','{"id":"Dorong dengan kuat","en":"Push with purpose"}','{"id":"Pelajari garis tubuh yang aman.","en":"Learn a strong, safe body line."}',1,'reps',6,60,1,'{}','{bench_or_wall}'),
('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','{"id":"Warrior yang stabil","en":"Steady warrior"}','{"id":"Buka pinggul dan jaga lengan sejajar.","en":"Open the hips and align the arms."}',1,'seconds',20,60,1,'{}','{}'),
('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','{"id":"Fokus seperti pohon","en":"Root into focus"}','{"id":"Latih keseimbangan satu kaki.","en":"Train single-leg balance."}',2,'seconds',20,80,2,'{warrior_two}','{}'),
('40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','{"id":"Aliran pemulihan","en":"Recovery flow"}','{"id":"Gerakkan sendi dengan tenang.","en":"Restore calm, controlled movement."}',1,'seconds',30,50,1,'{}','{}');
insert into lesson_prerequisites values
('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001'),
('40000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000004');
insert into achievements(key,title,description) values('first_step','{"id":"Langkah pertama","en":"First step"}','{"id":"Selesaikan pelajaran pertama Anda.","en":"Complete your first lesson."}');

-- Every user-owned table is protected with forced RLS. The API sets the
-- transaction-scoped app.current_user_id before any query.
do $$
declare table_name text;
begin
  foreach table_name in array array['users','auth_identities','profiles','consents','devices','assessment_sessions','workout_plans','workout_sessions','exercise_results','user_course_progress','lesson_attempts','skill_mastery','unlock_events','xp_ledger','streak_days','user_achievements','processed_client_events','outbox_events'] loop
    execute format('alter table %I enable row level security',table_name);
    execute format('alter table %I force row level security',table_name);
    if table_name='users' then
      execute format('create policy %I on %I for all using (id=nullif(current_setting(''app.current_user_id'',true),'''')::uuid) with check (id=nullif(current_setting(''app.current_user_id'',true),'''')::uuid)',table_name||'_owner',table_name);
    else
      execute format('create policy %I on %I for all using (user_id=nullif(current_setting(''app.current_user_id'',true),'''')::uuid) with check (user_id=nullif(current_setting(''app.current_user_id'',true),'''')::uuid)',table_name||'_owner',table_name);
    end if;
  end loop;
end $$;

-- Forced RLS also applies to a table owner. These narrow policies let only
-- SECURITY DEFINER functions created by that same migration owner perform the
-- identity bootstrap and cross-user outbox claim. The runtime role itself is
-- still constrained by the normal per-user policies.
create policy users_service_definer on users for all
  using (current_user=pg_get_userbyid((select relowner from pg_class where oid='users'::regclass)))
  with check (current_user=pg_get_userbyid((select relowner from pg_class where oid='users'::regclass)));
create policy auth_identities_service_definer on auth_identities for all
  using (current_user=pg_get_userbyid((select relowner from pg_class where oid='auth_identities'::regclass)))
  with check (current_user=pg_get_userbyid((select relowner from pg_class where oid='auth_identities'::regclass)));
create policy outbox_events_service_definer on outbox_events for all
  using (current_user=pg_get_userbyid((select relowner from pg_class where oid='outbox_events'::regclass)))
  with check (current_user=pg_get_userbyid((select relowner from pg_class where oid='outbox_events'::regclass)));

commit;
