# Session Handoff - 2026-10-17

## What We Were Doing
Turning AgencyFlow into the agency's single platform for 1-5 brands (plan:
`~/.claude/plans/c-users-sarthak-downloads-awesome-opus5-vast-hinton.md`). Phase 1
(foundation) is built; the frontend now has a section for every phase; deploying.

## What Was Completed This Session
- Share metadata: `src/lib/site.ts`, OG/Twitter tags, `/opengraph-image`, robots, sitemap;
  proxy lets crawlers reach them. `npm run index:code` -> `docs/CODE_INDEX.md`.
- Skills installed to `~/.claude/skills`: anatomy, brag, brag-slim, 54 content skills,
  12 Remotion skills. The two "awesome" zips are link lists / prompt libraries, not skills.
- Migrations applied to prod (each dry-run in a rolled-back transaction first):
  004 jobs + assets + asset_comments + private `assets` bucket + `claim_job()`;
  006 comment author FKs to profiles (fixed pre-existing bug: post notes never showed);
  007 approval stamping fixes, one-child-per-version, cost numeric(12,6), `spend_by_brand()`.
- Cost metering: providers emit usage -> `trackJob()` (`src/lib/jobs/track.ts`) records
  Studio month/brief, rewrite, brand draft and playbook runs, DB writes inside the job.
- Console: Assets, Jobs & spend, Playbooks (3 ported skills), Video & reels, Meta ads,
  SEO/AEO/GEO, Reports; grouped sidebar shell (`src/components/Shell.tsx`, `src/lib/nav.ts`).
- Portal: Files list + review (`src/app/portal/assets`).
- Worker (`worker/`): Node 24 pull worker + Dockerfile + compose. Verified on prod natively
  and as the Docker image `worker-worker` (claimed and finished ping jobs in ~2 s).
- Independent code review: no critical/high; all 4 mediums and most lows fixed.

## Current State
| Area | State |
|---|---|
| Tests / build / lint | 146 tests pass, build clean, 1 pre-existing lint error (`src/lib/platforms.ts` require) |
| DB | 004, 006, 007 applied to prod `seuwvwozweokefxshnso` |
| Deploy | `b94e948` live: both Vercel projects (`gemrion-social-media-tool`, `agencyflow`, team gemrion1) report success. Prod URL https://gemrion-social-media-tool.vercel.app: robots, OG tags, share image OK; console/portal routes redirect to /login when signed out |
| Logged-in UI | Not browser-verified by Claude (prod login). Shell checked on a temporary preview page (desktop + 375px, no overflow); page queries probed read-only against prod |
| AI keys | OpenAI key saved; no Anthropic key. Default model still `claude-opus-5` |
| Worker | Image built locally; not left running. Needs `worker/.env` |
| Test data | 2 worker_ping jobs + 2 "Worker check" assets under Gemrion |

## Next Steps (in order)
1. Sign in on production and click through every console section (Claude cannot sign in).
2. Create `worker/.env` from `worker/env.template`; `docker compose -f worker/docker-compose.yml up -d`.
3. One live playbook run on Gemrion (costs cents) to confirm output + cost recording.
4. Phase 2: `video_render` handler (Remotion) in the worker, reel script playbooks, templates.
5. Merge the separate security-hardening session (migration 005) when it finishes.

## Key Files Changed
- `supabase/004_jobs_assets.sql`, `006_comment_profiles.sql`, `007_jobs_assets_hardening.sql`
- `src/lib/ai/usage.ts`, `providers.ts` - pricing table + usage listener
- `src/lib/jobs/*` - repo, trackJob, state rules, workerLastSeen
- `src/lib/assets/*`, `src/app/console/assets/*`, `src/app/portal/assets/*`, `src/components/assets/*`
- `src/lib/playbooks/*`, `src/app/console/playbooks/*`, `src/components/playbooks/*`
- `src/app/console/{video,ads,seo,reports,jobs}/page.tsx`, `src/components/PhaseIntro.tsx`
- `src/lib/reports/monthly.ts`
- `worker/**`, `.dockerignore`
- `src/components/Comments.tsx` - works for posts and assets, shows load errors

## Commands To Know
- `npm run dev -- --port 3100`, `npm test`, `npm run build`, `npm run index:code`
- `docker compose -f worker/docker-compose.yml up -d --build` / `logs -f` / `down`
- Deploy status: `gh api repos/Sarthakvala/Gemrion-Social-Media-Tool/commits/<sha>/status`

## Decisions Made
- AgencyFlow is the hub; integrate open source for commodity parts later (Postiz, n8n).
- Worker runs locally in Docker, pull model; uses the service role key (owner's choice).
- Meta ads first; ads are pushed PAUSED, a person switches on spend.
- Skills run in the app as versioned playbooks on the brand system prompt.
- Planned sections show real data and say what is missing; no mock numbers.

## Warnings / Gotchas
- Deploys come from pushes to `main`. Always `git fetch` first.
- Vercel connector is authorised for team "Sarthak Finanshels", not gemrion1; use `gh api` for status.
- `agencyflow.vercel.app` belongs to someone else; the `agencyflow` Vercel project uses another domain.
- Never `git add -A`: `.claude/worktrees/` holds another session's worktree, and the
  root has 4 large zip files that must not be committed.
- `.env*` files are blocked by a permission deny rule; the worker template is `worker/env.template`.
- `timeout` does not stop a native `node worker/src/main.ts` on Windows; stop it by PID.
- Rotating the Supabase service role key makes saved AI keys unreadable; re-enter them.
- Next 16: read `node_modules/next/dist/docs/` before using Next APIs (see AGENTS.md).
- next/og font subsets must include uppercase glyphs (kickers are CSS-uppercased).
