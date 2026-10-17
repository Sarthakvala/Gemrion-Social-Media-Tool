# AgencyFlow worker

Runs long jobs (video renders now, more later) on this machine instead of on
Vercel, where functions time out.

## How it works

Pull model: the worker asks Supabase for work, so nothing on the internet needs
to reach this PC.

1. The web app inserts a row in `public.jobs` with `runner = 'worker'`.
2. The worker calls `claim_job()`, which hands the oldest queued job to exactly one
   worker (`FOR UPDATE SKIP LOCKED`).
3. While it runs, the worker refreshes `locked_at` every minute. If it goes quiet
   for 15 minutes (crash, PC asleep), the next claim puts the job back in the
   queue, or fails it after `max_attempts`.
4. Output files go to the private `assets` bucket and get a row in
   `public.assets`, so they show up under Console > Assets for approval.

When the PC is off, jobs just wait as `queued`.

## Run it

1. Copy `worker/env.template` to `worker/.env` and fill in the Supabase URL and
   service role key (same values as the web app's `.env.local`).
2. Start Docker Desktop, then from the repo root:

```bash
docker compose -f worker/docker-compose.yml up -d --build
```

```bash
docker compose -f worker/docker-compose.yml logs -f
```

3. In the console, open Jobs, pick a brand, press **Test the worker**. Within a few
   seconds the job should turn `succeeded` and a "Worker check" file appear in Assets.

Without Docker (development), from the repo root with the same variables set:

```bash
node worker/src/main.ts
```

The container is limited to 2 CPUs and 4 GB RAM (`docker-compose.yml`). Stop it
with `docker compose -f worker/docker-compose.yml down`; a running job finishes
first (2-minute grace period).

## Security

The worker uses the Supabase **service role key**, which bypasses row level
security. Keep `worker/.env` on this machine only (it is git-ignored and excluded
from the Docker build context), and rotate the key in Supabase if this machine is
lost. Rotating it also makes saved AI keys unreadable (see STATUS.md).

## Adding a job kind

1. Add the kind to the `jobs.kind` check in a new migration and to
   `JOB_KINDS` in `src/lib/jobs/types.ts`.
2. Write a handler in `worker/src/handlers/` (throw `PermanentError` for input
   that retrying cannot fix) and register it in `HANDLERS` in `worker/src/main.ts`.
3. Test it with a fake `JobQueue` like `worker/src/loop.test.ts`.
