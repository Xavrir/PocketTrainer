# PocketTrainer Technical Design Implementation Plan

Source of truth: `/home/xavrir/Downloads/PocketTrainer_Technical_Design.md` (version 1.0) and the pasted delivery instructions in `/home/xavrir/.codex/attachments/10850054-3dbd-4d07-9af4-1322bdcbc2f2/pasted-text-1.txt`.

This plan preserves the existing working-tree changes. No secret, raw camera frame, raw landmark stream, signing key, or service-role credential may be committed.

## Ownership

| Owner | Write scope | Responsibility |
|---|---|---|
| Main agent | `App.tsx`, shared integration boundaries, root files, documentation, Obsidian continuity, release metadata | Contracts, integration, quality, release, conflict resolution |
| Motion worker | `apps/mobile/android/app/src/main/java/com/pockettrainer/poseengine/`, `packages/exercise-rules/`, movement tests and fixtures | Versioned native movement engine and deterministic movement validation |
| Mobile worker | `apps/mobile/src/course/`, `apps/mobile/src/screens/`, `apps/mobile/src/components/`, mobile state/data hooks, localization, UI tests | Dynamic course/product experience and safety/accessibility states; must not edit `App.tsx` or Kotlin/native pose-engine files |
| Backend worker | `apps/api/`, `database/`, `infrastructure/`, `apps/mobile/src/api/`, `apps/mobile/src/auth/`, offline persistence/sync modules and integration tests | Auth/API/database/RLS/offline/cloud/privacy implementation |

Workers must not revert edits from other owners. Shared-contract conflicts are resolved by the main agent after each worker milestone.

## Delivery milestones

1. **Audit and contracts** — complete the matrix, verify existing changes, stabilize catalog/lesson/exercise/native-event/session-summary/API contracts, and add acceptance tests before widening scope.
2. **Real course loop** — authenticated bootstrap/catalog, dynamic course path, lesson selection, camera setup, real squat coaching, authoritative completion, XP/mastery/unlock, and persisted onboarding.
3. **Movement coverage** — generic versioned rule engine, incline push-up, Warrior II, Tree Pose, jumping jack, confidence gates, smoothing, hysteresis, golden fixtures, and session completion.
4. **Offline reliability** — encrypted SQLite, durable queue, airplane mode, process-death recovery, reconnect replay, and exactly-once server recording.
5. **Cloud and privacy** — verified Azure/Supabase/Cloudflare deployment preparation, signed manifests, forced RLS, export/deletion, telemetry privacy review, and audit logging.
6. **Remaining design domains** — implement or explicitly document nutrition, health, gym discovery, gamification, notifications, administrative tooling, and feature flags according to the matrix.
7. **Release** — full checks, physical/device matrix, accessibility review, release-signed artifact when credentials are available, checksum/changelog/limitations/demo documentation, and new semantic versioning without rewriting public history.

## Safety and evidence gates

- Raw frames and raw landmark streams remain native/on-device and never enter JavaScript, logs, SQLite, API traffic, Azure, Supabase, Cloudflare, analytics, or crash reports.
- Low confidence, pain, missing landmarks, invalid orientation, out-of-frame users, and multiple-person detection cannot produce a score or progression.
- Server authority decides completion, XP, mastery, streaks, achievements, and unlocks; offline state is visibly local/pending until confirmed.
- No professional-validation claim is made without a dated qualified reviewer record.
- Unsupported integrations or production resources are marked externally blocked with the exact missing credential/approval and a local substitute test where possible.

## Status after 2026-07-17 continuation

- Milestones 1–3: implementation complete for the audited Android scope. The course adapter consumes server catalog/progress, the shared and native movement layers expose five versioned movement evaluators, and the API accepts only the explicit native tracking allowlist.
- Milestones 4–5: implementation is substantially complete locally for encrypted queue/idempotency/privacy export/deletion/auth hardening, but process-death ambiguity, production RLS/cloud verification, and device instrumentation remain open evidence gates.
- Milestone 6: nutrition, health, gym, notifications, and admin tooling remain deliberately deferred or externally blocked as recorded in the traceability matrix.
- Milestone 7: Node 24 workspace validation, clean release APK assembly, Supabase session restoration, standalone launch without Metro, and live CameraX rendering pass locally/on a Samsung SM-A556E. The artifact remains a hackathon release signed with the debug key; a Play production release is not claimed because Play signing credentials, broader device/golden fixtures, and professional review are unavailable.

Validation evidence and the section-by-section acceptance state are maintained in [REQUIREMENT_TRACEABILITY.md](REQUIREMENT_TRACEABILITY.md).
