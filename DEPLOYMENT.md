# Deploying NeuroPay AI

NeuroPay AI ships as a **single Node service** that serves both the JSON API and
the built React dashboard. The database is hosted Postgres, so the service is
stateless — deployable to any container host, including free tiers with no
persistent disk.

## Architecture

| Layer | Technology | Location |
| --- | --- | --- |
| Backend API | Node 18+ / Express / TypeScript | `packages/api` |
| Frontend | React 18 + Vite (built to static files) | `packages/web` |
| Database | Postgres via `pg` | hosted (`DATABASE_URL`) |
| Auth | JWT (HS256) + bcrypt password hashes | `packages/api/src/services/auth.ts` |
| Tenant isolation | `tenant_id` on every row, scoped from the JWT | `packages/api/src/db/repositories/crud.ts` |
| AI boundary | Pluggable estimator (local heuristic → OpenAI) | `packages/api/src/ai/estimator.ts` |
| Payments boundary | Manual ↔ Stripe, reported at `/api/system/boundaries` | `packages/api/src/routes/system.ts` |

The API serves the compiled web bundle from `packages/web/dist`, so there is one
process and one URL. There is no separate frontend host.

## Environment variables

All values are read from the process environment. **Never commit them.**

| Name | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | Defaults to `8080`; most hosts inject this |
| `DATABASE_URL` | yes | Postgres connection string, e.g. a Supabase project's session-pooler URL (port 5432) |
| `JWT_SECRET` | **yes** | ≥16 chars. Boot refuses to start without it. `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `ADMIN_EMAIL` | first boot | Initial owner account |
| `ADMIN_PASSWORD` | first boot | Initial owner password |
| `SEED_ON_BOOT` | no | `true` provisions the demo tenant once, when the DB is empty |

> **First-boot credential.** With `SEED_ON_BOOT=true` and no `ADMIN_EMAIL` /
> `ADMIN_PASSWORD` set, the seed creates `admin@example.com` / `ChangeMe123!`.
> Set both explicitly and change the password immediately after the first login.
> The seed only runs once — it is skipped whenever the tenant already exists.
| `CORS_ORIGIN` | no | Comma-separated allow-list; `*` (default) reflects all |
| `PUBLIC_APP_URL` | no | Public base URL |
| `OPENAI_API_KEY` | no | Enables generative estimates; absent → local heuristic |
| `AI_MODEL` | no | Default `gpt-4o-mini` |
| `STRIPE_SECRET_KEY` | no | Enables the Stripe payment boundary; absent → manual mode |

Set these through your host's encrypted secret store (Render Environment,
Fly secrets, Docker secrets, or your platform's equivalent). Do not put them in
`render.yaml`, a compose file checked into git, or the Dockerfile.

## Option A — Render (blueprint included)

`render.yaml` defines a Docker web service on the **free** plan with **no
persistent disk** — all state lives in the hosted Postgres that `DATABASE_URL`
points at (e.g. a free Supabase project).

1. Create a Postgres database (free tier is fine) and copy its connection
   string — for Supabase, the session-pooler string (port 5432).
2. Push the repo to GitHub.
3. In Render: **New → Blueprint**, select the repo. It reads `render.yaml`.
4. Set the `sync: false` secrets in the dashboard: `DATABASE_URL` (the string
   from step 1), `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (and optionally
   `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`).
5. Apply. Render builds the Dockerfile and starts the service. Migrations run
   automatically on first boot.
6. Health check path is `/health`.

## Option B — any Docker host

The production compose file brings its own Postgres:

```bash
POSTGRES_PASSWORD="a-strong-db-password" JWT_SECRET="$(openssl rand -base64 48)" \
  docker compose -f docker-compose.prod.yml up -d --build
```

Or run the image directly against any reachable Postgres:

```bash
docker build -t neuropay-ai .
docker run -d --name neuropay-ai -p 8080:8080 \
  -e DATABASE_URL="postgres://user:password@host:5432/dbname" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e ADMIN_EMAIL="you@yourdomain.com" \
  -e ADMIN_PASSWORD="a-strong-password" \
  -e SEED_ON_BOOT=true \
  neuropay-ai
```

## Option C — Fly.io

```bash
fly launch --no-deploy          # detect the Dockerfile
fly secrets set DATABASE_URL="postgres://..." JWT_SECRET="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..."
fly deploy
```

## Database migrations

Migrations run **automatically on boot** (`runMigrations()` in
`packages/api/src/index.ts`) and are idempotent — applied files are recorded in
`schema_migrations` and never re-run. There is no separate migrate step in
production, though `npm run migrate --workspace=@neuropay/api` runs them
explicitly.

## Local development

```bash
npm install
cp .env.example .env          # then set JWT_SECRET etc.
npm run migrate --workspace=@neuropay/api
npm run dev                   # if a dev script is added; otherwise build+start
```

Build and run the production bundle locally:

```bash
npm run build
JWT_SECRET=dev-secret-at-least-16-chars DATABASE_URL=postgres://neuropay:neuropay@localhost:5432/neuropay \
  SEED_ON_BOOT=true node packages/api/dist/index.js
```

## Verification after deploy

```bash
curl -sf https://<your-host>/health          # {"status":"ok",...}
curl -sf https://<your-host>/ready           # {"status":"ready","db":"ok",...}
curl -s -X POST https://<your-host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'
```

`/health` proves the process is up; `/ready` additionally proves the database is
reachable — use `/ready` as the real readiness gate.

## Container security model

The image runs as the built-in unprivileged **`node`** user (uid 1000), not root.
The image is stateless — no data directory, no volumes — because all state lives
in the hosted Postgres reached via `DATABASE_URL`. The connection string is a
secret: it is only ever supplied through the host's environment, never baked
into the image or committed.

## Operational notes

- **`JWT_SECRET` rotation** invalidates all existing sessions. Expected.
- **Backups**: handled by the Postgres provider (e.g. Supabase's automatic
  backups / point-in-time recovery on paid tiers, or `pg_dump` against
  `DATABASE_URL` for self-hosted).
- **Scaling**: the app is stateless and pool-based, so replicas are safe. Keep
  the total pool size across replicas within the database's connection limit —
  behind a transaction pooler (e.g. Supabase pooler port 6543) this is a
  non-issue at small scale.
- **Login rate limiting** is in-process (fixed window, 100 attempts / 15 min per
  IP). Behind multiple replicas each holds its own counter; move to a shared
  store when you scale out.

## Continuous integration

The workflow runs `npm ci` → typecheck → test → build on every push and on pull
requests targeting `main`. A red run blocks a deploy by convention; run the same
checks locally with:

```bash
npm run typecheck && npm test && npm run build
```

### Status: not yet activated

The workflow lives at `ci/github-actions-ci.yml`, which GitHub **does not read**.
It must sit at `.github/workflows/ci.yml` to run.

This indirection is deliberate. The GitHub App token used to automate this
repository does not hold the **`workflows`** permission, and GitHub refuses that
path through both available routes:

| Route | Result |
| --- | --- |
| `git push` adding a file under `.github/workflows/` | rejected — "refusing to allow a GitHub App to create or update workflow ... without `workflows` permission" |
| Contents API `PUT /contents/.github/workflows/ci.yml` | `403 Resource not accessible by integration` |

The workflow is therefore parked outside the protected path, and activation is one
command.

### Activating it

**Option 1 — locally, if your login has the `workflows` scope:**

```bash
gh auth refresh -s workflow     # add the scope if missing
./ci/activate-ci.sh             # or: ./ci/activate-ci.sh main
```

The script moves the file into `.github/workflows/ci.yml`, commits it, and pushes.

**Option 2 — entirely in the browser, no tooling:**

1. Open https://github.com/longsholdingsllc/neuropay-ai/new/main/.github/workflows
2. Name the file `ci.yml`
3. Paste the contents of `ci/github-actions-ci.yml`
4. Commit

**Option 3 — grant the automating App the `workflows` permission**, after which the
path becomes writable and the move can be done directly. This is a repository-
settings change made by an owner, not something the token can self-grant.

Until activated, run the four checks locally before deploying. Nothing else in the
deployment path depends on CI.
