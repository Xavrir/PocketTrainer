# Azure beta deployment

PocketTrainer runs its NestJS container in Azure Container Apps and stores all product data in Azure Database for PostgreSQL Flexible Server. Supabase remains Auth-only.

1. Create a PostgreSQL Flexible Server using the burstable B1ms tier, 32 GiB storage, PostgreSQL 16+, seven-day backup retention, and the Indonesia Central or Southeast Asia region. Enable budget alerts before beta enrollment.
2. Apply `database/migrations/001_foundation.sql` with a migration-owner connection and create the least-privilege runtime role described in `database/README.md`.
3. Put the runtime connection URI in the `databaseUrl` secure Bicep parameter. It becomes a Container Apps secret, not a plain environment value in source control.
4. Build `apps/api/Dockerfile` from the monorepo root, push it, then deploy:

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/OWNER/pockettrainer-api:TAG .
docker push ghcr.io/OWNER/pockettrainer-api:TAG
```

Deploy the image:

```bash
az deployment group create --resource-group pockettrainer-beta \
  --template-file infrastructure/azure/container-apps.bicep \
  --parameters image=ghcr.io/OWNER/pockettrainer-api:TAG \
  supabaseUrl=https://PROJECT.supabase.co \
  contentBaseUrl=https://content.example.com \
  databaseUrl="$DATABASE_URL"
```

Container Apps scales to zero for the beta. Expect a cold start; set `minReplicas=1` only after latency data justifies the cost. Review the hosting plan in month nine, before introductory Azure credits expire. Use distinct resources and credentials before public launch.
