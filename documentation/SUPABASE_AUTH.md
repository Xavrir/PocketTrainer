# Supabase Auth setup

PocketTrainer uses Supabase for identity only. Profiles, workouts, progress, XP,
and health-style responses remain in Azure PostgreSQL.

The hackathon beta is connected to the hosted Supabase Cloud project
`zggbefdmbcfmlekwtoja` in `ap-southeast-1`. The project reference and client
publishable key are public configuration; service-role and secret keys remain
server/operator-only and are never committed or bundled into Android.

## 1. Create the Supabase project

1. Create a project in the Supabase dashboard.
2. In **Authentication → Providers**, enable Google and Email. PocketTrainer
   uses passwordless email OTP; users do not enter an email password.
3. Create a Google Web OAuth client. Put its client ID and client secret only in
   the Supabase Google provider settings. Add
   `https://PROJECT_REF.supabase.co/auth/v1/callback` as the Google client's
   authorized redirect URI. Never put the Google client secret in the app,
   repository, Gradle configuration, or mobile environment.
4. Add `pockettrainer://auth/callback` to Supabase's allowed redirect URLs. The
   Android manifest accepts only that scheme, host, and exact path.
5. Configure the hosted email template to render `{{ .Token }}` as a six-digit
   code. The mobile app requests the code with `signInWithOtp` and verifies it
   with `verifyOtp`; a `{{ .ConfirmationURL }}`-only magic-link template will
   not complete this secondary flow.
6. Use an asymmetric JWT signing key so the API can verify access tokens with
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

When these values are present, the app gates the product behind an Indonesian
Google-first sign-in screen. Google OAuth is the primary action. The secondary
email action calls Supabase `signInWithOtp`, then verifies the six-digit code
with `verifyOtp`. The app does not use an email callback for this code flow.

Mobile code cannot configure or rewrite the hosted Supabase email template.
That is an operator-side dashboard/Management API setting. The template must
emit `{{ .Token }}` for the shipped secondary UX to remain a numeric OTP flow.

Google OAuth uses PKCE and returns to `pockettrainer://auth/callback`; the
email OTP is verified directly in the app. The app processes warm and cold-start
Google callbacks, accepts only a PKCE authorization code (never raw session
tokens from a deep link), persists the resulting session in Android
Keystore-backed storage through `react-native-keychain`, tracks Supabase
auth-state/token-refresh events, refreshes while the app is
foregrounded, and signs out only the current device session from Profile. A
release build without Supabase configuration fails closed on a branded
configuration screen. Only debug/test builds may use
`POCKETTRAINER_ALLOW_AUTH_BYPASS=true` for local design review.

Existing installs are migrated from the previous AsyncStorage record on first
successful restore. The app writes the complete session to secure storage and
confirms that write before deleting the legacy value. If secure storage cannot
be read, written, or cleared, authentication fails closed; PocketTrainer never
falls back to plaintext persistence. A failed secure write leaves the legacy
record untouched so a later fixed build can retry migration without losing the
session. Storage errors are intentionally generic and never include session
JSON, access tokens, or refresh tokens.

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

The automated mobile checks cover callback parsing, a clean-device cold-start
callback, duplicate warm callbacks, persisted-session restoration races,
missing-session fail-closed behavior, foreground refresh behavior, and local
logout. A read-only check on 2026-07-17 confirmed that the hosted project is
healthy and publicly reports both Google and Email providers enabled. Public
settings cannot prove the redirect allow list or hosted email-template body, so
those two items still require the operator/device checks below. Before release,
repeat the full
path on a clean physical Android device:

- Tap Google first, complete provider login, and confirm the exact Android deep
  link returns to PocketTrainer without a redirect mismatch.
- Request an email OTP, verify the hosted message contains a six-digit code,
  enter it in the app, and confirm login.
- Restart the app and confirm the persisted session is restored.
- Call `GET /v1/bootstrap` and confirm the API accepts the bearer token.
- Alter or expire the token and confirm the API returns `401`.
- Background/foreground the app across token expiry and confirm refresh updates
  the bearer session.
- Sign out from Profile and confirm protected screens return to sign-in while
  other device sessions remain signed in.
- Test cancelled, expired, malformed, and replayed callback links; none should
  grant access or leave the startup screen indefinitely loading.
- Inspect the app bundle for accidental server-only keys and inspect logs for
  Google client secrets, service-role keys, access tokens, refresh tokens, or
  authorization headers. The public publishable/anon project key is expected in
  the bundle. OAuth client IDs are public identifiers, but the Google client
  secret must remain only in provider-side configuration.

## Security boundary

- The mobile Supabase configuration is limited to the project URL plus a public
  publishable key (or transitional legacy anon key). These values are not
  treated as secrets and do not grant product-data access by themselves.
- Access tokens are refreshed by Supabase and sent only in the NestJS
  `Authorization` header. A `401` triggers at most one refresh-and-retry.
- Android sessions are stored with `react-native-keychain` using AES-GCM and a
  key protected by Android Keystore. AsyncStorage is read only as a one-time
  migration source and is removed after a confirmed secure write.
- NestJS validates signature, issuer, audience, expiry, and asymmetric
  algorithm against the cached project JWKS before mapping `sub` to Azure data.
- Missing production configuration never grants anonymous access.
- Supabase rate limits remain enabled. PocketTrainer never receives a Google
  client secret and never handles or stores user password hashes.
- The client does not log credentials, sessions, request headers, or response
  bodies. User access and refresh tokens remain sensitive runtime credentials.

Official references: [React Native Auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native), [native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [passwordless email login](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [API key types](https://supabase.com/docs/guides/getting-started/api-keys), [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys), and [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields).
