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

The admin app's sidebar footer shows `ver <short-sha>` for `SUPER_ADMIN` sessions only — lets support confirm which commit is actually live in production without SSHing into the server. It is **fully automatic**; never hand-edit a version number anywhere.

- Baked in at Docker build time via `NEXT_PUBLIC_BUILD_VERSION`, inlined into the client bundle like every other `NEXT_PUBLIC_*` var.
- CI (`.github/workflows/docker-publish.yml`, `build-admin` job) sets it to `${{ github.sha }}` — always the exact commit that produced that image.
- `scripts/deploy.sh`'s local-build fallback (used only when a `docker pull` from GHCR fails) exports `GIT_SHA` before `docker compose build`; `docker-compose.yml` reads it into the same build arg (falls back to `local` if unset).
- A plain `pnpm nx serve admin` (no Docker) shows `ver dev` — no build arg is passed locally, and `docker/Dockerfile`'s `builder-admin` stage defaults the `ARG` to `dev`.
- Rendered in `apps/admin/src/components/layout/AdminSidebar.tsx`'s user-footer section, gated on `role === 'SUPER_ADMIN'`.

If a version bump ever looks wrong after a deploy, the pipeline is the thing to check (did the admin image actually rebuild for this commit? did the pull succeed on the server?) — not this file.
