@description('Azure region for the Container Apps environment.')
param location string = resourceGroup().location

@description('Container image produced by the release workflow.')
param image string

@description('Full Azure PostgreSQL connection string for the least-privilege runtime role.')
@secure()
param databaseUrl string

@description('Supabase project URL used only for Auth/JWKS.')
param supabaseUrl string

@description('Cloudflare R2 custom domain or content origin.')
param contentBaseUrl string

@description('Comma-separated browser development origins. Native clients do not require CORS.')
param corsOrigins string = ''

param appName string = 'pockettrainer-api'
param minReplicas int = 0
param maxReplicas int = 3

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-environment'
  location: location
  properties: {}
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        { name: 'database-url', value: databaseUrl }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'DATA_STORE', value: 'postgres' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DATABASE_SSL', value: 'true' }
            { name: 'DATABASE_POOL_MAX', value: '10' }
            { name: 'SUPABASE_URL', value: supabaseUrl }
            { name: 'SUPABASE_JWT_ISSUER', value: '${supabaseUrl}/auth/v1' }
            { name: 'SUPABASE_JWT_AUDIENCE', value: 'authenticated' }
            { name: 'CONTENT_BASE_URL', value: contentBaseUrl }
            { name: 'CORS_ORIGINS', value: corsOrigins }
            { name: 'ALLOW_INSECURE_DEV_AUTH', value: 'false' }
            { name: 'OUTBOX_POLL_MS', value: '30000' }
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/health', port: 3000 }, initialDelaySeconds: 3, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/health/ready', port: 3000 }, initialDelaySeconds: 5, periodSeconds: 15 }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          { name: 'http-concurrency', http: { metadata: { concurrentRequests: '50' } } }
        ]
      }
    }
  }
}

output apiHostname string = app.properties.configuration.ingress.fqdn
