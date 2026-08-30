# Engineering Backlog

Deferred items from the 2026-08-30 Nx workspace and frontend audit. These are
not release blockers for the current deployment, but should be handled as
separate, reviewable workstreams rather than mixed into feature changes.

## High priority

- [ ] Reduce the existing ESLint warning baselines: admin 562, client 232, API
      180, UI 1, and shared API client 1. Prioritize accessibility warnings,
      unsafe `any` usage, and non-null assertions. Lower each `maxWarnings`
      value as warnings are removed.
- [ ] Add unit/integration test targets for client, admin, UI, and shared
      libraries. Raise API coverage incrementally from the current minimum
      thresholds (25% statements/lines, 3% branches/functions).
- [ ] Split oversized API services/controllers and large admin/client pages
      into domain-focused modules with explicit public APIs.
- [ ] Consolidate duplicated admin/client HTTP and authentication clients into
      the shared API client without coupling UI-specific behavior.

## Medium priority

- [ ] Migrate deprecated Next.js `middleware` conventions to `proxy` and move
      compatible routes away from the deprecated Edge runtime.
- [ ] Resolve development-only transitive advisories in the Nx/SWC toolchain
      when upstream releases are compatible; keep production high/critical
      audit gates blocking.
- [ ] Resolve peer-version mismatches around Jest mocks, NextAuth/Nodemailer,
      and the intentional canvas test stub without weakening security fixes.
- [ ] Standardize shared-library build/source consumption and document which
      libraries are buildable, publishable, or source-only.

## Delivery and operations

- [ ] Build and inspect all Docker targets in a Linux Docker environment,
      record final image sizes, and introduce regression budgets.
- [ ] Pin base container images by digest with a scheduled, reviewed update
      process.
- [ ] Add automatic rollback when post-deploy health checks fail; retain a
      known-good release identifier and verify application-level data oracles.
- [ ] Add authenticated production smoke tests for critical buyer, seller, and
      super-admin journeys using isolated test data.
