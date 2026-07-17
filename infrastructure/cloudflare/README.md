# Cloudflare edge and R2

Cloudflare is the optional DNS/TLS edge and static-content layer. The
persistent NestJS process runs in Azure App Service; Cloudflare is not a
substitute origin and never receives Supabase service-role or database keys.

## API hostname

Start releases on the Azure-provided `https://*.azurewebsites.net` FQDN.
That URL is stable for the lifetime of the Web App and does not depend on
a developer machine.

To add `api.example.com`:

1. Obtain the Web App FQDN and `customDomainVerificationId`.
2. In Cloudflare DNS, create `api` as a **DNS-only** CNAME to the Azure FQDN and
   create the Azure ownership TXT record (normally `asuid.api`).
3. Bind the hostname and an Azure managed certificate while the validation
   records are visible:

   ```bash
   az webapp config hostname add \
     --resource-group rg-pockettrainer-hackathon \
     --webapp-name pockettrainer-api-ae494c \
     --hostname api.example.com
   ```

4. Verify `https://api.example.com/health` and `/health/ready` directly.
5. Enable the Cloudflare proxy, set SSL/TLS to **Full (strict)**, enable Always
   Use HTTPS, and require TLS 1.2 or newer. Re-run both health checks.

Azure must know the custom hostname and present a matching certificate before
Cloudflare proxying. Otherwise Full (strict) can fail origin validation.

For the hackathon API, bypass cache for the entire API hostname. In particular,
never cache requests carrying `Authorization` or cookies, and never cache
profile, progress, plan, assessment, workout, sync, or privacy routes. Managed
WAF rules are appropriate, but rate limits must not break legitimate offline
idempotent replay.

## Tunnel policy

- A Quick Tunnel (`*.trycloudflare.com`) is development-only because its URL is
  temporary. Mobile release configuration rejects it.
- A named tunnel has a stable hostname but still depends on whatever machine or
  process runs `cloudflared`. It is not the PocketTrainer release origin.
- No Cloudflare Worker reverse proxy is required when Azure App Service has
  public HTTPS ingress. Adding one would create another runtime and failure
  boundary without solving persistence.

## R2 content bucket

- Keep the source bucket private. A separate public custom domain may serve
  reviewed instruction thumbnails/clips that contain no user data.
- Store versioned pose model bundles and exercise manifests under immutable
  keys. Publish manifests with schema version, minimum app version, SHA-256
  digest, signature, and rollback version.
- Use short-lived signed URLs for protected assets added later. Never store
  service-account credentials in the mobile bundle.
- Never upload camera frames, raw landmarks, user video, access tokens, or exact
  location data to R2.

Uploading media is a separate authorized release operation. Missing remote
content must degrade to bundled instructions rather than blocking an offline
workout.
