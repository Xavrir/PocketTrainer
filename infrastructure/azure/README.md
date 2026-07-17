# Azure persistent API origin

Azure App Service is the deployed PocketTrainer demo origin. It replaces the
local NestJS process, ADB reverse rules, and temporary tunnel URL. Supabase
remains Auth-only; Azure Database for PostgreSQL Flexible Server stores product
data.

The verified 2026-07-17 deployment lives entirely in
`rg-pockettrainer-hackathon` and uses the stable hostname
`pockettrainer-api-ae494c.azurewebsites.net`. Provisioning is billable. The
unrelated `rg-ruteaman` resource group was not modified.

## Release prerequisites

- An Azure resource group and cost/budget approval.
- PostgreSQL Flexible Server 16+ and two connections: migration owner and a
  least-privilege runtime role without `BYPASSRLS`.
- An immutable API image in an existing registry that App Service can pull by
  managed identity.
- Hosted Supabase project URL/issuer. No Supabase service-role key is needed.
- A stable HTTPS content origin. Do not use `*.trycloudflare.com`.

Apply all database migrations in numeric order with the migration owner:

```bash
for migration in database/migrations/*.sql; do
  psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

Create and grant the runtime role using `database/README.md`, then use only its
connection URI as the `databaseUrl` deployment secret.

## Build and validate

Run from the monorepo root. Use an immutable tag or digest for a real release;
do not deploy `latest`.

```bash
docker build -f apps/api/Dockerfile -t pockettrainer-api:local .
docker inspect --format '{{json .Config.Healthcheck}}' pockettrainer-api:local

az bicep build --file infrastructure/azure/container-apps.bicep
az deployment group what-if \
  --resource-group pockettrainer-beta \
  --template-file infrastructure/azure/container-apps.bicep \
  --parameters image=REGISTRY/pockettrainer-api:IMMUTABLE_TAG \
  supabaseUrl=https://PROJECT.supabase.co \
  contentBaseUrl=https://content.example.com \
  databaseUrl="$DATABASE_URL"
```

`what-if` is still an authenticated Azure operation, but it does not create the
deployment. Keep database URLs in a secret store or ephemeral environment
variable and never paste them into source, logs, chat, or release notes.

## Container Apps alternative

The checked-in Container Apps template remains available for subscriptions with
regional environment quota. Only run it after resource/cost approval:

```bash
az deployment group create \
  --resource-group pockettrainer-beta \
  --template-file infrastructure/azure/container-apps.bicep \
  --parameters image=REGISTRY/pockettrainer-api:IMMUTABLE_TAG \
  supabaseUrl=https://PROJECT.supabase.co \
  contentBaseUrl=https://content.example.com \
  databaseUrl="$DATABASE_URL"
```

The student subscription used for the demo could not deploy a second Southeast
Asia Container Apps environment, and its policy blocked other regions. App
Service B1 was therefore used in the dedicated resource group instead of
touching the unrelated existing environment.

## Acceptance checks

```bash
curl --fail --silent --show-error "$API_BASE_URL/health"
curl --fail --silent --show-error "$API_BASE_URL/health/ready"
```

Then verify one real Supabase bearer request and one idempotent retry without
printing the token. `GET /health` proves the process is alive;
`GET /health/ready` additionally proves the configured data store responds.

App Service B1 is configured Always On. Roll back by restoring the previous
known-good image digest; do not mutate an existing release tag. If the App
Service platform changes outbound addresses, update the PostgreSQL firewall
rules before removing the previous addresses.

## Cost and teardown

The B1 App Service plan, B1ms PostgreSQL server, and Basic container registry
consume Azure credit while provisioned. Stopping only the Web App does not stop
the App Service plan charge. After the demo and artifact verification, inspect
the dedicated resource group and remove it only with explicit owner approval:

```bash
az resource list --resource-group rg-pockettrainer-hackathon --output table
az group delete --name rg-pockettrainer-hackathon --yes
```

Never run that deletion against the unrelated `rg-ruteaman` group.
