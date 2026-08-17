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

# Admin build version

The admin app's sidebar heading shows `v<X.Y.Z>` right under "Admin Panel"/"Seller Hub", for `SUPER_ADMIN` sessions only — lets support confirm which release is actually live in production without SSHing into the server. It is **fully automatic**; never hand-edit a version number anywhere.

- The version itself is computed by `scripts/compute-version.sh` — walks Conventional Commits messages (`fix:`, `feat:`, `feat!:`/`BREAKING CHANGE`) since the last `vX.Y.Z` git tag and bumps MAJOR (breaking), MINOR (`feat`), or PATCH (everything else) accordingly. Deterministic from commit history alone — no state file, no manual bump, and CI and a local-build fallback always agree on the number for a given commit.
- Baked in at Docker build time via `NEXT_PUBLIC_BUILD_VERSION`, inlined into the client bundle like every other `NEXT_PUBLIC_*` var.
- CI (`.github/workflows/docker-publish.yml`, `changes` job) runs the script once per push to `main`, pushes a `vX.Y.Z` tag for traceability, and passes the result to `build-admin`'s build-args.
- `scripts/deploy.sh`'s local-build fallback (used only when a `docker pull` from GHCR fails) runs the same script over SSH against the server's own checkout and exports `BUILD_VERSION` before `docker compose build`; `docker-compose.yml` reads it into the same build arg (falls back to `local` if unset).
- A plain `pnpm nx serve admin` (no Docker) shows `v dev` — no build arg is passed locally, and `docker/Dockerfile`'s `builder-admin` stage defaults the `ARG` to `dev`.
- Rendered in `apps/admin/src/components/layout/AdminSidebar.tsx`'s `LogoMark` component, gated on `role === 'SUPER_ADMIN'`.

If a version bump ever looks wrong after a deploy, check the pipeline (did the admin image actually rebuild for this commit? did the pull succeed on the server?) or run `bash scripts/compute-version.sh` locally to see what it resolves to — not this file.
