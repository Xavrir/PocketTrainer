# Architecture

## Core boundary

The native movement engine owns camera capture, pose inference, smoothing, state transitions, scoring, feedback arbitration, and skeleton rendering. JavaScript receives compact typed events only.

## Identity and product data

Supabase Auth issues the mobile session. NestJS validates its asymmetric JWT through JWKS and maps `sub` to an internal `users.id` in Azure PostgreSQL. There are no cross-database foreign keys or distributed transactions. Supabase contains no PocketTrainer workout, profile, or progress rows.

## Offline completion

The mobile app writes a session locally before showing completion, then appends a sync command with a client-generated idempotency key. The API stores processed keys and returns the original result for duplicate submissions. XP and unlocks are server-authoritative; the app may show a clearly labeled offline preview.

## Content publishing

Published exercise definitions are immutable. Every manifest includes schema, exercise, scoring, model, minimum-app, checksum, signature, and rollback versions. The application retains the last known-safe compatible bundle when validation fails.

## Deliberate V1 exclusions

No Redis, standalone queue, nutrition, health integration, gym discovery, public leaderboard, trainer marketplace, public video upload, or remote admin portal is part of the first vertical slice.
