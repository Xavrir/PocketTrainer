# Security Policy

## Supported versions

PocketTrainer is pre-release software. Security fixes are applied to the latest checkpoint release.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities or exposed credentials. Contact the repository owner privately through GitHub with:

- affected component and checkpoint/tag;
- reproduction steps;
- impact and any privacy implications;
- suggested mitigation, if known.

Please do not access another person’s account, workout data, or cloud resources while testing.

## Security invariants

- Raw workout frames and landmark streams stay on-device.
- Supabase service credentials never ship in the mobile application.
- Product data is stored in Azure PostgreSQL behind the API and forced RLS.
- Every offline mutation has an idempotency key.
- Exercise manifests are versioned, checksummed, signed, and rollback-capable.
