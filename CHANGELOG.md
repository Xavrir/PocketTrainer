# Changelog

All notable changes to PocketTrainer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-16

### Added

- Complete Indonesian-first onboarding, assessment, course, coaching, results, progress, and profile experience.
- Android CameraX and MediaPipe Pose Landmarker engine with native frame/skeleton rendering and compact New Architecture events.
- Explicit Android camera-permission gating and a CameraX front-camera ImageAnalysis stream rendered with the on-device pose skeleton.
- Supabase email/password sign-in/sign-up, persisted mobile sessions, automatic token refresh, bearer-authenticated API requests, profile sign-out, and fail-closed release configuration.
- Hosted Supabase Cloud project configuration with publishable-key-only mobile
  integration and verified JWT handoff to NestJS.
- Android Keystore-wrapped SQLCipher persistence, offline bootstrap fallback,
  durable workout queueing, and reconnect synchronization.
- Confidence, required-phase, pain, mastery, daily-XP, streak, and idempotency safety rules.
- Production-shaped NestJS API, forced-RLS PostgreSQL schema, transactional outbox, Azure Container Apps definition, and Cloudflare/R2 boundary.
- Final multi-width visual review evidence and Samsung SM-A556E camera smoke test.

### Known limitations

- App-level ambiguous-response/process-death recovery evidence, Azure/Cloudflare
  production provisioning, fitness-reviewer approval, golden-video accuracy
  validation, and Play signing remain beta gates.

## [0.1.1] - 2026-07-16

### Added

- Database and deployment checkpoint with Azure, Supabase, and Cloudflare responsibility boundaries.

## [0.1.0] - 2026-07-16

### Added

- Android-first React Native workspace.
- Initial hackathon architecture and checkpoint documentation.

[Unreleased]: https://github.com/Xavrir/PocketTrainer/compare/v0.2.0-demo...HEAD
[0.2.0]: https://github.com/Xavrir/PocketTrainer/compare/v0.1.1-infra...v0.2.0-demo
[0.1.1]: https://github.com/Xavrir/PocketTrainer/compare/v0.1.0-foundation...v0.1.1-infra
[0.1.0]: https://github.com/Xavrir/PocketTrainer/releases/tag/v0.1.0-foundation
