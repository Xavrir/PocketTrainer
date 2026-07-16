# Checkpoints

The hackathon repository uses exactly three conventional commits on `master`. Each commit has an annotated Git tag and GitHub release, so reviewers can inspect the product at three honest milestones.

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
- Supabase Cloud email/password Auth with persisted sessions and NestJS JWKS
  verification.
- Android Keystore-wrapped SQLCipher storage, durable workout queue, cached
  bootstrap, reconnect flush, and authoritative sync acknowledgement.
- Samsung SM-A556E camera/inference smoke-test evidence.

## Still required before public beta

- App-level ambiguous-response/process-death recovery acceptance evidence.
- Representative low/mid-range Android performance matrix.
- Qualified fitness review and validated golden-video dataset.
- Privacy export/deletion, final accessibility audit, and Azure/Cloudflare
  production provisioning.
- Play-signed release build; the hackathon artifact is debug-signed.

## Tagging commands

```bash
git tag -a v0.2.0-demo -m "PocketTrainer Android demo checkpoint"
git push origin v0.2.0-demo
gh release create v0.2.0-demo --prerelease --generate-notes
```
