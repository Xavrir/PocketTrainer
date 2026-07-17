# Standalone API deployment runbook

## Recommended architecture

```text
Android release
  -> stable HTTPS API URL
  -> Azure App Service public ingress
  -> Azure Database for PostgreSQL (least-privilege runtime role, forced RLS)

Optional after origin validation:
Android -> Cloudflare api hostname -> the same Azure Web App
```

Supabase supplies bearer identity only. Cloudflare provides DNS/TLS/WAF and R2
content only. Workout authorization, progression, idempotency, and product data
remain in NestJS/PostgreSQL.

This architecture removes Metro, ADB reverse, a laptop process, and temporary
Cloudflare URLs from the APK's runtime dependencies. A named Cloudflare Tunnel
is intentionally not used: it would keep the origin-machine dependency. Railway
is intentionally not introduced because the repository has no Railway project
or deployment configuration.

## Release gates

1. Run API tests, typecheck, production build, Docker build, and Bicep compile.
2. Provision PostgreSQL and apply migrations `001` through `003` as a migration
   owner; verify forced RLS with the runtime role.
3. Publish an immutable API image to an authorized registry.
4. Obtain cost approval, then deploy the immutable image to App Service (or
   Container Apps where the subscription has environment quota).
5. Require both `/health` and `/health/ready` to pass over the Azure HTTPS FQDN.
6. Verify a real Supabase bearer bootstrap and idempotent mutation replay.
7. Put that Azure FQDN in the release environment and rebuild the APK. Release
   runtime rejects HTTP, localhost/private-network hosts, and Quick Tunnels.
8. Optionally bind/certificate a custom hostname in Azure, then enable the
   Cloudflare proxy with Full (strict) and repeat acceptance checks.

Detailed commands live in `infrastructure/azure/README.md` and
`infrastructure/cloudflare/README.md`.

## Deployed demo state (verified 2026-07-17)

- Dedicated resource group: `rg-pockettrainer-hackathon`. The unrelated
  `rg-ruteaman` resources were not modified.
- Stable origin: `https://pockettrainer-api-ae494c.azurewebsites.net` on a
  small Linux B1 App Service plan. Both health endpoints return 200.
- PostgreSQL Flexible Server 16 uses a burstable B1ms SKU, migrations 001–003,
  a separate runtime role without superuser/`BYPASSRLS`, and forced RLS.
- The API runs from an immutable ACR image digest pulled through managed
  identity. Database firewall access is narrowed to Web App outbound IPs and a
  migration-operator IP; rotate/update those rules if platform egress changes.
- Container Apps was not used because the student subscription's sole allowed
  Southeast Asia environment quota is already consumed by an unrelated project
  and other regions are policy-blocked. Cloudflare remains optional and is not
  required by the APK.
- A real-user Google callback and authenticated workout replay still require
  user interaction on the physical device; do not infer them from health checks.

## Rollback

Keep the previous image digest and mobile API hostname. If a deployment fails
readiness or bearer smoke tests, restore the previous App Service image digest. If Cloudflare
causes origin TLS or routing failures, disable the proxy and temporarily use the
already-validated Azure FQDN; do not fall back to localhost or a Quick Tunnel.
