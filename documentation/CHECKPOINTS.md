# Checkpoints

Each checkpoint is a conventional commit on `main`, an annotated Git tag, and a GitHub prerelease/release with generated notes. A checkpoint is published only after its evidence passes.

## v0.1.0-foundation

- Monorepo and CI.
- Reviewed Home page and locked design bible.
- Shared catalog/native-event/API contracts.
- Four draft versioned exercise definitions.
- NestJS and PostgreSQL/RLS foundation.
- Secret scan and clean install/build evidence.

## v0.2.0-coaching

- Onboarding and assessment flow.
- Android native camera and MediaPipe boundary.
- Four exercise state machines and golden tests.
- Calibration, live coaching, tracking-loss recovery, and results pages.
- Every page independently reviewed from a rendered screenshot.

## v0.3.0-progression

- Encrypted local persistence and recoverable session lifecycle.
- Idempotent batch sync and authoritative XP ledger.
- Mastery plus level unlock gates, streak protection, achievements.
- Offline/reconnect integration evidence.

## v0.4.0-beta

- Representative Android device matrix.
- Qualified fitness review records.
- Privacy export/deletion and security review.
- Accessibility and performance gates.
- Signed APK and closed-beta release notes.

## Tagging commands

```bash
git tag -a v0.1.0-foundation -m "PocketTrainer foundation checkpoint"
git push origin v0.1.0-foundation
gh release create v0.1.0-foundation --prerelease --generate-notes
```
