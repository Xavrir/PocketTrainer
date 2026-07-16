# PocketTrainer

<p align="center">
  <img src="apps/mobile/src/assets/images/pockettrainer-logo-source.png" alt="PocketTrainer PT logo" width="360" />
</p>

[![CI](https://github.com/Xavrir/PocketTrainer/actions/workflows/ci.yml/badge.svg)](https://github.com/Xavrir/PocketTrainer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Xavrir/PocketTrainer?display_name=tag)](https://github.com/Xavrir/PocketTrainer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-f05a6a.svg)](LICENSE)

**PocketTrainer turns learning good movement into a visible course path.** It combines Duolingo-style progression with private, on-device posture coaching for gym exercises, yoga, and mobility.

> Android-first hackathon MVP · Bahasa Indonesia first · Raw workout video never leaves the device

## Why it exists

Beginners often know *which* exercise to do but cannot tell whether they are doing it safely. Video subscriptions show ideal form; they do not see the person in front of the screen. PocketTrainer closes that loop with an assessment, a personalized learning path, real-time form feedback, and mastery-gated progression.

```text
Assessment → personalized path → coached lesson → form score → mastery + XP → safe unlock
```

## MVP experience

- Android-native posture scoring for body squat; unsupported movements remain clearly labeled guided practice without form scores.
- Strength, yoga, and mobility courses built from versioned lessons and prerequisites.
- XP, streak protection, achievements, and a Movement Passport.
- Authenticated workout submission with idempotent, server-authoritative XP and progression.
- Progression that requires both account level and demonstrated movement mastery.
- Explicit confidence and pain gates: uncertain tracking never becomes a low score or an unlock.
- Supabase email/password identity with persisted sessions, foreground token refresh, and authenticated NestJS requests.

## Product preview

| Learn path | Native coaching | Progress passport |
|---|---|---|
| ![Course path](documentation/review/screenshots/v4/learn-412.png) | ![Live coaching](documentation/review/screenshots/v4/live-low-confidence-412.png) | ![Progress](documentation/review/screenshots/v4/progress-412.png) |

The live state above demonstrates the no-score confidence gate. The native release was separately validated on a Samsung SM-A556E without Metro; its camera frame is intentionally not committed because workout imagery stays on-device.

## What makes it different

The live movement engine stays native. Camera frames, pose landmarks, movement state, feedback, and the skeleton overlay run on-device. React Native receives compact events only; the server receives derived workout summaries only.

## Architecture

```mermaid
flowchart LR
  APP <--> POSE[Kotlin + CameraX + MediaPipe]
  APP <--> AUTH[Supabase Auth]
  APP --> EDGE[Cloudflare DNS / CDN]
  EDGE --> API[NestJS on Azure Container Apps]
  API <--> DB[(Azure PostgreSQL)]
  API --> R2[Cloudflare R2]
  APP --> R2
```

| Layer | Choice | Responsibility |
|---|---|---|
| Mobile | React Native + TypeScript | Product UI, navigation, authenticated API orchestration |
| Movement | Kotlin, CameraX, MediaPipe | Private live inference, feedback, overlay |
| API | NestJS modular monolith | Auth boundary, catalog, plans, sync, progression |
| Product data | Azure PostgreSQL | RLS-protected user and curriculum data |
| Identity | Supabase Auth | Sign-in and short-lived session tokens only |
| Content edge | Cloudflare R2/CDN | Signed rule manifests and instruction media |

Read the full [architecture](documentation/ARCHITECTURE.md), [safety model](documentation/SAFETY_AND_PRIVACY.md), and [technical design source](documentation/TECHNICAL_DESIGN_SOURCE.md).

## Repository map

```text
apps/mobile/             React Native Android application
apps/api/                NestJS API
packages/contracts/      Shared wire and native-event contracts
packages/domain/         Progression, mastery, XP, and safety rules
packages/exercise-rules/ Versioned movement definitions
packages/validation/     Runtime schema validation
database/                PostgreSQL migrations and seed data
infrastructure/          Azure/Cloudflare deployment notes
documentation/           Architecture, demo, checkpoints, safety
```

## Local development

### Requirements

- Node.js 24+
- pnpm 11+
- Java 21 and Android Studio/SDK for the mobile build
- PostgreSQL 16+ for persistence-backed API development

```bash
pnpm install
pnpm check
pnpm api:dev
pnpm mobile:start
pnpm mobile:android
```

Copy `apps/api/.env.example` to `apps/api/.env` for local API configuration and `apps/mobile/.env.example` to `apps/mobile/.env` for the public Supabase URL, publishable key, and API origin. Release builds fail closed when auth is missing; only debug/test builds may enable the explicit bypass. Never commit credentials, Supabase service keys, Azure connection strings, or signing keys. See [Supabase Auth setup](documentation/SUPABASE_AUTH.md).

## Hackathon demo path

1. Complete the five-step onboarding and movement consent.
2. Take the short movement assessment.
3. Receive a personalized starting path.
4. Open a squat lesson and pass camera calibration.
5. Complete a set with one clear correction at a time.
6. Review form, completion, control, and consistency.
7. Earn XP and unlock the next lesson only when mastery is safe.
8. Confirm the server response before presenting final XP, mastery, or unlocks.

See [DEMO.md](documentation/DEMO.md) for the complete judging script.

## Checkpoints and releases

Development is published as exactly three verifiable hackathon checkpoints:

- `v0.1.0-foundation` — product shell, initial contracts, API skeleton, and repository standards.
- `v0.1.1-infra` — Azure PostgreSQL/RLS, Supabase identity boundary, and Cloudflare/Azure deployment foundation.
- `v0.2.0-demo` — reviewed end-to-end experience, native CameraX/MediaPipe loop, safety rules, progression API, and Android demo artifact.

The complete evidence expected at each checkpoint is in [CHECKPOINTS.md](documentation/CHECKPOINTS.md). Release notes follow [Keep a Changelog](CHANGELOG.md) and Conventional Commits.

## Safety and privacy

PocketTrainer provides general fitness guidance, not medical diagnosis or treatment. A qualified fitness professional must review each published exercise definition. Raw camera frames and landmark streams are not uploaded. Pain immediately stops progression and offers a safer alternative.

## Project status

This repository is a closed-beta hackathon prototype. The end-to-end product flow, native Android camera/inference path, API, schema, five-movement evaluator foundation, and progression rules are implemented. Hosted Supabase Cloud email/password Auth and the bearer-token API handoff were validated on a physical Samsung SM-A556E. The Android SQLCipher queue is wired and covered by unit/build checks, including same-key recovery after an ambiguous completion, but airplane-mode process-death and reconnect recovery still require an end-to-end device run. Azure/Cloudflare production provisioning, golden-video accuracy targets, broader device performance, privacy export/deletion UX review, Play signing, and qualified fitness approval also remain release gates. “Implemented” means code exists and passes its stated checks; a rendered screen, compiled native module, or schema is not represented as real-world validation.

## AI and external-resource disclosure

AI-assisted development is used for planning, implementation support, visual asset generation, and review. Generated visual assets are identified in the asset manifest. Core product decisions, source code, tests, exercise safety review, and final submission verification remain the team’s responsibility. MediaPipe, React Native, Supabase, Azure, and Cloudflare are external technologies disclosed in the architecture documentation.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Security issues should follow [SECURITY.md](SECURITY.md), not public issue reports.

## License

[MIT](LICENSE)
