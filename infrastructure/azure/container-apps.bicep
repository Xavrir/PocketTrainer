param location string = resourceGroup().location
param appName string = 'pockettrainer-api'
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = { name: '${appName}-env'; location: location }
resource app 'Microsoft.App/containerApps@2023-05-01' = { name: appName; location: location; properties: { managedEnvironmentId: env.id; configuration: { ingress: { external: true; targetPort: 3000; transport: 'auto' } }; template: { containers: [{ name: 'api'; image: 'ghcr.io/example/pockettrainer-api:latest'; resources: { cpu: 0.25; memory: '0.5Gi' } }]; scale: { minReplicas: 0; maxReplicas: 1 } } } }
