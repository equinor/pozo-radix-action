# Azure keyvault secret-expiry checker

[![SCM Compliance](https://scm-compliance-api.radix.equinor.com/repos/equinor/pozo-radix-action/badge)](https://scm-compliance-api.radix.equinor.com/repos/equinor/pozo-radix-action/badge)

#### Azure setup
Create a Service Principal:  
`az ad sp create-for-rbac -n <your-application-name> --skip-assignment`

Which outputs something like:  
```
{  
  "appId": "generated-app-ID",
  "displayName": "dummy-app-name",
  "name": "http://dummy-app-name",
  "password": "random-password",
  "tenant": "tenant-ID"
}
```

Use the returned values as your AZURE_ secrets:
```
AZURE_CLIENT_ID="generated-app-ID"
AZURE_CLIENT_SECRET="random-password"
AZURE_TENANT_ID="tenant-ID"
```

Finally, set permissions for your SP:  
`az keyvault set-policy --name <your-key-vault-name> --spn $AZURE_CLIENT_ID --secret-permissions list`

Or you can use RBAC, in which case the SP will need the "Key Vault Secrets User" role:  
```
az role assignment create
        --role 4633458b-17de-408a-b874-0445c86b69e6
        --assignee-object-id <object_id>
        --assignee-principal-type ServicePrincipal
        --scope <scope>
        --subscription <SUBSCRIPTION_ID>
```
(object_id can be retrieved from the Azure portal)

#### Inputs
This action takes the following inputs:
* name -> Name of the environment to create / edit
* app -> Name of your application in radix
* action -> What action to perform (create, teardown, update-secrets, clear-orphans)
* vault -> name of your keyvault (required for update-secrets action)
* registry -> url to your container registry (required for teardown action)
* context -> Context for helper files


#### Helper files
This action uses a couple of (optional, falls back to `{}`) helper-files (located in `context` path):  
`component-config.json` defines the environment-config for each component (optional, falls back to `{}`)  
```json
{
    "client": {
        "replicas": 1
    },
    "api": {
        "replicas": 1,
        "resources": {
            "requests": {
                "memory": "512Mi",
                "cpu": "1000m"
            },
            "limits": {
                "memory": "1056Mi",
                "cpu": "2000m"
            }
        }
    }
}
```  
`variables.json` defines the variables per component
```json
{
    "client": {
        "CLIENT_ID": "abc-def-ghij-klm-nop"
    },
    "api": {
        "ENV": "dev",
        "DB_APP_LOGIN": "login"
    }
}
```  
`secret-map.json` is used to link the radix-secret-name to the name in your keyvault
```json
{
    "api": {
        "RADIX_SECRET_NAME": "az-kv-name",
        "DB_APP_PASSWORD": "sql-login-pass",
        "APP_INSIGHTS_KEY": "az-insights-key",
        "AZURE_STORAGE_ACCOUNT_KEY": "az-storageaccount-key",
        "CLIENT_SECRET": "az-appreg-secret"
    }
}
```

#### Ensure you have the required authentication set up in your environment:
```yaml
env:
  AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
  AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
  AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
  RADIX_TOKEN: ${{ secrets.RADIX_TOKEN }}
```


#### Examples:
```yaml
name: Create environment in radixconfig on push to feature/**
on:
  push:
    branches:
      - feature/**
jobs:
  create-env:
    runs-on: ubuntu-latest
    name: Create radix env
    steps:
      - uses: actions/checkout@v2
      - name: Get branch name
        id: get_branch
        run: |
          echo ::set-output name=BRANCH::$(echo ${GITHUB_REF,,} | sed 's:.*/::' | sed 's:_.*::')
      - uses: equinor/oilmod-radix-action
        with:
          name: ${{ steps.get_branch.outputs.BRANCH }}
          app: oilmod-my-app
          action: create
          context: ./radix-helpers
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
      - uses: peter-evans/create-pull-request@v3
        with:
          branch: radix/${{ steps.get_branch.outputs.BRANCH }}
          title: Create radix-config for ${{ steps.get_branch.outputs.BRANCH }}
          labels: radix
          body: |
            [Automated pull] Create radix-config for ${{ steps.get_branch.outputs.BRANCH }}
          commit-message: |
            [Automated commit] Create radix-config for ${{ steps.get_branch.outputs.BRANCH }}
```


```yaml
name: Teardown env when feature is merged into main
on:
  pull_request:
    branches: [ main ]
    types: [ closed ]
jobs:
  if: github.event.pull_request.merged == true
  remove-env:
    runs-on: ubuntu-latest
    name: Remove radix env from radixconfig and delete docker images
    steps:
      - uses: actions/checkout@v2
      - name: Get branch name
        id: get_branch
        run: |
          echo ::set-output name=BRANCH::$(echo ${GITHUB_REF,,} | sed 's:.*/::' | sed 's:_.*::')
      - uses: equinor/oilmod-radix-action
        with:
          name: ${{ steps.get_branch.outputs.BRANCH }}
          registry: registry-name.azurecr.io
          app: oilmod-my-app
          action: teardown
          context: ./radix-helpers
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
      - uses: peter-evans/create-pull-request@v3
        with:
          branch: teardown-radix/${{ steps.get_branch.outputs.BRANCH }}
          title: Create radix-config for ${{ steps.get_branch.outputs.BRANCH }}
          labels: radix
          body: |
            [Automated pull] Remove radix-config for ${{ steps.get_branch.outputs.BRANCH }}
          commit-message: |
            [Automated commit] Remove radix-config for ${{ steps.get_branch.outputs.BRANCH }}
```

```yaml
name: Update secrets when pushing to feature/**
on:
  push:
    branches:
      - feature/**
jobs:
  create-env:
    runs-on: ubuntu-latest
    name: Create radix env
    steps:
      - uses: actions/checkout@v2
      - name: Get branch name
        id: get_branch
        run: |
          echo ::set-output name=BRANCH::$(echo ${GITHUB_REF,,} | sed 's:.*/::' | sed 's:_.*::')
      - uses: equinor/oilmod-radix-action
        with:
          name: ${{ steps.get_branch.outputs.BRANCH }}
          app: oilmod-my-app
          action: update-secrets
          vault: app-kv-dev
          context: ./radix-helpers
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          RADIX_TOKEN: ${{ secrets.RADIX_TOKEN }}
```

```yaml
name: Clean up orphaned radix environments
on:
  schedule: # Run on a schedule
    - cron: '0 3 * * *' # run at 3 AM UTC
  workflow_dispatch: # And manually
jobs:
  create-env:
    runs-on: ubuntu-latest
    name: Create radix env
    steps:
      - uses: equinor/oilmod-radix-action
        with:
          app: oilmod-my-app
          action: clear-orphans
        env:
          RADIX_TOKEN: ${{ secrets.RADIX_TOKEN }}
```


#### Building:
Builds are performed with [@vercel/ncc](https://www.npmjs.com/package/@vercel/ncc):  
`ncc build index.ts --license licenses.txt`
