# AgencyFlow (Gemrion Social Media Tool) - status

## End goal

One app where the agency plans and publishes social posts for many clients, and
each client logs into their own portal to see their calendar, reword their copy,
and approve. Hosted on Vercel, backed by Supabase.

## Done

- **Next.js 16 app** (App Router, TypeScript, Tailwind 4). Builds clean.
- **Relational schema + RLS** with 11/11 automated security checks.
- **Legacy data migrated**: 3 clients, 14 posts from old jsonb tables.
- **Magic-link auth** with role-based routing.
- **Agency console**: post list, calendar, full post editor with safety gate.
- **Client management UI**: create clients, invite/remove portal users, delete
  clients - all from the console, no SQL needed.
- **Client portal**: post list, calendar, in-place copy editing, approve/request
  changes, notes.
- **OAuth connect flows**: API routes for FB, IG, X, LI, TT with real OAuth 2.0.
  Demo mode fallback when platform credentials aren't set.
- **Publishing API**: POST /api/publish for manual publish, with per-platform
  logic (FB Graph API, IG 2-step, X API v2, LI UGC Posts).
- **Vercel Cron**: /api/cron/publish runs every 10 minutes, guarded by CRON_SECRET.
- **AI panel**: Moonli-Navy 4:5 image prompt + caption generation via AI Gateway.
- **Publish button** on post editor for immediate publishing.
- **Detailed README** with setup, architecture, security model, deployment docs.
- **GitHub repo**: Sarthakvala/Gemrion-Social-Media-Tool

## Blocked on you

1. **`vercel login`** - interactive browser OAuth, cannot run headless.
2. **AI Gateway billing** - key returns 403 until a credit card is on the Vercel team.
3. **Promote yourself to agency** after first magic-link login.
4. **Platform OAuth credentials** - register apps with Meta/X/LinkedIn/TikTok and
   set the env vars. Demo mode works for planning without them.

## Next

- Image upload to Supabase Storage (replace "Creative URL" with uploader).
- Notification email (client approved / changes requested).
- Drop legacy af_clients / af_posts tables.
- TikTok video upload via Content Posting API.

## Decisions

- Clients edit copy directly (not approve-only). Limited by column GRANT.
- Supabase built-in email for now. Swap before real client onboarding.
- Service key server-side only, behind requireAgency().
- Demo mode for social connections when platform credentials aren't set.
