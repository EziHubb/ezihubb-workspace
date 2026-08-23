<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Never commit, push or deploy unasked

**Wait for the user to say so. Every time.**

Finishing a task, verifying it, and even fixing a live production bug are not
permission. Neither is the user saying "ok" to something else in the same
message. The instruction must name the action: commit, push, deploy — or an
obvious equivalent like "ship it".

This is not a formality. Reviewing a diff before it goes out is the user's job,
and taking it away by committing first makes their review a post-mortem.

When work is ready, stop and say so: what changed, what was verified, what was
not. Leave it in the working tree. If it fixes something urgent, say that
plainly and let them decide — urgency is an argument for asking clearly, not for
skipping the ask.

The one thing that does not need asking: **do not leave the working tree dirty
with debris.** Delete temp scripts and scratch files as you go.

# Redeploy flow

When asked to "deploy" (or "commit + push + deploy"), run these steps in order.
Do not skip a step because the change looks small — most of them exist because
skipping them once hid a real failure.

**1. Verify before committing.** `pnpm nx run api:build`, `api:test`,
`run-many -t lint`, and `npx tsc --noEmit` for whichever of client/admin changed.

Capture the exit code WITHOUT a pipe. `npx tsc … | head -5; echo $?` reports
`head`'s status, not tsc's, and will read as `0` while tsc is failing. Redirect
to a file, echo `$?`, then read the file.

The client is not built locally on Windows — a Next build hits `os error 1314`
(symlink privilege), which cannot happen in CI's Linux container. `tsc --noEmit`
is the local stand-in.

**2. Review the diff for scope.** Read `git status --short` and `git diff --stat`
before committing.

**Never `git add -A` or `git add <dir>`.** A parallel Claude session often has
its own files staged in the index; a bare `git commit` takes the WHOLE index,
including theirs. Commit with the pathspec form — `git commit -m … -- <paths>` —
which commits only the listed paths and leaves the rest of the index untouched.
Untracked files must be `git add`ed first (pathspec cannot reach them), then
named in the same pathspec commit.

**3. Commit with Conventional Commits.** The prefix is not cosmetic: the admin
build version is computed from these messages (see below), so `feat:` vs `fix:`
decides the version bump.

**4. Push, then wait for BOTH workflows.** A push triggers `CI` and
`Build & Push Docker Images` as separate runs. `gh run list --limit 2` finds
them; `gh run watch <id> --exit-status` blocks on each.

Then check every job's conclusion, not just the run's:
`gh run view <id> --json conclusion,jobs`. `skipped` is normal and correct — CI
only rebuilds images whose files changed, and `deploy.sh` pulls `:latest` for the
rest.

**5. Deploy.** `bash scripts/deploy.sh` from the local machine. It SSHes in,
pulls, pulls images from GHCR, runs migrations, then restarts.

Migrations run BEFORE any app restarts and now abort the deploy on failure. Do
not weaken that back into a warning: it previously ended in `|| echo`, so a
failed migration printed a warning, the apps restarted against an unmigrated
schema, and the run still finished with "✓ Deploy complete!".

**6. Verify against production data — never trust "✓ Deploy complete".** The
script prints that even when things are wrong. Pick an oracle that can actually
distinguish success from failure:

- Hit the API and assert on a FIELD, not a status code (`curl … | node -e …`).
- For a new route, `401` proves it is registered; `404` proves it is not. Always
  probe a deliberately bogus sibling path as a control — without it, a server
  returning `401` for everything looks like success.
- Prefer an oracle that can fail. Counting a word that also appears in the i18n
  bundle, or in the site name, cannot fail and proves nothing.
- Storefront product grids are client-fetched, so product data is absent from
  the initial HTML. Curling the page cannot verify them; query the API instead.

**7. Report what was NOT verified.** State plainly which parts are unproven —
e.g. anything needing an authenticated session or data that does not exist in
production yet. "Build passed" is not evidence that the logic is right.

## Things that need a human

- **nginx config** (`scripts/nginx-ezihubb.conf`) is a manual one-time template.
  `deploy.sh` never installs it, so editing it changes nothing on production.
- **Some production SSH commands** are blocked by the sandbox classifier, but
  not all — this is narrower than it once read. `bash scripts/deploy.sh`, and
  `ssh … "docker compose run --rm migrate …"` (including one that dropped the
  whole schema) both ran fine on 2026-08-23. Writing to the server's `.env`
  was refused, and so was a read-only `docker inspect`. There is no rule to
  predict it from: try the command, and if it is refused, stop and say which
  one and why. Never work around a refusal.
- **Writing secrets into the server's `.env`** is refused, so the human has to
  do it. That is the blocker for `SEED_ADMIN_PASSWORD` below.

# Reset production

Wipes the production database and rebuilds it from the current schema. Every
listing, user, order and review is destroyed and there is no undo without an
RDS snapshot — take one first unless the human has explicitly said the data is
disposable. This is not part of a deploy; it happens only when asked for by
name.

**The order below is not a preference.** `deploy.sh` runs `prisma migrate
deploy`, which fails if the database still holds migration rows the repo no
longer has — with a squashed history, every `CREATE` collides. Wipe first, then
deploy. A failed migration aborts the deploy before restarting anything, so
getting this wrong is recoverable, just wasteful.

**Prerequisite the human must do first.** `SEED_ADMIN_PASSWORD` must be in the
server's `.env`. It cannot be set from here (see "Things that need a human"),
and `01-users.ts` falls back to a password published in this repo — seeding
without it puts a known-password SUPER_ADMIN on a public admin panel. Confirm
with `ssh … "grep -c '^SEED_ADMIN_PASSWORD=..' <path>/.env"` and stop if it is
`0`.

```bash
# 1. Wipe Postgres. No --schema flag: Prisma 7 reads the datasource from
#    prisma.config.ts and rejects it.
ssh … "cd $DEPLOY_PATH && docker compose run --rm migrate \
  node_modules/.bin/prisma db execute --file=prisma/scripts/drop-pg.sql"

# 2. Deploy. Pulls the new images and applies the migrations to the empty DB.
bash scripts/deploy.sh          # from the local machine

# 3. Wipe Mongo. Must come after step 2: drop.ts is TypeScript and the OLD
#    migrate image on the server may predate tsx being a runtime dependency.
#    `docker compose exec mongodb mongosh` does NOT work — Mongo requires auth
#    and the credentials are in MONGODB_URI, which drop.ts reads.
ssh … "cd $DEPLOY_PATH && docker compose run --rm migrate \
  node_modules/.bin/tsx prisma/seeds/mongo/drop.ts"

# 4. Seed. deploy.sh does NOT seed.
ssh … "cd $DEPLOY_PATH && docker compose run --rm migrate \
  node_modules/.bin/tsx prisma/seed-baseline.ts"

# 5. Clear the Redis caches — see below for why this is mandatory.
ssh … "cd $DEPLOY_PATH && docker compose exec -T redis redis-cli DEL \
  'categories:tree' 'catalog:mega_menu' 'catalog:tags'"
```

**Step 5 is not optional, and the reason is a trap worth knowing.**
`catalog.service.ts` reads its cache as `if (cached) return cached` — and `[]`
is truthy in JavaScript. Any request served while the database is empty caches
an empty category tree for the full TTL. Merely *checking* production between
the wipe and the seed is enough to do it: that happened on 2026-08-23, and the
site showed zero categories after a seed that had demonstrably worked. Clear
the keys, or do not touch the API until after step 4.

**Verify with something that can fail.** The seed's own summary is not
evidence the app can read what it wrote. Assert on a translated field and keep
a control:

```bash
curl -s -H 'X-Locale: vi' https://api.ezihubb.com/api/v1/catalog/categories   # Quà tặng
curl -s -H 'X-Locale: zh' https://api.ezihubb.com/api/v1/catalog/categories   # 礼物
curl -s -H 'X-Locale: en' https://api.ezihubb.com/api/v1/catalog/categories   # Gifts — control
```

Watch the seed's own warnings too. `05-translations.ts` reports any category it
has no translation for; on 2026-08-23 four such warnings turned out to be a
slug collision in `02-categories.ts`, not a missing string.

**What a wipe does not clean.** Product images stay in S3 as orphans and keep
costing storage. Nothing in this flow touches them.

# Squashing migrations

Only worth doing when no database is running on the old history — in practice,
only alongside a production reset. Otherwise leave the history alone.

```bash
prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_init/migration.sql
# then delete every older migration directory, keeping migration_lock.toml
```

`--to-schema-datamodel` was removed in Prisma 7; the flag is `--to-schema`.

The output is generated from `schema.prisma`, so it is the schema itself rather
than a replay of how the schema was reached — which also means it silently
resolves any drift in favour of `schema.prisma`. Check it covers everything
before trusting it: the model and enum counts must match exactly.

```bash
grep -cE '^model ' prisma/schema.prisma   # must equal
grep -c 'CREATE TABLE' <the new migration.sql>
grep -cE '^enum ' prisma/schema.prisma    # must equal
grep -c 'CREATE TYPE' <the new migration.sql>
```

A squashed init cannot be applied to a database created before it — every
`CREATE` collides. Say so in a comment at the top of the file, because the
error a stale database produces does not explain itself.

# Admin build version

The admin app's sidebar heading shows `v<X.Y.Z>` right under "Admin Panel"/"Seller Hub", for `SUPER_ADMIN` sessions only — lets support confirm which release is actually live in production without SSHing into the server. It is **fully automatic**; never hand-edit a version number anywhere.

- The version itself is computed by `scripts/compute-version.sh` — walks Conventional Commits messages (`fix:`, `feat:`, `feat!:`/`BREAKING CHANGE`) since the last `vX.Y.Z` git tag and bumps MAJOR (breaking), MINOR (`feat`), or PATCH (everything else) accordingly. Deterministic from commit history alone — no state file, no manual bump, and CI and a local-build fallback always agree on the number for a given commit.
- Baked in at Docker build time via `NEXT_PUBLIC_BUILD_VERSION`, inlined into the client bundle like every other `NEXT_PUBLIC_*` var.
- CI (`.github/workflows/docker-publish.yml`, `changes` job) runs the script once per push to `main`, pushes a `vX.Y.Z` tag for traceability, and passes the result to `build-admin`'s build-args.
- `scripts/deploy.sh`'s local-build fallback (used only when a `docker pull` from GHCR fails) runs the same script over SSH against the server's own checkout and exports `BUILD_VERSION` before `docker compose build`; `docker-compose.yml` reads it into the same build arg (falls back to `local` if unset).
- A plain `pnpm nx serve admin` (no Docker) shows `v dev` — no build arg is passed locally, and `docker/Dockerfile`'s `builder-admin` stage defaults the `ARG` to `dev`.
- Rendered in `apps/admin/src/components/layout/AdminSidebar.tsx`'s `LogoMark` component, gated on `role === 'SUPER_ADMIN'`.

If a version bump ever looks wrong after a deploy, check the pipeline (did the admin image actually rebuild for this commit? did the pull succeed on the server?) or run `bash scripts/compute-version.sh` locally to see what it resolves to — not this file.
