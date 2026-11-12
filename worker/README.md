# AgencyFlow worker

Runs long jobs on this machine instead of on Vercel, where functions time out.
Today: `video_render` (brand-templated reels with Remotion) and `worker_ping`
(connectivity check).

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

## Reel rendering

- Composition: `worker/remotion/` (`Reel.tsx`). One `Reel` composition renders
  every reel; size and length come from the spec (`calculateMetadata`).
- The render contract is `src/lib/video/spec.ts` (shared with the web app). The
  app copies the spec into the job, so editing a reel never changes a render
  that is already running.
- Brand fonts load from Google Fonts at render time; a font that fails to load
  falls back to a system font instead of failing the render.
- The MP4 is stored as a `reel` asset (with width, height and duration) under the
  brand, ready for client approval.
- Smoke test without Supabase: `npm run render:sample` inside `worker/`
  (writes `worker/out/sample.mp4`). A 16-second 1080x1920 sample takes about
  2 minutes on 2 cores.
- Studio preview for designing the template: `npm run studio` inside `worker/`.
- Licence: Remotion is free for individuals and companies of up to 3 people;
  a bigger agency needs a Remotion company licence (remotion.pro).

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

The container is limited to 2 CPUs, 4 GB RAM and 1 GB shared memory for Chrome
(`docker-compose.yml`). The image is about 1.5 GB because it includes Chrome. Stop it
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
