# PocketTrainer API

NestJS modular-monolith API for the Android-first MVP. It supports the complete beta loop: identity mapping, onboarding/consent, versioned curriculum, assessment, plan creation, offline workout synchronization, server-authoritative XP, mastery, safe unlocks, streaks, and the transactional outbox.

## Run locally

```bash
cp .env.example .env
npm install --workspaces=false
npm run start:dev
```

Set `DATA_STORE=memory` and `ALLOW_INSECURE_DEV_AUTH=true` for an isolated local demo. Supply `X-Dev-Auth-Subject: <uuid>` on protected requests. Production configuration rejects the memory store, development authentication, loopback PostgreSQL, disabled database TLS, and temporary/insecure content origins.

For PostgreSQL, apply the migration in `database/README.md`, use `DATA_STORE=postgres`, and provide the least-privilege runtime connection URL. The API validates Supabase access tokens against the project's cached remote JWKS, including issuer, audience, expiry and supported signing algorithms. The JWT `sub` maps to an internal Azure UUID; email is never an identity key.

## REST surface

- `GET /health`, `GET /health/ready`
- `GET /v1/bootstrap`
- `PUT /v1/profile`
- `PUT /v1/consents/:type`
- `GET /v1/catalog`, `GET /v1/courses/:id`
- `GET /v1/progress`
- `POST /v1/assessments`, `POST /v1/assessments/:id/complete`
- `GET /v1/plans/current`
- `POST /v1/workout-sessions`, `PUT /v1/workout-sessions/:id/results`, `POST /v1/workout-sessions/:id/complete`
- `POST /v1/sync/batch`

Every mutation requires `Idempotency-Key`. Replaying the same operation and payload returns the original response with `Idempotency-Replayed: true`; using the key for another request returns `409`. Strict schemas reject raw frames, landmark streams and unknown fields.

## Validate

```bash
npm run typecheck
npm run test
npm run build
```

Build the production image from the monorepo root so the frozen workspace lockfile is available:

```bash
docker build -f apps/api/Dockerfile -t pockettrainer-api:local .
docker inspect --format '{{json .Config.Healthcheck}}' pockettrainer-api:local
```

The image health check calls `/health/ready`, which includes a data-store ping.
The deployed Azure App Service uses `/health` for platform health monitoring;
the Container Apps alternative keeps explicit startup/liveness/readiness probes
in `infrastructure/azure/container-apps.bicep`. The integration suite verifies
authentication, catalog scope, idempotency conflicts/replays, assessment XP,
plan generation, two-session mastery, pain suppression, and offline batch replay.
