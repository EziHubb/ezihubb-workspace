# AWS Deploy Spec — Nx Monorepo (NestJS API + Next.js apps) on Dedicated EC2 + RDS

Distilled from a real production deployment (Silver14 Nail e-commerce) — every choice here
traces back to a concrete failure that was fixed, not a theoretical best practice. Follow this
literally unless the target project has a stated reason to diverge.

Give this whole file to Claude Code as context before asking it to deploy. It has everything
needed to replicate the same infrastructure, safety rails, and cost profile.

**This project's specifics** (fill in / confirm before starting):

- Region: `ap-southeast-1` (Singapore) — already decided, see §1.3.
- Primary relational DB: **RDS PostgreSQL**, not MySQL — see §1.2 for the diff.

---

## 0. Non-negotiable ground rules

These exist because violating them caused a real multi-hour production outage + data loss on
the reference project. Do not skip them to save time.

1. **This server is dedicated to this app. Never share it with another project's containers.**
   A shared server running two projects' Docker builds concurrently exhausted RAM/swap and took
   the _entire_ host down — including the other tenant's app. If the box must be shared for cost
   reasons, at minimum: never self-host the database in a container anyone else on the box can
   reach, and add the concurrent-build guard in §5.
2. **The primary relational DB = RDS, never a self-hosted container.** A self-hosted DB container
   sharing the same box as the app is one `docker exec` (or one compromised credential) away from
   `DROP DATABASE` with no managed backups. RDS gets automated backups, its own security group,
   and is unreachable from outside the VPC by default. This rule is about the _relational_ DB
   specifically because RDS makes it cheap and easy — it does **not** mean every datastore must
   be managed at any cost. MongoDB has no equivalent cheap managed option here (DocumentDB is a
   different, pricier service), so self-hosting it in a container is a reasonable, deliberate
   exception — but only if you compensate for what RDS would otherwise have given you for free:
   network isolation (never bind Mongo's port to a public interface) and backups (you must set
   these up yourself, RDS isn't doing it for you). See §1.4.
3. **Never build directly on a RAM-constrained box without a pre-flight check.** `next build` /
   `webpack` can spike 800MB–1GB+ RSS by itself. On a 1–2GB instance, running that concurrently
   with normal traffic (or with another build) is what causes an OOM cascade that kills unrelated
   processes, not just the build.
4. **Never expose SSH (port 22) to `0.0.0.0/0`.** Restrict the Security Group rule to your current
   IP (AWS's launch wizard has a "My IP" option), or better, use SSM Session Manager and don't
   open port 22 at all.
5. **Pick the AWS region based on where real _customers_ are, not where the person testing is.**
   Cloudflare routes each visitor to the nearest edge PoP; a US/UK customer base is well served
   by `us-east-1` even if the developer is in Asia and personally sees higher latency when they
   test it themselves. Don't chase the tester's own perceived speed at the expense of the actual
   audience — verify with a real multi-region latency tool (e.g. check-host.net) instead of
   trusting one person's local browsing experience.

---

## 1. AWS resources to provision

### 1.1 EC2

- **AMI**: Ubuntu Server LTS (matches the project's existing deploy scripts, which assume
  `apt`/`ufw`/`systemctl` — don't switch distro without also rewriting those scripts).
- **Architecture**: x86*64, \_not* Arm/Graviton, if the app has any native Node addons (e.g.
  `canvas`, `sharp` with custom builds) — avoids native-binding rebuild surprises. If the app is
  pure JS/TS with no native deps, Graviton (`t4g.*`) is cheaper and fine.
- **Instance size**: measure actual steady-state RSS of your containers first if you have prior
  numbers; as a starting point for a 3-service Nx app (api + 2 Next.js frontends) **plus a
  self-hosted MongoDB container** (see §1.4 — Mongo's own baseline RSS is typically 100–300MB+
  idle and grows with working-set size, on top of everything else):
  - `t3.small` (2GB RAM) is likely **too tight** once Mongo is added on top of api + 2 frontends
    - a build spike — budget for `t3.medium` (4GB) instead if building directly on the box, or
      confirm actual headroom with `free -h` after first deploy and size down only if there's real
      margin.
  - `t3.micro`/`t3.small` becomes workable **only** if builds happen in CI (GitHub Actions → push
    image to ECR → box just pulls and runs) so the box itself never runs a build — the Mongo
    container's own steady-state footprint still has to fit either way.
  - Either way, **add a swapfile** (1–2GB) — EC2 ships with zero swap by default, unlike a
    typical VPS. Without it, a RAM spike is an instant OOM-kill instead of graceful degradation:
    ```bash
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
    ```
- **Storage**: 30GB gp3 minimum (fits the EBS free-tier limit exactly — see cost notes in §7).
  A single set of 3 Nx-app Docker images (api + 2 frontends + a migrate/source image) runs
  ~5–8GB; 30GB leaves headroom for a few image generations plus BuildKit cache before anything
  needs pruning. **Mongo's data volume also lives on this same root EBS volume by default**
  (named Docker volumes aren't a separate disk) — if the expected dataset will grow past a few
  GB, size storage up accordingly from the start rather than resizing under pressure later.
- **Key pair**: create fresh, per region (AWS key pairs and Elastic IPs are region-scoped — you
  cannot reuse one from a different region).
- **Security Group** (create new):
  - SSH (22): source = **My IP** only, never Anywhere/0.0.0.0/0.
  - HTTP (80): Anywhere — needed for the redirect-to-HTTPS and any ACME/health checks.
  - HTTPS (443): Anywhere (or, as a hardening step once live, restrict to Cloudflare's published
    IP ranges from `https://www.cloudflare.com/ips-v4` and `/ips-v6`, since all real traffic
    should be arriving via Cloudflare's proxy anyway).
- **Elastic IP**: allocate and associate to the instance — gives a stable IP to point Cloudflare
  DNS at, independent of instance stop/start. Free while attached to a running instance.
- **Tags**: name it clearly (`Name: <project>-production`) and enable **termination protection**.

### 1.2 RDS (PostgreSQL)

- **Engine**: PostgreSQL (latest stable supported by RDS free tier — check the console for the
  current default version). Same overall wizard flow as MySQL, a few concrete diffs to watch for:
  - Default port is **5432**, not 3306 — update every env var / connection string accordingly.
  - Master username defaults to `postgres` in the wizard (vs. `admin` for MySQL) — you can
    rename it, but whatever you pick is what the app's `DATABASE_USER`/equivalent must match.
  - If the app's ORM (TypeORM/Prisma/etc.) config has an engine-specific `type`/`dialect` field
    (e.g. TypeORM's `type: 'mysql'`), confirm it's actually set to `postgres` — this is an easy
    copy-paste miss when adapting config from a MySQL-based reference project.
- **Template**: pick **Free tier** explicitly in the console wizard — this auto-selects a
  free-tier-eligible instance class/storage combo. The console will still display a per-hour
  on-demand price next to it for reference; that's the post-free-tier list price, not what you're
  billed while free tier applies.
- **Instance class**: `db.t4g.micro` (or whatever the Free tier template selects) — 1 vCPU/1GB
  RAM is plenty for a small-to-medium app's dataset.
- **Storage**: 20GB (free tier default).
- **Public access**: **No.** The DB should only be reachable from inside the VPC.
- **VPC security group**: create new, dedicated to this RDS instance.
- **Initial database name**: set it now in "Additional configuration" (easy to miss — it's
  collapsed by default) so you don't have to `CREATE DATABASE` by hand afterward.
- **Backups**: leave automated backups enabled, 7-day retention minimum.
- **Connect it to the EC2 instance**: don't hand-edit security group rules for this — RDS's own
  console has a **"Set up EC2 connection"** button (under Connectivity & security → Connected
  compute resources) that correctly wires the security group rule for you in one click. Manual
  editing is error-prone (wrong port, wrong source, leftover broken rules) — use the button.

### 1.3 Region

Already decided for this project: **`ap-southeast-1` (Singapore)** — confirm this matches where
the real customer base actually is (§0.5); if it does, this is the right call and there's nothing
further to reconsider here. Don't run a second region "just in case" — see §7 for why a
load-balanced multi-region setup costs 2–3x more than it looks like it should (RDS free-tier
hours pool _globally_ across regions per instance type, and Cloudflare Load Balancing is a
separately-billed product, not part of the free plan).

If a real, growing customer segment does exist in a second region and per-request DB latency
matters, the right _first_ upgrade is an RDS **cross-region read replica** (cheap, since reads
dominate an e-commerce workload), not a second full EC2+RDS+load-balancer stack.

### 1.4 MongoDB — self-hosted container, done safely

No managed option in this setup (DocumentDB is MongoDB-_compatible_, not actually MongoDB, and
is a separate pricier service) — running it as a container on the EC2 box is the pragmatic
choice. To do it without recreating the exact incident ground rule #2 warns about:

- **Never publish Mongo's port to a public interface.** No `ports: "27017:27017"` mapping bound
  to `0.0.0.0`. Keep it reachable only over the same internal `docker-compose` bridge network the
  app containers already use — the app connects to it by service name (e.g. `mongo:27017`), and
  nothing outside the Docker network (including the public internet) can reach it at all. Don't
  even add a Security Group rule for 27017 — there should be no route to it from outside the box
  in the first place.
- **Set a real root username/password** via `MONGO_INITDB_ROOT_USERNAME` /
  `MONGO_INITDB_ROOT_PASSWORD` env vars on the container — don't run it with auth disabled, even
  though it's not internet-reachable; defense in depth against anything else on the box.
- **Back it up on a schedule** — RDS's automated-backups safety net does not exist here since
  this isn't RDS. Minimum viable: a cron job running `mongodump` on a schedule (daily is
  reasonable for most app sizes), writing to a path _outside_ the container's own writable layer,
  with old dumps rotated out (e.g. keep last 7 days locally). Strongly consider also pushing the
  latest dump to off-box storage (S3, or Cloudflare R2 if already used elsewhere in this stack)
  on a slower cadence (e.g. weekly) — a backup that only exists on the same disk as the live data
  doesn't protect against instance/volume loss.
- **Use a named Docker volume for its data directory** (not an anonymous volume, not bind-mount
  into a path that could get wiped by a careless `docker-compose down -v` or cleanup script) —
  `docker volume ls` should show it clearly named after the project so it's obvious what it is
  and isn't accidentally pruned.
- **Account for its RAM in instance sizing** (§1.1) — it is a genuine, permanent addition to the
  box's steady-state memory footprint, not a one-off build spike; size the instance for the
  _sum_ of all containers' steady-state RSS plus OS/Docker overhead plus build-spike headroom.

---

## 2. Dockerfile — per-app builder stages, not one shared builder

The single biggest build-time and blast-radius fix: split the build into one stage per
deployable app, sharing only the dependency-install layer. This means `docker-compose build
<one-service>` only ever compiles that one app — never triggers a build of the other two.

```dockerfile
# syntax=docker/dockerfile:1

# ============================================
# Base — install all workspace deps once
# ============================================
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@<pin-a-version> --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/<app-a>/package.json ./apps/<app-a>/
COPY apps/<app-b>/package.json ./apps/<app-b>/
# ...one COPY per app + per lib package.json...
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Source — full monorepo source, no build.
# Shared by every per-app builder stage below AND by a `migrate`/`source`
# target for anything that needs source+deps but not a built app (DB
# migrations via ts-node, etc.) — never make migrate depend on a stage that
# builds unrelated apps.
# ============================================
FROM base AS source
WORKDIR /app
COPY . .

# ============================================
# One builder stage per deployable app
# ============================================
FROM source AS builder-api
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm exec nx build api

FROM source AS builder-web
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time — must
# be passed as build ARGs (from docker-compose.yml's build.args:), not
# runtime environment: — runtime env has no effect on an already-built bundle.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm exec nx build web

# ============================================
# Production stages — copy only the built output, not source
# ============================================
FROM node:22-alpine AS api
WORKDIR /app
COPY --from=builder-api /app/dist/apps/api ./
COPY --from=builder-api /app/node_modules ./node_modules
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r=>process.exit(r.statusCode===200?0:1))"
CMD ["node", "main.js"]

FROM node:22-alpine AS web
WORKDIR /app
# pnpm doesn't hoist `next` to the workspace root — preserve the original
# nested directory depth (root node_modules/ + apps/web/) or the relative
# symlink pnpm creates for the `next` binary breaks.
COPY --from=builder-web /app/node_modules ./node_modules
COPY --from=builder-web /app/apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 4200
CMD ["node_modules/.bin/next", "start", "-p", "4200"]
```

Key points to carry over exactly:

- `--mount=type=cache,id=pnpm-store,...` and `id=nx-cache,...` — without these, every deploy
  reinstalls all deps and recompiles from scratch even for a one-line change, because `COPY . .`
  invalidates the layer every time (source always changes — that's the point of deploying).
- The `id=` on each cache mount must be **stable across builds** (don't parameterize it per
  build) — that's what makes it a persistent cache instead of a fresh one every time.

---

## 3. docker-compose.yml

- One service per deployable app, each with its own `target:` matching the Dockerfile stage.
- A `migrate` service (if the app uses TypeORM/Prisma migrations) targets the `source` stage —
  never a per-app builder stage — so running migrations doesn't force an unrelated app to build.
  Give it its own `profiles: [migrate]` so it never starts on a plain `docker-compose up`.
- `DATABASE_HOST` (Postgres) comes from `.env` as the RDS endpoint — never hardcode a container
  name for it, since there is no RDS-equivalent container on this architecture.
- `mongo` **is** a service in this file (the one deliberate exception — §1.4), but with no
  `ports:` mapping to the host, only reachable by other containers on the same compose network:

  ```yaml
  services:
    mongo:
      image: mongo:7
      container_name: <project>-mongo
      restart: unless-stopped
      environment:
        MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
        MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      volumes:
        - mongo_data:/data/db # named volume — see §1.4
      networks:
        - app-network
      # No `ports:` — never expose 27017 to the host/internet.

  volumes:
    mongo_data:
  ```

  The API service connects to it via `MONGO_URI=mongodb://<user>:<pass>@mongo:27017/<db>` (the
  service name `mongo` resolves over the compose network — no host port, no public IP involved).

- No RDS-equivalent Postgres container. No `nginx` service — the host's own nginx (installed
  directly, not in Docker) owns ports 80/443 and reverse-proxies to each container's published
  port.
- Single bridge network for the app's own containers (including `mongo`) to talk to each other;
  no external network needed since nothing is shared with another project.

---

## 4. nginx + SSL (Cloudflare Origin Certificate)

Cloudflare proxies the domain (orange-cloud DNS), so nginx only needs a certificate Cloudflare
itself trusts — an **Origin Certificate**, not Let's Encrypt (skips DNS-propagation wait, and
Cloudflare's own edge handles the publicly-trusted cert for visitors).

1. Cloudflare Dashboard → SSL/TLS → Origin Server → **Create Certificate**. Set SSL/TLS mode to
   **Full (strict)**.
2. Save the certificate + private key on the server, restrict permissions:
   ```bash
   sudo mkdir -p /etc/ssl/<project>
   # paste cert → /etc/ssl/<project>/origin.pem, key → /etc/ssl/<project>/origin.key
   sudo chmod 644 /etc/ssl/<project>/origin.pem
   sudo chmod 600 /etc/ssl/<project>/origin.key
   ```
3. nginx server block per subdomain, each referencing the same cert/key, proxying to
   `127.0.0.1:<container port>`. Restore the real visitor IP from Cloudflare's header (scoped to
   these blocks only, not global — don't affect other sites on a shared nginx if applicable):
   ```nginx
   set_real_ip_from 173.245.48.0/20;   # ...full list from cloudflare.com/ips-v4 and /ips-v6
   real_ip_header CF-Connecting-IP;
   ```
   Fetch the current IP list at setup time (`curl https://www.cloudflare.com/ips-v4` /
   `/ips-v6`) rather than hardcoding from memory — it does change.
4. `sudo nginx -t && sudo systemctl reload nginx`.
5. Point the Cloudflare DNS A record at the EC2 Elastic IP, proxied (orange cloud) on.
6. **Cloudflare Cache Rule** for static assets: URI Path starts with `/_next/static/` → Eligible
   for cache, Edge TTL = respect origin headers (this one is usually already cached by
   Cloudflare's default extension-based heuristic, but an explicit rule is more robust than
   relying on the default). No rule for `/_next/image` — evaluate on this project whether that
   route is even in play the same way before adding a rule for it.

---

## 5. Deploy script — the safety rails that actually matter

Every build step must be gated by a resource check and run **one service at a time**, never
batched. This is not a style preference — running multiple `next build`/`webpack` processes
concurrently on a small instance, or letting a second unrelated project's build run at the same
time, is what caused a real production outage on the reference project.

```bash
MIN_RAM_MB=800
MIN_DISK_GB=3

check_resources() {
  AVAIL_RAM=$(free -m | awk '/^Mem:/{print $7}')
  AVAIL_DISK=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
  echo "  RAM available: ${AVAIL_RAM}MB | Disk available: ${AVAIL_DISK}GB"
  if [ "$AVAIL_RAM" -lt "$MIN_RAM_MB" ]; then
    echo "ABORT: RAM available (${AVAIL_RAM}MB) is below the safe threshold (${MIN_RAM_MB}MB)."
    exit 1
  fi
  if [ "$AVAIL_DISK" -lt "$MIN_DISK_GB" ]; then
    echo "ABORT: Disk available (${AVAIL_DISK}GB) is below the safe threshold (${MIN_DISK_GB}GB)."
    exit 1
  fi
}

# Refuse to start if ANY docker-compose build is already running — ours or,
# on a shared box, another project's. Two concurrent builds is exactly what
# exhausts RAM/swap and can take the whole server down.
if pgrep -f "docker-compose build" > /dev/null; then
  echo "ABORT: A docker-compose build is already running. Refusing to start a second one."
  exit 1
fi

# ...git pull, diff old HEAD vs new HEAD to compute which services actually
# changed (skip building services whose files didn't change)...

for SVC in $CHANGED_SERVICES; do
  check_resources
  docker-compose build "$SVC"
  # Deploy immediately after each service's own build (not batching all
  # builds then all restarts) — the live site never goes down for the full
  # build duration, only for the brief container swap per service, and it
  # keeps peak concurrent resource usage to one service at a time.
  docker-compose up -d "$SVC"
done
```

Only build a service if its own files (or a shared dependency — `libs/`, root `package.json`,
`Dockerfile`, `nx.json`) changed since the last deploy; diff `git rev-parse HEAD` before/after
`git pull` and `git diff --name-only` between them to decide.

---

## 6. Access pattern for deploys

Prefer **SSM Session Manager port-forwarding as an SSH tunnel** over exposing port 22 publicly:
existing `ssh`-based deploy scripts keep working unchanged (it's still literally an `ssh`
command), but the Security Group can have **zero inbound rules for port 22**, and access is
gated entirely by AWS IAM instead of a port anyone on the internet can attempt to reach. Requires
an IAM instance profile with `AmazonSSMManagedInstanceCore` attached to the EC2 instance.

If that's more setup than the situation warrants right now, the minimum acceptable fallback is
Security Group SSH restricted to a specific known IP (§1.1) — never Anywhere.

---

## 7. Cost reality check

Free tier is **pooled per instance type across the whole account**, not per-instance:

- EC2: 750 hours/month total for eligible types (`t2.micro`/`t3.micro`), not 750 hours _per_
  instance. One instance running 24/7 already uses ~730 of those hours by itself.
- RDS: same mechanic, 750 hours/month total for eligible classes, **pooled globally across all
  regions** — a second RDS instance in a different region does not get its own separate 750
  hours if the first one is already using them.
- EBS storage: 30GB total free, pooled across all volumes.
- Free tier lasts 12 months from **account creation**, independent of any promotional credit
  balance — track both separately.

A non-free-tier instance (e.g. `t3.small`, which was never free-tier eligible at any size) is a
real, constant monthly cost from day one — roughly $15/month for `t3.small` in `us-east-1` at
current on-demand pricing; check current pricing rather than trusting this number long-term.

A full second region with a load balancer is **not** a cheap incremental add — expect the second
RDS instance to lose free-tier eligibility (the first instance already consumed the pooled
hours) and Cloudflare Load Balancing to add its own separate monthly charge on top of AWS costs.
Budget accordingly before promising "just add a second region" as a quick fix.

---

## 8. Post-deploy checklist

- [ ] `docker-compose ps` — all services `healthy`, not just `running`.
- [ ] Hit the API health endpoint directly (`curl http://localhost:<port>/api/health` on-box) —
      confirms DB connectivity before even involving Cloudflare/DNS.
- [ ] Hit each public domain over HTTPS from off-box — confirms nginx + cert + Cloudflare proxy
      chain end-to-end.
- [ ] Check `free -h` and `df -h` after the first full deploy — confirm real headroom, not just
      that it happened to fit once.
- [ ] If migrating data from an existing DB: restore, then verify row counts against the source
      (`SELECT COUNT(*)` on the key tables, or `db.<collection>.countDocuments()` for Mongo)
      before considering the migration done — don't just trust that the restore command exited 0.
- [ ] Confirm `mongo` has **no** published port (`docker port <project>-mongo` should show
      nothing) and isn't reachable from outside the box (`nc -zv <elastic-ip> 27017` from your own
      machine should time out/refuse, not connect).
- [ ] Confirm the Mongo backup cron job is actually installed and has run at least once
      (`crontab -l`, then check the dump file exists with a recent timestamp) — don't assume it's
      working just because the script exists.
- [ ] Enable EC2 termination protection and RDS deletion protection once confirmed stable.
