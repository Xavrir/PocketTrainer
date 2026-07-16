# Architecture

## Core boundary

The native movement engine owns camera capture, pose inference, smoothing, state transitions, scoring, feedback arbitration, and skeleton rendering. JavaScript receives compact typed events only.

## Identity and product data

Supabase Auth issues the mobile session. NestJS validates its asymmetric JWT through JWKS and maps `sub` to an internal `users.id` in Azure PostgreSQL. There are no cross-database foreign keys or distributed transactions. Supabase contains no PocketTrainer workout, profile, or progress rows.

## Offline completion

The API side of offline completion is implemented: it stores processed idempotency keys and returns the original authoritative result for duplicate submissions. The mobile target is to write a session to encrypted SQLite before showing completion, then append a sync command with a client-generated idempotency key. That SQLite queue is a beta gate and is not claimed by the `v0.2.0-demo` checkpoint. XP and unlocks remain server-authoritative; the app may show only a clearly labeled offline preview.

## Content publishing

Published exercise definitions are immutable. Every manifest includes schema, exercise, scoring, model, minimum-app, checksum, signature, and rollback versions. The application retains the last known-safe compatible bundle when validation fails.

## Deliberate V1 exclusions

No Redis, standalone queue, nutrition, health integration, gym discovery, public leaderboard, trainer marketplace, public video upload, or remote admin portal is part of the first vertical slice.
