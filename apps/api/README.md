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
- `GET /v1/foods/barcodes/:barcode`, `POST /v1/foods/custom`
- `POST /v1/foods/candidates` (optional backend-only Gemini 2.5 Flash fallback)
- `POST /v1/foods/candidates/image` (optional backend-only Gemini 2.5 Flash image fallback)
- `GET/POST/PUT/DELETE /v1/food-entries`, `GET /v1/nutrition/daily`

Every mutation requires `Idempotency-Key`. Replaying the same operation and payload returns the original response with `Idempotency-Replayed: true`; using the key for another request returns `409`. Strict schemas reject raw frames, landmark streams and unknown fields.

Nutrition uses an in-memory repository for local/demo mode and Open Food Facts
for packaged barcode lookup. Barcode requests accept EAN-8, EAN-13, UPC-A, and
distinguishable eight-digit, number-system-zero UPC-E values with optional
scanner separators. They
validate the check digit and normalize UPC-A/UPC-E to zero-padded EAN-13 before
the upstream request. Because the HTTP route receives no scanner-format
metadata, six-digit UPC-E bodies and eight-digit values valid as both EAN-8 and
UPC-E are rejected rather than guessed. Invalid values return `400
INVALID_REQUEST`; an Open Food Facts miss is `404
FOOD_NOT_FOUND`, while timeout, malformed, oversized, and upstream error
responses are `503 FOOD_LOOKUP_UNAVAILABLE`. Open Food Facts results are labeled
`source: "open_food_facts"` and `authoritative: true` as source-backed records;
AI candidates remain explicitly unverified. Apply
`database/migrations/004_nutrition.sql` before enabling a future PostgreSQL
nutrition adapter; the current adapter fails closed with
`NUTRITION_STORE_UNAVAILABLE` rather than silently dropping food data.

When `GEMINI_API_KEY` is configured, the two candidate endpoints return
validated candidates with `source: "gemini_unverified"` and
`authoritative: false`. The image endpoint accepts a bounded base64 JPEG/PNG/WebP
payload, forwards it once to Gemini 2.5 Flash, and discards it after the request;
the API never stores or logs the raw image. Neither endpoint persists input or
saves generated nutrition automatically. Without the key they return
`501 GEMINI_FALLBACK_DISABLED`; upstream failures return `503`. These
inference-only endpoints do not require an idempotency key because they write
no state. Mobile must keep the key server-side and only send images through the
authenticated API.

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
