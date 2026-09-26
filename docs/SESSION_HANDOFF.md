# Session Handoff - 2026-09-26

## What We Were Doing
Refocusing AgencyFlow on its core goal: generate consistent, on-brand social posts for any
brand (calendar, captions, hashtags, slides) that staff can download and post. Then added an
in-app Settings page for Anthropic/OpenAI keys and AI brand-kit drafting. Now committing and
deploying.

## What Was Completed This Session
- Brand kits: `brand_profiles`, `brand_examples` (supabase/002_brand_studio.sql, applied to prod).
- Studio (`/console/studio`): "Plan a month" and "From a brief" modes; plan step then parallel
  write batches of 3 (`src/lib/studio/generate.ts`).
- Slide renderer `/api/render` (next/og, brand fonts from Google Fonts, 6 layouts).
- Post page: preview, creative editor, per-platform captions, "Rewrite with AI", ZIP download,
  "Save as brand example". Month ZIP with calendar.csv. Portal shows rendered slides.
- Settings (`/console/settings`): Anthropic/OpenAI keys encrypted (AES-256-GCM, HKDF from the
  service role key) in `ai_settings` (supabase/003_ai_settings.sql, applied). Provider layer in
  `src/lib/ai/`.
- "Draft brand kit with AI" (`src/lib/brand/`): SSRF-guarded website reader + market-brand method.
- Prompts rebuilt from the installed `social`, `market-social`, `market-brand` skills.
- Removed the old AI Gateway panel + `/api/ai/generate`, dropped the `ai` package.
- Gemrion brand kit seeded in prod (6 examples).
- Vitest: 87 unit tests passing. `npm run build` clean.

## Current State
| Area | State |
|---|---|
| Build / tests | Clean build, 87/87 tests |
| DB migrations | 002 + 003 applied to prod |
| Logged-in UI | Not browser-verified by Claude (login is against prod Supabase) |
| Live AI generation | Not run yet: no API key saved |
| Lint | 1 pre-existing error in `src/lib/platforms.ts` (require import), not from this work |

## Next Steps (in order)
1. Sign in, open Settings, save an AI key, press Test connection.
2. Generate a Gemrion month in Studio; review output and tune prompts in `src/lib/studio/prompt.ts`.
3. Clean up test data (two demo IG `social_accounts` rows, the test client user).
4. Later: optional AI background images, auto-publish from Studio.

## Key Files Changed
- src/lib/studio/* - prompt, schema, normalize, export, zip, render slide, data, generate
- src/lib/ai/* - crypto, settings, providers (Anthropic + OpenAI)
- src/lib/brand/* - html parsing, safe site reader, brand draft schema/mapping
- src/app/console/studio, settings, clients/[id]/brand - pages + server actions
- src/app/api/render/route.tsx - slide PNGs
- supabase/002_brand_studio.sql, 003_ai_settings.sql

## Commands To Know
- `npm run dev -- --port 3100` (launch config "agencyflow")
- `npm test` (vitest), `npm run build`
- Supabase connector `e9a36e62` reaches project `seuwvwozweokefxshnso` for SQL/migrations.

## Decisions Made
- Visuals = brand templates rendered on demand, not AI images; nothing stored.
- Official vendor SDKs, not Vercel AI Gateway. Keys entered in-app, env vars are fallback only.
- "Training" = brand kit + few-shot examples in a cached system prompt.
- Generated posts are `draft` so the publish cron never picks them up.

## Warnings / Gotchas
- Rotating the Supabase service role key makes saved AI keys unreadable; re-enter them.
- Next 16: read `node_modules/next/dist/docs/` before using Next APIs (see AGENTS.md).
- next/og font subsets must include uppercase glyphs (kickers are CSS-uppercased).
