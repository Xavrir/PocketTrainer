# PocketTrainer PostgreSQL

Azure Database for PostgreSQL Flexible Server is the only product-data store. Supabase Postgres is not used by this application; Supabase supplies authenticated JWT subjects only.

## Apply the schema

Run `001_foundation.sql` as a migration owner, never as the runtime application role:

```bash
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_foundation.sql
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_backend_hardening.sql
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_native_tracking_alignment.sql
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/004_nutrition.sql
```

The migration is intentionally a one-time foundation migration. Apply it to a new database. Later changes must be new numbered migrations rather than edits after a release.

## Runtime role

Create a non-owner login with no `BYPASSRLS` privilege and grant only the application surface. Replace the role and password placeholders through the Azure secret workflow:

```sql
create role pockettrainer_runtime login password '<secret>' nosuperuser nocreatedb nocreaterole noinherit;
grant usage on schema public to pockettrainer_runtime;
grant select on catalog_versions, tracks, courses, units, lessons, lesson_prerequisites,
  exercise_definitions, achievements to pockettrainer_runtime;
grant select, insert, update on profiles, consents, devices,
  assessment_sessions, workout_plans, workout_sessions, exercise_results,
  user_course_progress, lesson_attempts, skill_mastery, unlock_events, xp_ledger,
  streak_days, user_achievements, processed_client_events to pockettrainer_runtime;
grant insert on outbox_events to pockettrainer_runtime;
grant select, insert, update, delete on nutrition_foods to pockettrainer_runtime;
grant select, insert, update, delete on food_entries to pockettrainer_runtime;
grant execute on function resolve_auth_identity(text), build_catalog_manifest(integer),
  process_outbox_batch(integer) to pockettrainer_runtime;
```

The API wraps every user query in a short transaction and calls `set_config('app.current_user_id', user_id, true)`. Forced RLS then restricts all user-owned tables. The three `SECURITY DEFINER` functions have fixed search paths, public execution revoked, and narrowly scoped responsibilities.

Packaged-food lookups cached by the API are user-scoped. Global nutrition rows
may be provisioned by the migration owner and are readable but immutable to the
runtime role. A food entry can reference only a global row or a food row visible
to the active `app.current_user_id`.

## Verification

After applying the migration, verify RLS and indexes:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class where relname in ('profiles','workout_sessions','xp_ledger','processed_client_events');

select indexname from pg_indexes
where tablename in ('workout_sessions','exercise_results','outbox_events','xp_ledger')
order by tablename,indexname;
```
