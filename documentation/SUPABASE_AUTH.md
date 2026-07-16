# Supabase Auth setup

PocketTrainer uses Supabase for identity only. Profiles, workouts, progress, XP,
and health-style responses remain in Azure PostgreSQL.

The hackathon beta is connected to the hosted Supabase Cloud project
`zggbefdmbcfmlekwtoja` in `ap-southeast-1`. The project reference and client
publishable key are public configuration; service-role and secret keys remain
server/operator-only and are never committed or bundled into Android.

## 1. Create the Supabase project

1. Create a project in the Supabase dashboard.
2. In **Authentication → Providers**, enable Email and Password.
3. Keep email confirmation enabled for public environments. For local demos,
   either confirm the test user from the email link or create it in the
   dashboard.
4. Use an asymmetric JWT signing key so the API can verify access tokens with
   the project JWKS endpoint.

Do not create PocketTrainer product tables in the Supabase project. Never put a
legacy `service_role` key or an `sb_secret_...` key in the mobile application.

## 2. Configure the mobile app

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set:

```dotenv
POCKETTRAINER_SUPABASE_URL=https://PROJECT_REF.supabase.co
POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
POCKETTRAINER_API_BASE_URL=http://10.0.2.2:3000
POCKETTRAINER_ALLOW_AUTH_BYPASS=false
```

`POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY` should normally contain a current
`sb_publishable_...` key. An older project's legacy `anon` JWT also works in
this variable during migration. Both key types are public project identifiers,
not secrets or user authorization; anyone can recover them from an installed
mobile build. PocketTrainer rejects `sb_secret_...` values and legacy JWTs whose
payload identifies the `service_role`, but operators must still copy the value
from the dashboard's client-side **Publishable key** (or legacy **anon key**)
field. Restart Metro and rebuild Android after changing native environment
values.

When these values are present, the app gates the product behind the Indonesian
sign-in/sign-up screen, persists the session with AsyncStorage, refreshes tokens
while active, and enables sign-out in Profile. A release build without Supabase
configuration fails closed on a branded configuration screen. Only debug/test
builds may use `POCKETTRAINER_ALLOW_AUTH_BYPASS=true` for local design review.

Email/password is intentional for this checkpoint: it works with the free
hosted project without adding an OAuth provider credential or depending on the
free mailer's restricted numeric-OTP template. Google OAuth and passwordless
OTP can be added later as separately configured providers; they are not exposed
as non-functional buttons in this release.

## 3. Configure the NestJS API

Set the matching project values in `apps/api/.env`:

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_JWT_ISSUER=https://PROJECT_REF.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
ALLOW_INSECURE_DEV_AUTH=false
```

The mobile API client sends the active user access token as
`Authorization: Bearer <token>`. NestJS verifies signature, issuer, audience,
and expiry through the cached Supabase JWKS endpoint, then maps JWT `sub` to an
internal Azure `user_id` through `auth_identities`.

## 4. Mobile API interface

Import the typed route client from `apps/mobile/src/api` or the React hooks from
`apps/mobile/src/data`. The route methods match the current Nest controllers:

| Method                                                         | HTTP operation                           | Result              |
| -------------------------------------------------------------- | ---------------------------------------- | ------------------- |
| `getBootstrap(options?)`                                       | `GET /v1/bootstrap`                      | `Bootstrap`         |
| `getCatalog(options?)`                                         | `GET /v1/catalog`                        | `Catalog`           |
| `getProfile(options?)`                                         | `GET /v1/profile`                        | `Profile`           |
| `updateProfile(input, { idempotencyKey })`                     | `PUT /v1/profile`                        | `Profile`           |
| `updateConsent(type, input, { idempotencyKey })`               | `PUT /v1/consents/:type`                 | `Consent`           |
| `createWorkoutSession(input, { idempotencyKey })`              | `POST /v1/workout-sessions`              | `WorkoutSession`    |
| `uploadWorkoutResults(sessionId, input, { idempotencyKey })`   | `PUT /v1/workout-sessions/:id/results`   | `WorkoutSession`    |
| `completeWorkoutSession(sessionId, input, { idempotencyKey })` | `POST /v1/workout-sessions/:id/complete` | `WorkoutCompletion` |
| `getProgress(options?)`                                        | `GET /v1/progress`                       | `Progress`          |

Every mutation requires a caller-owned, stable idempotency key. Reuse the same
key when retrying the same payload; do not generate a new key merely because a
request timed out. `persistOnboarding` records requested consents before writing
the profile's `onboardingCompleted` marker. `completeWorkoutFlow` executes the
idempotent create, result-upload, and authoritative completion calls in order.
The hooks `useBootstrapData`, `useOnboardingPersistence`, and
`useWorkoutCompletion` expose loading, typed data, and `ApiClientError` state to
`App.tsx` without moving product data into Supabase.

`ApiClientError` carries `status`, API `code`, `recoverable`, `requestId`, and
optional `details`. A `401` triggers at most one Supabase refresh and retry.
Invalid JSON, empty success bodies, configuration failures, authentication
failures, and network failures are normalized into explicit client error codes.

## 5. Verification checklist

The hosted beta has passed the physical-device smoke path: sign in, persist the
session across an Android reinstall/restart, call local NestJS
`GET /v1/bootstrap` with the Supabase access token, and render the authenticated
Home screen. Temporary test identities are removed after validation.

- Register a new email and verify that confirmation is required.
- Sign in, restart the app, and confirm the session is restored.
- Call `GET /v1/bootstrap` and confirm the API accepts the bearer token.
- Alter or expire the token and confirm the API returns `401`.
- Sign out from Profile and confirm protected screens return to sign-in.
- Inspect the app bundle for accidental server-only keys and inspect logs for
  access tokens, refresh tokens, passwords, or authorization headers. The public
  publishable/anon project key is expected to be present in the app bundle.

## Security boundary

- The mobile Supabase configuration is limited to the project URL plus a public
  publishable key (or transitional legacy anon key). These values are not
  treated as secrets and do not grant product-data access by themselves.
- Access tokens are refreshed by Supabase and sent only in the NestJS
  `Authorization` header. A `401` triggers at most one refresh-and-retry.
- NestJS validates signature, issuer, audience, expiry, and asymmetric
  algorithm against the cached project JWKS before mapping `sub` to Azure data.
- Missing production configuration never grants anonymous access.
- Supabase rate limits and email confirmation remain enabled; PocketTrainer
  never handles or stores password hashes itself.
- The client does not log credentials, sessions, request headers, or response
  bodies. User access and refresh tokens remain sensitive runtime credentials.

Official references: [React Native Auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native), [API key types](https://supabase.com/docs/guides/getting-started/api-keys), [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys), and [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields).
