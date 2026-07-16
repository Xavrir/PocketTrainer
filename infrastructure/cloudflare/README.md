# Cloudflare edge and R2

Cloudflare is the DNS/TLS and static-content layer. It is deliberately not part of workout synchronization or posture processing.

## API hostname

- Create a proxied CNAME such as `api.example.com` pointing to the Azure Container Apps FQDN.
- Use SSL/TLS `Full (strict)`, Always Use HTTPS, and a minimum TLS version of 1.2.
- Cache only successful `GET /v1/catalog` responses. Respect the API `Cache-Control` header and bypass cache when `Authorization` or cookies are present.
- Bypass cache for every `/v1/profile`, `/v1/progress`, `/v1/courses/*`, `/v1/assessments/*`, `/v1/plans/*`, `/v1/workout-sessions/*`, and `/v1/sync/*` request.
- Start with Cloudflare's managed WAF rules. Rate-limit authentication abuse at Supabase, not at the workout-sync path.

## R2 content bucket

- Keep the source bucket private. A separate public custom domain may serve reviewed instruction thumbnails/clips that contain no user data.
- Store versioned pose model bundles and exercise manifests under immutable keys. Publish manifests with schema version, minimum app version, SHA-256 digest, signature, and rollback version.
- Use short-lived signed URLs for any protected asset added later. Never store service-account credentials in the mobile bundle.
- Do not upload camera frames, raw landmarks, user video, access tokens, or exact location data to R2.

The initial four preview URLs are emitted from the catalog manifest. Uploading real media is a release operation; a missing preview must degrade to bundled instructions rather than blocking an offline workout.
