# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Office Presence – Teams app

Teams app for Consid where employees plan where they work (office / home / at a customer)
and see who is in the office. Starts with Trollhättan, must support multiple offices.

### User stories

1. As a user, I want to be able to fill in my workplace (office/home/customer) one week at a time.
2. As a user, I want to be able to fill in my workplace (office/home/customer) one day at a time.
3. As a user, I want to see who is in the office today.
4. As a user, I want to see where people plan to work on a given date.
5. As an administrator, I want to define which office an installation belongs to.

### Architecture decisions (already made – only challenge with good reason)

- **CQRS, no MediatR.** Fredrik wants commands/queries + handlers in the API. MediatR went
  commercial-licensed (paid support beyond a free tier) since v13 (2025) – not worth it for a
  company, or for ~15 endpoints. `Cqrs/` is a ~15-line hand-rolled dispatcher instead, same
  `Send()` ergonomics. Rolled out one area at a time, starting with Offices – see API code layout.
- **Tab app, not a pure bot.** Forms and lists suit an embedded web view. A bot comes later,
  for reminders only.
- **One app, multiple offices.** Not one bot/app per office. The app is installed as a
  _configurable tab_ in a channel; the config page maps `ChannelId → OfficeId`.
- **Auth:** Teams SSO (`authentication.getAuthToken()` in teams-js) → bearer token to the API,
  validated with Microsoft.Identity.Web. Users are identified by the `oid` claim.
- **Admin = Entra app role `Admin`**, not Teams channel owner.
- **Monorepo:** `api/`, `tab/`, `bot/`. Separate GitHub Actions workflows with path filters.
- **Hosting:** App Service for both the tab (Node) and the API (.NET) on one Linux plan, plus
  Azure SQL (serverless, free offer). Defined in `tab/infra/azure.bicep`, deployed by the
  Agents Toolkit `provision` step. SKU `F1` (free) for test – switch `webAppSku` to `B1` for
  production. The API's managed identity is the SQL server's Entra admin (no database password).
  The `deploy` step in `tab/m365agents.yml` builds and zip-deploys both: it writes `API_ENDPOINT`
  as `VITE_API_BASE_URL` to `tab/.env.production.local` before the tab build, then publishes the
  API from `api/OfficeBuddy.Api`, then the bot from `bot/`. Not yet run against Azure. The bot
  needs its own Entra app + Azure Bot resource, provisioned by `botAadApp/create` – action name
  and shape not verified from this environment, marked `# TBD` in `m365agents.yml`/`azure.bicep`.

### Stack

- API: ASP.NET Core minimal API, .NET 10, EF Core with SQL Server (local SQL Server in dev, Azure SQL in prod)
- Tab: React + TypeScript, Fluent UI v9 (`@fluentui/react-components`), `@microsoft/teams-js`
- Bot: Node/TypeScript, `@microsoft/teams.apps` v2 (same SDK family the tab's server already
  uses) – posts channel reminders, no UI of its own
- Tooling: Microsoft 365 Agents Toolkit (VS Code) for manifest, Entra app, debugging

### Commands

API (run from `api/`, solution `OfficeBuddy.slnx` – XML solution format, needs a recent .NET SDK):

```bash
dotnet build OfficeBuddy.slnx
dotnet run --project OfficeBuddy.Api                          # http://localhost:5247
dotnet run --project OfficeBuddy.Api --launch-profile https   # https://localhost:7139
dotnet watch --project OfficeBuddy.Api                        # hot reload
```

In Development the OpenAPI document is at `/openapi/v1.json` (no Swagger UI). Manual requests
live in `api/OfficeBuddy.Api/OfficeBuddy.Api.http` – keep it in sync with the endpoints.
The API has no tests yet. The tab has Vitest unit tests for pure logic (`*.test.ts` next to the
code, e.g. `dates.test.ts`): run `npm test` from `tab/`, and `npx tsc -p tsconfig.app.json --noEmit`
to type-check (Vite does not).

Bot (run from `bot/`, same `@microsoft/teams.apps`/`teams.api`/`teams.common` v2 packages as the
tab's server): `npm install`, `npm run dev` (nodemon, rebuilds on change) or `npm run build &&
npm start`. Reads `.env` (gitignored; not committed – see `PORT`/`SKIP_AUTH`/`API_BASE_URL`/
`INTERNAL_API_KEY` in `bot/src/index.ts`). Locally it runs with no real Entra app
(`SKIP_AUTH=true`/`dangerouslyAllowUnauthenticatedRequests`), so Teams activities aren't signature-
validated – fine for curling `/api/messages` and `/internal/messages` by hand, not for real Teams
traffic. `npm run typecheck` (`tsc --noEmit`); no tests yet.

Database (dev): SQL Server running in Docker (`docker-compose up -d` at the repo root – SA auth,
password in `docker-compose.yml` and in the `OfficeBuddy` connection string in
`appsettings.Development.json`, both dev-only). The app runs
`Database.Migrate()` at startup in every environment (single instance; in Azure the API's managed
identity is SQL admin), and `UseSeeding` adds the office "Trollhättan". In Development only,
`Data/DevSeed.cs` adds fictitious colleagues with entries from last week to three weeks ahead
(idempotent; their `Oid`s start with `00000000-0000-0000-0000-`).
Migrations live in `Data/Migrations`; `dotnet-ef` is a local tool (`api/dotnet-tools.json`):

```bash
dotnet tool restore
dotnet ef migrations add <Name> --project OfficeBuddy.Api --output-dir Data/Migrations
dotnet ef database update --project OfficeBuddy.Api
```

API code layout: entities in `Data/Entities/`, the `Location` enum in `Data/Enums/`, `OfficeBuddyDbContext`
in `Data/`. Two styles coexist while CQRS is rolled out area by area:
- **Offices (migrated – the reference for future areas):** `Features/Offices/`, one file per
  command/query (e.g. `CreateOffice.cs` holds `CreateOfficeCommand`, its outcome record, and its
  handler). `OfficeEndpoints.cs` there is a thin HTTP layer only: routes, auth, and a `switch` from
  the handler's outcome to `TypedResults.*` – no business logic, no EF calls. Handlers are
  HTTP-agnostic: a query with exactly one failure case returns a nullable DTO, anything with 2+
  distinct failure reasons gets a closed outcome record (`abstract record Foo { private Foo(){}
  sealed record Success(...); sealed record ReasonA; ... }`) – endpoints `switch` on it with no
  `_` catch-all, so a forgotten case shows up as a CS8509 warning. Handlers are called through
  `Cqrs/IDispatcher` (`Cqrs/Dispatcher.cs`, a ~15-line hand-rolled `Send()`, not MediatR – deliberate,
  see Architecture decisions), registered one line per operation in `OfficeHandlerRegistration.cs`
  (no assembly scanning). `Program.cs` resolves every registered handler once at startup (next to
  the migration call) so a missing registration is a boot-time crash, not a 500 later.
- **Channel/Me/Bot (not yet migrated):** `Endpoints/{Channel,Me,Bot}Endpoints.cs`, the older flat
  style – routes, validation and EF calls inline in one `Map…Endpoints()` extension method per
  area, called from `Program.cs` on the `/api` group (requires a valid SSO token with scope
  `access_as_user`, the default authorization policy).

Endpoints return DTO records, not entities, in both styles. Config: `AzureAd` (tenant, client id)
and `Cors:AllowedOrigins` (the tab origin) – dev values in `appsettings.Development.json`.

The tab reaches the API through `tab/src/Tab/api.ts` (SSO token + typed `ApiError` with Swedish
messages). The base URL is `VITE_API_BASE_URL`, written to `.localConfigs` by
`m365agents.local.yml` – the API must run with the `https` launch profile when debugging in Teams.

Tab (`tab/`, created with Agents Toolkit – Teams SDK v2 Node server that serves a Vite/React tab):
open `tab/` as its own VS Code workspace (`code tab`) and press F5 – `.vscode/` and
`m365agents.yml` must be at the workspace root. The Edge launch configs use a persistent debug
profile (`userDataDir` = `${userHome}/.edge-teams-debug`, works on Windows and macOS – `%LOCALAPPDATA%` is Windows-only and expands to empty on macOS); sign in once with the dev tenant
account, and make sure the Agents Toolkit extension is signed in to the same account
(`${account-hint}`).

Tenants: development happens in a separate dev tenant; production is Consid's tenant. Agents
Toolkit provisions into the tenant of the account it is signed in to and records the result per
environment in `tab/env/.env.<env>` (`local`/`dev` = dev tenant, `consid` = Consid tenant) – switch
the signed-in account when switching environment. The API is single-tenant; the tenant comes from
the `AzureAd` config section (Microsoft.Identity.Web). `oid` values differ per tenant, so dev
test data cannot be reused in Consid.

### Data model

- `Office` (Id, Name)
- `ChannelOffice` (ChannelId PK, OfficeId)
- `Person` (Oid PK, DisplayName, HomeOfficeId?)
- `WorkplaceEntry` (Id, PersonOid, Date, Location: Office|Home|Customer, OfficeId)
  – unique index on (PersonOid, Date): one row per person per day
- `BotInstallation` (TenantId PK, ServiceUrl, UpdatedAt) – no FK to anything (deliberately, so it
  can't collide with the Office/Person delete-behavior setup below). Upserted by the bot every
  time it is added to a team; the app is single-tenant, so at most one row exists. Lets the API
  reach the Bot Connector service for proactive channel messages – see `send-reminder` below.

### API (all under /api, requires SSO token)

Planned:

- `GET /offices`, `POST /offices` (Admin)
- `GET /channels/{channelId}/office`, `PUT /channels/{channelId}/office/{officeId}` (Admin)
- `GET /me/week/{year}/{week}` (ISO weeks, always Monday–Friday), `PUT /me/week` (body
  `{ officeId, days: [{ date, location }] }`; `location: null` clears the day, days left out are
  untouched; the first save creates the `Person` with that office as home office)
- `GET /offices/{id}/presence?date=` (omitted = today; returns display names grouped as
  `office`/`home`/`customer` plus the caller's own `myLocation`)
- `GET /me` (name, home office, isAdmin – so the UI can hide admin features; home office is not
  returned yet, it comes with step 6)
- `DELETE /me/days/{date}`
- `GET /offices/{id}/presence/week/{year}/{week}` (week matrix)
- `GET /offices/{id}/missing/{year}/{week}` (Admin) – people whose home office is this one and
  which weekdays of that ISO week they have no `WorkplaceEntry` for at all (any office counts –
  entries are tagged by the office filled in from, not necessarily the home office)
- `POST /offices/{id}/send-reminder` (Admin; optional `?year=&week=`, default current week) –
  posts the same missing-days summary as a plain-text message to every channel mapped to the
  office, via the bot. 404 if the bot has not been added to any team yet (no `BotInstallation`
  row); 409 if the office has no mapped channel, or the bot could not be reached for any of them
- `PUT`/`DELETE /offices/{id}` (Admin) – `POST`/`PUT` take `{ name }` and return 409 when the
  name is taken; `DELETE` returns 409 when the office is mapped to a channel or has workplace
  entries, and clears it as home office for people who had it

### Internal API (`/internal`, not under `/api` – no SSO token involved)

Server-to-server calls between the API and the bot process, guarded by a shared secret header
(`X-Internal-Api-Key`, config `Bot:InternalApiKey` / bot env `INTERNAL_API_KEY` – must match) via
`InternalAuth.cs`'s endpoint filter, not Microsoft.Identity.Web:

- `PUT /internal/bot-installation` (called by the bot, on every "added to team" event) – body
  `{ tenantId, serviceUrl }`, upserts the single `BotInstallation` row

The reverse direction (API → bot) is the bot's own `POST /internal/messages` (not part of this
API) – body `{ serviceUrl, tenantId, channelId, text }`, see `bot/src/index.ts`.

### Pitfalls already encountered

- **Teams CLI v3** (`teams project new typescript <name> --template tab`) only produces a
  bot+static-tab hybrid with no manifest/`m365agents.yml`/F5 – use Agents Toolkit instead.
- **`atk` CLI install** (`@microsoft/m365agentstoolkit-cli`) fails with `EEXIST ... npm	eamsapp`
  if the old `@microsoft/teamsapp-cli` is installed – uninstall that first.
- **Tab template ≠ target yet:** it uses `staticTabs`, no `webApplicationInfo`, no Fluent UI,
  and Graph via `@microsoft/teams.client`. Rework in steps 4–5.
- **Delete behavior:** `Office` → `WorkplaceEntries`/`ChannelOffices` is `Restrict` (an office
  in use cannot be deleted – `DELETE /offices/{id}` must handle that), `Person` →
  `WorkplaceEntries` is `Cascade`. SQL Server rejects multiple cascade paths, so keep it that way.
- **Global `dotnet-ef`** may be an older version – use the local tool (`dotnet ef` from `api/`).
- **Time zone:** use `Europe/Stockholm` explicitly for "today" – Azure runs on UTC.
- **Secrets:** Agents Toolkit creates `env/.env.*.user` and `.localConfigs` – must not be committed.
  Also ignore `*.db`, `bin/`, `obj/`, `node_modules/`, `.env*.local`, `dist/`, and the bot's own
  `.env` (`CLIENT_SECRET`/`INTERNAL_API_KEY`).
- **`@microsoft/teams.apps` breaking change inside `^2.0.0`:** `app.tokenManager`/`getBotToken()`
  went from public (2.0.x) to private between minor versions (2.1.0 made it private, with a
  comment pointing at the real supported surface). Use the documented public API instead –
  `app.tokenProvider.getAppToken()` for an app-only token, `app.send`/`app.reply` for activities
  to a conversation that already exists – and re-check `node_modules/@microsoft/teams.apps/dist/
  app.d.ts` after any version bump rather than trusting what worked before.
- **Teams app manifest, `bots[]`:** populating it for the first time is the same category of
  change as switching `staticTabs` → `configurableTabs` above – `teamsApp/update` will not
  retrofit it onto an already-installed instance of the app. Remove and re-add the app from any
  team it is already in before expecting the bot to receive an `install.add` event there.
- **Manifest:** `configurableTabs` (scope `team`, context `channelTab`) instead of `staticTabs`;
  `webApplicationInfo` is required for SSO; add the API domain under `validDomains`.
- **Changing tab type in the manifest:** `teamsApp/update` does not remove features in Developer
  Portal (the old `staticTabs` remained as a "Personal app" after switching to `configurableTabs`).
  Delete the old feature in Developer Portal, bump `version`, and remove the app from the team
  before re-adding it.
- **SSO locally:** `TAB_DOMAIN` must include the port (`localhost:3978`) – otherwise
  `getAuthToken()` fails with _App resource defined in manifest and iframe origin do not match_
  (`webApplicationInfo.resource` is compared with the tab's host:port).
- **Admin role assignment:** the `Admin` app role is assigned per user in Entra (App registrations →
  `office-buddy-aad<suffix>` → "Managed application in local directory" → Users and groups; the
  Enterprise applications list hides it behind its default "Application type" filter). Teams caches the SSO token, so a
  new assignment can take up to an hour (or a sign-out) before `roles` shows up in the token.
  Without the role nobody can map a channel to an office (`PUT /channels/…` → 403).
- **Entra:** Expose an API with scope `access_as_user`, pre-authorize the Teams client IDs
  `1fec8e78-bce4-4aaf-ab1b-5451cc387264` and `5e3ce6c0-2b1f-4285-8d4b-75ee78787346`.

### Open questions

- Should "Home"/"Customer" be shown under the person's home office or under the office they filled
  in from? (Currently: the office they filled in from.)
- Repo in Consid's GitHub organization – check with the org admin.
- Consid tenant – check with Consid IT before step 9: may we create app registrations, who grants
  admin consent for `access_as_user`, is sideloading allowed or must a Teams admin publish to the
  org app catalog, and who assigns the `Admin` app role.
- Inform employees about what data is stored (GDPR). Expose DisplayName only, never email.

### Working conventions

- Build step by step; each step must be runnable and verified before starting the next.
- Code, identifiers and code comments in English. UI text in Swedish.
- UI text: active verbs ("Spara vecka 40", not "Skicka"); error messages say what happened
  and what to do.

### Plan

1. ✅ Repo + `.gitignore` + README
2. ✅ Scaffold the tab with Agents Toolkit, get the untouched template running with F5 in Teams
3. ✅ API skeleton: models, DbContext, `GET /offices` without auth – verify with curl
4. ✅ Add SSO validation, connect the tab to the API
5. ✅ Config page + channel→office mapping
6. ✅ My week (read/save)
7. ✅ Today + arbitrary date
8. ✅ Admin role and admin endpoints
9. CI build workflows (`.github/workflows/{api,tab,bot}.yml`) ✅ done; actual deploy to Azure
   not yet run – `m365agents.yml`'s `deploy` step and `tab/infra/azure.bicep` are written but
   untested against a real subscription (Fredrik runs `provision`/`deploy` himself)
10. Reminder bot: channel message, manually triggered by an admin button – API, bot and tab code
    written and verified locally (steps above); not yet wired into real Teams (needs step 9's
    Azure/Entra provisioning first, plus removing/re-adding the app from any team already using it)
