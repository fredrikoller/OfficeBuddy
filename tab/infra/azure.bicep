@maxLength(20)
@minLength(4)
@description('Used to generate names for all resources in this file')
param resourceBaseName string

@description('App Service plan SKU. F1 is free (60 CPU minutes/day per app, no Always On); use B1 or higher for production.')
param webAppSku string

@description('Client id of the Entra app that the API validates SSO tokens against (AAD_APP_CLIENT_ID).')
param aadClientId string

@description('Tenant the API accepts tokens from (AAD_APP_TENANT_ID).')
param aadTenantId string

// TBD: the bot needs its own Entra app registration (separate from the tab's SSO app), created
// by a provision step not yet written – see m365agents.yml. These three are its output.
@description('Client id of the bots own Entra app (BOT_ID in the Teams manifest, CLIENT_ID for the bot process).')
param botClientId string

@secure()
@description('Client secret for the bots Entra app (CLIENT_SECRET for the bot process).')
param botClientSecret string

@secure()
@description('Shared secret the API and bot use to authenticate their server-to-server calls.')
param botInternalApiKey string

param serverfarmsName string = resourceBaseName
param tabAppName string = '${resourceBaseName}-tab'
param apiAppName string = '${resourceBaseName}-api'
param botAppName string = '${resourceBaseName}-bot'
param sqlServerName string = toLower('${resourceBaseName}-sql')
param sqlDatabaseName string = 'OfficeBuddy'
param location string = resourceGroup().location

// Always On is not available on the free and shared tiers.
var alwaysOn = !contains(
  [
    'F1'
    'D1'
  ],
  webAppSku
)

// One Linux plan shared by the tab and the API.
resource serverfarm 'Microsoft.Web/serverfarms@2022-09-01' = {
  kind: 'linux'
  location: location
  name: serverfarmsName
  sku: {
    name: webAppSku
  }
  properties: {
    reserved: true // Linux
  }
}

// The Teams tab: the Node server (Teams SDK) that serves the React build.
resource tabApp 'Microsoft.Web/sites@2022-09-01' = {
  kind: 'app,linux'
  location: location
  name: tabAppName
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'node dist/index.js'
      alwaysOn: alwaysOn
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      appSettings: [
        {
          // The deployed package is already built (dist/ and node_modules/ included).
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'RUNNING_ON_AZURE'
          value: '1'
        }
      ]
    }
  }
}

// The API. Its managed identity is the SQL server's administrator, so no database password exists.
resource apiApp 'Microsoft.Web/sites@2022-09-01' = {
  kind: 'app,linux'
  location: location
  name: apiAppName
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: alwaysOn
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AzureAd__Instance'
          value: environment().authentication.loginEndpoint
        }
        {
          name: 'AzureAd__TenantId'
          value: aadTenantId
        }
        {
          name: 'AzureAd__ClientId'
          value: aadClientId
        }
        {
          // The tab calls the API from the browser, so its origin must be allowed.
          name: 'Cors__AllowedOrigins__0'
          value: 'https://${tabApp.properties.defaultHostName}'
        }
        {
          name: 'ConnectionStrings__OfficeBuddy'
          value: 'Server=tcp:${sqlServerName}${environment().suffixes.sqlServerHostname},1433;Database=${sqlDatabaseName};Authentication=Active Directory Default;Encrypt=True;'
        }
        {
          name: 'Bot__BaseUrl'
          value: 'https://${botApp.properties.defaultHostName}'
        }
        {
          name: 'Bot__InternalApiKey'
          value: botInternalApiKey
        }
      ]
    }
  }
}

// The reminder bot: posts channel messages when an admin sends a reminder (see bot/src/index.ts).
// Its API_BASE_URL is the default azurewebsites.net hostname, spelled out rather than referencing
// apiApp.properties.defaultHostName, to avoid a circular dependency (apiApp already depends on
// this resource for Bot__BaseUrl above).
resource botApp 'Microsoft.Web/sites@2022-09-01' = {
  kind: 'app,linux'
  location: location
  name: botAppName
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'node dist/index.js'
      alwaysOn: alwaysOn
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'CLIENT_ID'
          value: botClientId
        }
        {
          name: 'CLIENT_SECRET'
          value: botClientSecret
        }
        {
          name: 'TENANT_ID'
          value: aadTenantId
        }
        {
          // Hardcoded public-cloud App Service suffix (not derived from apiApp.properties, to
          // avoid a circular dependency). TBD: wrong if ever deployed to a sovereign cloud.
          name: 'API_BASE_URL'
          value: 'https://${apiAppName}.azurewebsites.net'
        }
        {
          name: 'INTERNAL_API_KEY'
          value: botInternalApiKey
        }
      ]
    }
  }
}

// TBD: resource type/API version and property shape not verified against a live schema from this
// environment – check https://learn.microsoft.com/azure/templates/microsoft.botservice/botservices
// before provisioning.
resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  name: botAppName
  location: 'global'
  kind: 'azurebot'
  sku: {
    name: 'F0'
  }
  properties: {
    displayName: botAppName
    endpoint: 'https://${botApp.properties.defaultHostName}/api/messages'
    msaAppId: botClientId
    msaAppType: 'SingleTenant'
    msaAppTenantId: aadTenantId
  }
}

resource botTeamsChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: botService
  name: 'MsTeamsChannel'
  location: 'global'
  properties: {
    channelName: 'MsTeamsChannel'
  }
}

// Entra-only authentication with the API's managed identity as administrator.
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  location: location
  name: sqlServerName
  properties: {
    minimalTlsVersion: '1.2'
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      principalType: 'Application'
      login: apiAppName
      sid: apiApp.identity.principalId
      tenantId: subscription().tenantId
    }
  }
}

// Lets Azure-hosted services (the API on App Service) reach the server; sign-in still requires
// the managed identity.
resource sqlAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Serverless database on the Azure SQL free offer (100,000 vCore seconds and 32 GB per month).
// It pauses when idle and when the free amount is used up, instead of starting to cost money.
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  location: location
  name: sqlDatabaseName
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
  }
  properties: {
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
    autoPauseDelay: 60
    minCapacity: json('0.5')
  }
}

// The outputs will be persisted in .env.{envName}. Visit https://aka.ms/teamsfx-actions/arm-deploy for more details.
output AZURE_APP_SERVICE_RESOURCE_ID string = tabApp.id // used in deploy stage
output TAB_DOMAIN string = tabApp.properties.defaultHostName
output TAB_ENDPOINT string = 'https://${tabApp.properties.defaultHostName}'
output API_APP_SERVICE_RESOURCE_ID string = apiApp.id
output API_DOMAIN string = apiApp.properties.defaultHostName
output API_ENDPOINT string = 'https://${apiApp.properties.defaultHostName}'
output BOT_APP_SERVICE_RESOURCE_ID string = botApp.id
output BOT_DOMAIN string = botApp.properties.defaultHostName
output BOT_ENDPOINT string = 'https://${botApp.properties.defaultHostName}'
