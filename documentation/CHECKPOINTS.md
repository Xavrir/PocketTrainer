# Checkpoints

The original hackathon delivery uses exactly three annotated checkpoint tags and
GitHub releases, so reviewers can inspect three honest milestones. Corrective
patch releases get new immutable tags and never move those checkpoints.

## v0.1.0-foundation

- Monorepo and CI.
- Reviewed Home page and locked design bible.
- Shared catalog/native-event/API contracts.
- Four draft versioned exercise definitions.
- NestJS and PostgreSQL/RLS foundation.
- Secret scan and clean install/build evidence.

## v0.1.1-infra

- PostgreSQL schema, forced RLS, ownership indexes, and seeded catalog.
- Supabase JWT-to-internal-user boundary.
- Azure Container Apps and Cloudflare/R2 deployment documentation.
- CI, contribution, security, issue, and release templates.

## v0.2.0-demo

- Onboarding and assessment flow.
- Android CameraX ImageAnalysis preview, explicit runtime permission flow, and MediaPipe boundary.
- Four exercise state machines and golden tests.
- Calibration, live coaching, tracking-loss recovery, and results pages.
- Every page independently reviewed from a rendered screenshot.
- Idempotent batch sync and authoritative XP ledger.
- Mastery plus level unlock gates, streak protection, achievements.
- Supabase Cloud Auth with persisted sessions and NestJS JWKS
  verification.
- Android Keystore-wrapped SQLCipher storage, durable workout queue, cached
  bootstrap, reconnect flush, and authoritative sync acknowledgement.
- Samsung SM-A556E camera/inference smoke-test evidence.

## v0.2.1-demo corrective release

- Google-first Auth and email magic-link fallback included in the APK.
- Stable Azure HTTPS API instead of localhost/ADB reverse.
- Squat-only posture scoring; unsupported movements are guided and unscored.
- Connected Kotlin evaluator/offline-store instrumentation and camera flicker fix.
- Exact-tag release build plus development-URL and secret-marker scanning.

## v0.2.2-demo rescue release

- Must be built from the existing annotated `v0.2.2-demo` tag; the workflow
  never creates, moves, or replaces a tag.
- Publishes immutable assets named `PocketTrainer-v0.2.2-demo.apk` and
  `PocketTrainer-v0.2.2-demo.apk.sha256`; an existing GitHub release blocks the
  workflow instead of being overwritten.
- Requires the approved stable Azure HTTPS origin, checks its health endpoint,
  rejects local/private/Quick Tunnel origins and secret markers, and verifies
  the generated checksum before publication.
- Intentionally uses the Android debug certificate. This remains a
  demo/prerelease artifact and is not suitable for Play production.

## Still required before public beta

- App-level ambiguous-response/process-death recovery acceptance evidence.
- Representative low/mid-range Android performance matrix.
- Qualified fitness review and validated golden-video dataset.
- Final accessibility audit and optional Cloudflare custom-domain provisioning.
- Play-signed release build; the hackathon artifact is debug-signed.

## Tagging commands

```bash
git tag -a v0.2.0-demo -m "PocketTrainer Android demo checkpoint"
git push origin v0.2.0-demo
gh release create v0.2.0-demo --prerelease --generate-notes
```

For `v0.2.2-demo`, create and push the annotated tag only after every physical
acceptance gate passes, then manually dispatch the dedicated release workflow.
The workflow fails if the tag is missing/lightweight or if a release with that
tag already exists. Never retag or replace any earlier checkpoint.
