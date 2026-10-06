# D004 operational readiness — 2026-10-03

Implemented locally; see progress.md for verification. No deployment, storage call with real credentials or dependency outage drill executed.

## Routes

| Route | Meaning | Response |
|---|---|---|
| `/api/v1/health/live` | HTTP process responds; no dependency checks | 200, scope `process-only` |
| `/api/v1/health` | Diagnostic snapshot, not a deployment gate | 200 with measured `ok`/`degraded` and per-dependency statuses |
| `/api/v1/health/ready` | Required infrastructure probes all passed | 200 only if all pass; otherwise 503 `ERR_NOT_READY` with sanitized failing dependency/status pairs |

Probes: PostgreSQL `SELECT 1`, Redis `PING`, MongoDB `ping`, storage `HeadBucket`. No object writes/deletes. Missing storage credentials report `not_configured`, never `ok`. Reports identify probe scope; storage reads do not prove uploads, CDN delivery, SMTP, payment processing, workers or economic correctness.

Each dependency has a two-second HTTP wait bound; probes run concurrently. Concurrent callers share in-flight operations. A timed-out underlying query remains tracked until it actually settles, preventing repeated requests from adding more hung queries. Storage and MongoDB receive cancellation signals; Prisma query cancellation is not claimed. Error bodies contain no provider response, credential, hostname or connection string.

The deployment script, container HEALTHCHECK and smoke-test script now use `/health/ready`. Changes are repository-only; no deployment script was run. Docker health is not the same as process liveness and should not be blindly wired into an aggressive restart loop.

## Rollout requirements and limitations

- Coordinate readiness API and consumer scripts; the new path does not exist on the old API.
- Storage credentials must permit a read-only bucket probe. A write-only token can fail HeadBucket even if uploads work; review permissions separately, never mark an unperformed check healthy.
- Test actual PG/Redis/Mongo/storage failure, timeout and recovery in isolated staging, including expected HTTP status through the deployed proxy. Local HTTP tests mock dependency clients.
- A healthy result does not certify schema migration state, queue workers, notification delivery, Redis persistence, backup restore or money conservation. Keep separate pilot release gates.
- Client/admin health endpoints are unchanged. No unsupported claim that every service is now production-ready.
- If readiness fails during rollout, investigate the dependency/permission and stop promotion. Do not switch deployment back to diagnostic HTTP 200 to obtain a green result.
