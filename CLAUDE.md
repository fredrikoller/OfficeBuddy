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

- **Tab app, not a pure bot.** Forms and lists suit an embedded web view. A bot comes later,
  for reminders only.
- **One app, multiple offices.** Not one bot/app per office. The app is installed as a
  _configurable tab_ in a channel; the config page maps `ChannelId → OfficeId`.
- **Auth:** Teams SSO (`authentication.getAuthToken()` in teams-js) → bearer token to the API,
  validated with Microsoft.Identity.Web. Users are identified by the `oid` claim.
- **Admin = Entra app role `Admin`**, not Teams channel owner.
- **Monorepo:** `api/`, `tab/`, later `bot/`. Separate GitHub Actions workflows with path filters.

### Stack

- API: ASP.NET Core minimal API, .NET 10, EF Core (SQLite in dev, Azure SQL in prod)
- Tab: React + TypeScript, Fluent UI v9 (`@fluentui/react-components`), `@microsoft/teams-js`
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
No tests exist yet.

### Data model

- `Office` (Id, Name)
- `ChannelOffice` (ChannelId PK, OfficeId)
- `Person` (Oid PK, DisplayName, HomeOfficeId?)
- `WorkplaceEntry` (Id, PersonOid, Date, Location: Office|Home|Customer, OfficeId)
  – unique index on (PersonOid, Date): one row per person per day

### API (all under /api, requires SSO token)

Planned:

- `GET /offices`, `POST /offices` (Admin)
- `GET /channels/{channelId}/office`, `PUT /channels/{channelId}/office/{officeId}` (Admin)
- `GET /me/week/{year}/{week}` (ISO weeks), `PUT /me/week`
- `GET /offices/{id}/presence?date=` (omitted = today)
- `GET /me` (name, home office, isAdmin – so the UI can hide admin features)
- `DELETE /me/days/{date}`
- `GET /offices/{id}/presence/week/{year}/{week}` (week matrix)
- `GET /offices/{id}/missing/{year}/{week}` (data for the reminder bot)
- `PUT`/`DELETE /offices/{id}` (Admin)

### Pitfalls already encountered

- **Teams CLI v3** changed syntax: `teams project new <language> <name> --template <template>`
  (not `teams.cli new ...`). Unclear whether a `tab` template exists – run
  `teams project new typescript --help`. Fallback: Agents Toolkit in VS Code → Teams App → Tab,
  or `atk new` (interactive) / `atk list templates`.
- **Time zone:** use `Europe/Stockholm` explicitly for "today" – Azure runs on UTC.
- **Secrets:** Agents Toolkit creates `env/.env.*.user` and `.localConfigs` – must not be committed.
  Also ignore `*.db`, `bin/`, `obj/`, `node_modules/`, `.env*.local`.
- **Manifest:** `configurableTabs` (scope `team`, context `channelTab`) instead of `staticTabs`;
  `webApplicationInfo` is required for SSO; add the API domain under `validDomains`.
- **Entra:** Expose an API with scope `access_as_user`, pre-authorize the Teams client IDs
  `1fec8e78-bce4-4aaf-ab1b-5451cc387264` and `5e3ce6c0-2b1f-4285-8d4b-75ee78787346`.

### Open questions

- Should "Home"/"Customer" be shown under the person's home office or under the office they filled
  in from? (Currently: the office they filled in from.)
- Hosting: Azure Static Web Apps (tab) + App Service or Container Apps (API)?
- Repo in Consid's GitHub organization – check with the org admin.
- Inform employees about what data is stored (GDPR). Expose DisplayName only, never email.

### Working conventions

- Build step by step; each step must be runnable and verified before starting the next.
- Code, identifiers and code comments in English. UI text in Swedish.
- UI text: active verbs ("Spara vecka 40", not "Skicka"); error messages say what happened
  and what to do.

### Plan

1. Repo + `.gitignore` + README
2. Scaffold the tab with Agents Toolkit, get the untouched template running with F5 in Teams
3. API skeleton: models, DbContext, `GET /offices` without auth – verify with curl
4. Add SSO validation, connect the tab to the API
5. Config page + channel→office mapping
6. My week (read/save)
7. Today + arbitrary date
8. Admin role and admin endpoints
9. CI/CD to Azure
10. Reminder bot
