# Deploying NeuroPay AI

NeuroPay AI ships as a **single Node service** that serves both the JSON API and
the built React dashboard. That makes it deployable to any container host with a
persistent disk.

## Architecture

| Layer | Technology | Location |
| --- | --- | --- |
| Backend API | Node 18+ / Express / TypeScript | `packages/api` |
| Frontend | React 18 + Vite (built to static files) | `packages/web` |
| Database | SQLite via `better-sqlite3` | file on disk |
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
| `DATABASE_URL` | yes | `file:/app/packages/api/data/neuropay.db` on a container host |
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

`render.yaml` defines a Docker web service with a 1 GB persistent disk mounted at
`/app/packages/api/data` (where SQLite lives).

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, select the repo. It reads `render.yaml`.
3. Set the `sync: false` secrets in the dashboard: `JWT_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD` (and optionally `OPENAI_API_KEY`,
   `STRIPE_SECRET_KEY`).
4. Apply. Render builds the Dockerfile and starts the service.
5. Health check path is `/health`.

> The service is **single-instance by design**. SQLite on a disk cannot be
> shared across replicas — do not scale horizontally until the data layer is
> migrated to Postgres.

## Option B — any Docker host

```bash
docker build -t neuropay-ai .
# The image runs as uid 1000. If you bind-mount a host directory, chown it first:
#   sudo chown -R 1000:1000 /srv/neuropay-data
docker run -d --name neuropay-ai -p 8080:8080 \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e ADMIN_EMAIL="you@yourdomain.com" \
  -e ADMIN_PASSWORD="a-strong-password" \
  -e SEED_ON_BOOT=true \
  -v neuropay_data:/app/packages/api/data \
  neuropay-ai
```

Or with compose:

```bash
JWT_SECRET="$(openssl rand -base64 48)" docker compose -f docker-compose.prod.yml up -d --build
```

## Option C — Fly.io

```bash
fly launch --no-deploy          # detect the Dockerfile
fly volumes create neuropay_data --size 1
# mount it at /app/packages/api/data in fly.toml
fly secrets set JWT_SECRET="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..."
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
JWT_SECRET=dev-secret-at-least-16-chars DATABASE_URL=file:./data/local.db \
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

### Volume ownership is load-bearing

The runtime stage creates `/app/packages/api/data` and chowns it to `node`, then
drops privileges with `USER node`. This ordering matters.

The app enables SQLite **WAL** mode, which needs write access to the *directory* —
for the `-wal` and `-shm` sidecar files — not just the database file. A named
volume is initialised from the image's directory, so a `node`-owned data directory
is what lets the non-root process write to the volume.

**If you bind-mount a host directory instead of using a named volume, you must
chown it first:**

```bash
mkdir -p /srv/neuropay-data
sudo chown -R 1000:1000 /srv/neuropay-data
docker run -v /srv/neuropay-data:/app/packages/api/data ...
```

A root-owned data directory handed to a non-root process fails at startup with
`SQLITE_CANTOPEN`. Verified both ways:

| Data directory owner | Process user | Result |
| --- | --- | --- |
| `root:root` | uid 1000 | `SQLITE_CANTOPEN` |
| `node:node` (uid 1000) | uid 1000 | opens, WAL enabled, writes succeed |

### Render note

The `render.yaml` disk is mounted at `/app/packages/api/data`. Render applies the
mount at runtime, which can shadow the image's directory ownership. If the service
fails to start with a database error, set `PUID`/`PGID` behaviour aside and instead
confirm in Render's shell:

```bash
ls -ld /app/packages/api/data     # expect node node (or 1000:1000)
```

If it shows `root root`, chown it once from the Render shell. The Dockerfile
handles the common named-volume case automatically.

## Operational notes

- **`JWT_SECRET` rotation** invalidates all existing sessions. Expected.
- **Backups**: the entire data set is one SQLite file. Back it up by copying
  `/app/packages/api/data/neuropay.db`.
- **Scaling**: single instance only while on SQLite. Migrate to Postgres before
  adding replicas.
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
