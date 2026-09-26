# AgencyFlow (Gemrion Social Media Tool) - status

## End goal

A content studio where agency staff create consistent, on-brand social posts for
any brand: train it once on a brand (voice, rules, look, example posts), generate
a month of posts (calendar, captions, hashtags, slides), then download the
finished assets and post them. Automated publishing comes after this core works.

## Done

- **Brand Studio (2026-09-26)**, the refocus on the core idea:
  - `brand_profiles` + `brand_examples` tables, new post creative columns
    (`supabase/002_brand_studio.sql`, applied to prod).
  - Brand kit page per brand (`/console/clients/[id]/brand`): voice, audience,
    pillars + mix, always/never, banned words, CTA, hashtags, palette, fonts,
    logo upload, example posts, live slide preview.
  - Studio (`/console/studio`): generate a month with Claude (`claude-opus-5`),
    two-step (plan, then parallel writes of 3 posts) to fit Vercel time limits.
    Posts land as `draft` so cron never publishes them.
  - Slide renderer `/api/render` (next/og): 6 layouts, brand fonts from Google
    Fonts, rendered on demand, nothing stored.
  - Post page: preview, creative/slide editor, per-platform captions, AI rewrite
    with a note, ZIP download, "save as brand example".
  - Month ZIP (slides + captions per post + calendar.csv); portal clients see
    rendered slides and can download too.
  - Gemrion brand kit seeded from gemrion-marketing (navy/cream/gold, DM Sans,
    real logo URL, 6 approved captions as examples).
  - Vitest added (prompt, normalize, export tests).
- **Settings + providers + AI brand drafting (2026-09-26, later)**:
  - /console/settings: Anthropic and/or OpenAI key, provider + model, Test connection.
    Keys AES-256-GCM encrypted (HKDF from the service role key) in `ai_settings`
    (003_ai_settings.sql, applied; zero grants for anon/authenticated).
  - Provider layer (Strategy): one structured-output interface, Claude via
    @anthropic-ai/sdk, OpenAI via responses.parse; falls back to the other key.
  - "Draft brand kit with AI": reads a public website (SSRF-guarded fetch) + notes,
    drafts the kit using the market-brand method (voice dimensions, archetype,
    we-are/we-are-not, messaging hierarchy, pillars, palette/fonts, to-confirm list).
  - Studio "From a brief" mode: campaign over any date range; month mode kept.
  - Prompts rebuilt from the installed social + market-social skills: hook types,
    5 carousel frameworks, per-platform caption lengths and hashtag limits,
    pillar mix, promo spacing, 1-in-3 question posts, AI-tell avoidance.
  - Old AI Gateway panel and /api/ai/generate removed; `ai` package dropped.
  - 87 unit tests.
- Earlier: Next.js 16 app, RLS schema, auth (magic link + password), console,
  client portal, OAuth + publish API + cron (kept, now secondary).

## Blocked on you

1. **Add an AI key** in the app: Settings (Anthropic and/or OpenAI), then Test connection.
2. **Test-data cleanup**: two demo IG `social_accounts` rows and the test
   client portal user still exist.

## Next

- Run a real generation once a key is saved; tune prompts on the output.
- Optional AI background images (OpenAI) behind a toggle.
- Auto-publish from the studio once the core is proven.

## Decisions

- Visuals are brand templates rendered on demand, not AI images (consistent,
  free, no storage). OpenAI kept for later optional backgrounds.
- Official vendor SDKs directly (Anthropic, OpenAI), not Vercel AI Gateway.
- AI keys live encrypted in the DB (entered in Settings); rotating the Supabase
  service role key makes saved keys unreadable, so re-enter them after a rotation.
- Website reader validates DNS on every redirect hop; a DNS-rebinding race is
  theoretically possible but the action is agency-only.
- "Training" = brand kit + few-shot examples in a cached system prompt, not fine-tuning.
- Clients may edit `platform_captions` (column grant), like caption/copy/hashtags.
- Service key server-side only, behind requireAgency().
