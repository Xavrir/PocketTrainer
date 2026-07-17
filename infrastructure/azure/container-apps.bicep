@description('Azure region for the Container Apps environment.')
param location string = resourceGroup().location

@description('Container image produced by the release workflow.')
@minLength(1)
param image string

@description('Azure Container Registry login server that hosts the API image.')
@minLength(1)
param registryServer string

@description('User-assigned managed identity resource ID with AcrPull on the registry.')
@minLength(1)
param registryIdentityResourceId string

@description('Full Azure PostgreSQL connection string for the least-privilege runtime role.')
@secure()
param databaseUrl string

@description('Supabase project URL used only for Auth/JWKS.')
@minLength(1)
param supabaseUrl string

@description('Cloudflare R2 custom domain or content origin.')
@minLength(1)
param contentBaseUrl string

@description('Comma-separated browser development origins. Native clients do not require CORS.')
param corsOrigins string = ''

@minLength(2)
@maxLength(32)
param appName string = 'pockettrainer-api'

@minValue(0)
@maxValue(3)
param minReplicas int = 0

@minValue(1)
@maxValue(10)
param maxReplicas int = 3

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-environment'
  location: location
  properties: {}
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${registryIdentityResourceId}': {}
    }
  }
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
      registries: [
        {
          server: registryServer
          identity: registryIdentityResourceId
        }
      ]
    }
    template: {
      terminationGracePeriodSeconds: 30
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
            {
              type: 'Startup'
              httpGet: { path: '/health', port: 3000, scheme: 'HTTP' }
              periodSeconds: 2
              timeoutSeconds: 2
              failureThreshold: 30
            }
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 3000, scheme: 'HTTP' }
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health/ready', port: 3000, scheme: 'HTTP' }
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
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
output apiBaseUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output livenessUrl string = 'https://${app.properties.configuration.ingress.fqdn}/health'
output readinessUrl string = 'https://${app.properties.configuration.ingress.fqdn}/health/ready'
