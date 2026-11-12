# Scheduler feature inventory: Postiz, Mixpost Lite, TryPost (2026-11-13)

Purpose: a feature-parity checklist for AgencyFlow. It describes what three open-source social media schedulers do, so AgencyFlow can match the features with its own code.

Licence note: Postiz and TryPost are AGPL-3.0. Mixpost Lite is MIT, but is the free edition of a commercial product. This file describes behaviour only. No code was copied, and none should be copied from these repos.

Method: static reading of the source snapshots (routes, controllers, Prisma schema, Laravel migrations and models, enums, provider classes, Vue/React pages, README). Nothing was run. "(?)" marks anything not confirmed in code.

Path prefixes used in the Notes column:
- `P:` = Postiz repo root (`postiz-app-main/`). Main folders: `apps/backend/src/api/routes/`, `apps/backend/src/public-api/routes/v1/`, `libraries/nestjs-libraries/src/` (shorthand `L:`), `apps/frontend/src/components/` (shorthand `F:`), `apps/orchestrator/src/` (Temporal workflows).
- `M:` = Mixpost Lite repo root (`mixpost-main/`). Main folders: `routes/web.php`, `database/migrations/create_mixpost_tables.php`, `src/`, `resources/js/`.
- `T:` = TryPost repo root (`trypost-main/`). Main folders: `routes/`, `app/`, `database/migrations/`, `resources/js/`.

Legend: Y = present, N = not found, Pro = shown in Mixpost Lite UI but locked to the paid Mixpost Pro, (?) = uncertain.

Stack summary:
- Postiz: NestJS + Next.js + Prisma/PostgreSQL + Temporal workflows + Mastra (AI agent/MCP). Multi-org SaaS or self-host. 36 provider classes.
- Mixpost Lite: Laravel package + Inertia/Vue. Single admin user. 3 networks. Most team, AI, API features are Pro-only.
- TryPost: Laravel 12 + Inertia/Vue + Laravel MCP + Passport OAuth. Multi-workspace SaaS or self-host (`SELF_HOSTED` skips billing). 15 platform variants.

---

## 1. Feature tables

### 1.1 Publishing & composer

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| One composer posting to many channels at once | Y | Y | Y | P: `F:new-launch/editor.tsx`, `Post.group`; M: `Components/Post/PostForm.vue`; T: `Mcp/Tools/Post/CreatePostsTool.php` (one independent post per destination sharing `post_group_id`) |
| Global content plus per-channel override | Y | Y | Y | P: `F:new-launch/select.current.tsx` (global vs custom per channel); M: `mixpost_post_versions` (original + per account); T: each channel is its own `posts` row in a group |
| Per-network live preview | Y | Y (X, FB, Mastodon) | Y (all 15) | P: `F:new-launch/providers/*/…preview.tsx`, `F:launches/general.preview.component.tsx`; M: `Components/PostPreview/*`; T: `resources/js/components/posts/previews/*Preview.vue` |
| Character counter and per-network validation | Y | Y | Y | P: provider `maxLength()` + `@Rules` text; M: `PostCharacterCount.vue`, `PostContentValidator.vue`; T: `Platform::maxContentLength()`, `CharacterCounter.vue` |
| Rich text toolbar (bold, underline, heading, bullets via Unicode) | Y | N | Y (?) | P: `F:new-launch/bold.text.tsx`, `u.text.tsx`, `heading.component.tsx`, `bullets.component.tsx`; T: `posts/composer/ComposerEditorToolbar.vue` (exact buttons not checked) |
| Editor modes: plain, Markdown, HTML per network | Y | N | N | P: provider `editor = 'normal' / 'markdown' / 'html'` (Dev.to, Hashnode, Medium, Discord, Whop = markdown; X, Telegram, WordPress, Listmonk = html) |
| Emoji picker | Y | Y | Y | P: `F:new-launch/editor.tsx`; M: `Package/EmojiPicker.vue`; T: `posts/EmojiPicker.vue` |
| @mentions with account lookup | Y | N | Y (Discord) | P: `F:new-launch/mention.component.tsx`, `/integrations/mentions`, `Mentions` table (X, LinkedIn, Bluesky, Threads, Discord); T: `discord/accounts/{account}/mentions` route |
| Threads / multi-part posts | Y | Pro | Y | P: editor value is an array, extra items go through provider `comment()`; M: Pro "Post first comment/Thread"; T: `Services/Social/Concerns/PublishesThreads.php` (X, Bluesky, Mastodon, LinkedIn), `meta.thread_replies` |
| First comment | Y | Pro | Y (LinkedIn as content type) | P: same array mechanism; T: `ContentType::LinkedInComment` (?) for other networks |
| Delay between thread parts / comments | Y | N | N | P: `F:new-launch/delay.component.tsx`, `Post.delay` |
| Thread finisher (auto closing message) | Y | N | N | P: `F:new-launch/finisher/thread.finisher.tsx` |
| AI split of long text into a thread | Y | N | N | P: `POST /posts/separate-posts`, `L:openai/openai.service.ts separatePosts()` |
| Post now / schedule / draft / add to queue | Y | Y (queue = Pro) | Y | P: `State` enum QUEUE/PUBLISHED/ERROR/DRAFT; M: `PostActions.vue` (Add to queue wrapped in UpgradePro); T: `Enums/Post/ScheduleAction.php` draft/publish_now/queue_next/queue_top/reschedule |
| Default post action per user (next, now, top, custom) | N | N | Y | T: `Enums/User/DefaultPostAction.php` |
| Duplicate post | Y | Y | Y | P: `F:launches/calendar.tsx` (Duplicate); M: `POST posts/duplicate/{post}`; T: `POST posts/{post}/duplicate` |
| Bulk delete | N (?) | Y | Y (ideas only) | M: `DELETE posts/` multipleDelete; T: `DELETE /ideas` bulk |
| Resume unfinished post / autosave draft | N (?) | N | Y | T: `posts/composer/ResumeUnfinishedPostDialog.vue`, `Actions/Post/RecoverEmptyDraft.php` |
| X poll | N | N | Y | T: `ContentType::XPoll`, `Support/Social/XPoll.php` (2-4 options, 25 chars, 5-10080 min) |
| X long-form article | Y | N | N | P: `dtos/posts/providers-settings/x.dto.ts` post_type article, article_title, article_status, article_cover |
| Content-warning / spoiler text (Mastodon) | N | N | Y | T: `MastodonPublisher.php` meta.spoiler_text |
| Link defusing on X (avoid link penalty) | Y (strip) | N | Y (defuse) | P: env `STRIP_LINKS_FROM_X_POSTS`; T: `config/trypost.php` `x.defuse_links`, `Services/Social/ContentSanitizer.php` |
| Preview exact text sent to network | N | N | Y | T: `Mcp/Tools/Post/PreviewPostTool.php`, `GET /api/posts/{post}/preview` |
| "Made with AI" / AI-generated disclosure flag | Y (X, TikTok) | N | Y (X, IG, TikTok, YouTube) | P: `x.dto.ts made_with_ai`, `tiktok.dto.ts video_made_with_ai`; T: publisher meta `is_ai_generated` / `is_aigc` |
| Paid partnership / branded content flags | Y (X, TikTok) | N | Y (TikTok) | P: `x.dto.ts paid_partnership`, TikTok `brand_content_toggle`; T: `TikTokPublisher.php brand_content_toggle` |
| Creation-method tracking (web, API, MCP, CLI, autopost) | Y | N | Y | P: `CreationMethod` enum; T: `Enums/Post/CreatedVia.php` web/mcp/api/repurpose |
| Error display and retry | Y | Y | Y | P: `Errors` table, `Post.error`; M: `PostErrors.vue`, `post_accounts.errors`; T: `PublishStatus` retrying, `retry_at`, `PostFailurePopover.vue` |
| Link a missing release ID (post published but ID lost) | Y | N | N | P: `GET /posts/:id/missing`, `PUT /posts/:id/release-id`, `F:launches/missing-release.modal.tsx` |
| Track posts deleted on the network | N | N | Y | T: webhook `post.deleted_on_network`, `PostDeletedOnNetworkBadge.vue` |

### 1.2 Scheduling & queue

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Calendar views | Day, week, month, list | Month, week | Days, week, month | P: `F:launches/calendar.tsx` display day/week/month/list; M: `routes/web.php calendar/{date}/{month|week}`; T: `pages/posts/Calendar.vue` VIEWS |
| Drag-and-drop rescheduling on calendar | Y | N (?) | Y | P: react-dnd in `calendar.tsx`, `PUT /posts/:id/date`; T: `publish/CalendarDragAnnouncer.vue`, `PUT posts/{post}/schedule` |
| Unscheduled ideas / undated panel next to calendar | N | N | Y | T: `publish/CalendarUndatedPanel.vue` |
| Per-channel time slots | Y | Pro | Y | P: `Integration.postingTimes` (minutes of day, default 3 slots), `POST /integrations/:id/time`, `F:launches/time.table.tsx`; T: `SocialAccount.posting_schedule` (7 days, max 4 HH:mm per day) |
| Find next free slot | Y | Pro | Y | P: `GET /posts/find-slot`, `/public/v1/find-slot/:id`; T: `ListFreeSlotsTool` (max 30, 90 days ahead) |
| Queue: add next / add to top | N (slot only) | Pro | Y | T: `Enums/Post/QueuePosition.php` next/top |
| Reorder queue, move post to slot, reflow | N | N | Y | T: `Actions/Post/Queue/*` (ReorderChannelQueue, MoveChannelPostToQueueSlot, ReflowChannelQueue) |
| Auto-generate schedule from weekly goal | N | N | Y | T: `GeneratePostingScheduleTool.php` (recommended windows per network), `ChannelPostingGoalSetting.vue` |
| Copy schedule from another channel | N | N | Y | T: `CopyPostingScheduleTool.php` |
| Weekly posting goal with progress | N | N | Y | T: `SocialAccount.posting_goal`, `publish/GoalProgress.vue` |
| Recurring posts | Y (every N days) | N | Y (every N day/week/month/year, times count) | P: `Post.intervalInDays`, `F:launches/repeat.component.tsx` (1-7, 14, 30 days); T: `Enums/Post/RecurrenceFrequency.php`, `recurrence_remaining`, `ScheduleNextOccurrence.php` |
| Evergreen recycling of old posts from a pool | N | N | N | Not found in any app |
| Timezone: per user | Y | N | Y | P: `User.timezone`, `POST /user/timezone`; T: `TimezoneSelect.vue` in preferences |
| Timezone: global app setting | N | Y | N | M: `src/Settings.php` timezone |
| Timezone: per channel | N | N | Y | T: `SocialAccount.timezone`, `ChannelTimezoneSetting.vue` |
| Week start and 12/24h time format | N (?) | Y | Y | M: `Settings.php` time_format, week_starts_on; T: `Enums/User/WeekStart.php`, `TimeFormat.php` |
| Per-channel calendar / channel page | N | N | Y | T: `channels/{account}/calendar/{view?}` |
| Instagram grid preview of upcoming posts | N | N | Y | T: `channels/{account}/grid`, `Platform::hasProfileGrid()` |
| Filters (status, channel, customer, tags) | Y | Y | Y | P: `F:launches/filters.tsx`, `select.customer.tsx`; M: `PostsFilter.vue` (status, tags, accounts); T: `CalendarStatusFilter.vue`, `PostChannelFilter.vue` |
| Pre-publish connection health check / "post at risk" alert | Y (refresh workflow) | N | Y | P: `orchestrator/workflows/refresh.token.workflow.ts`, `Integration.refreshNeeded`; T: `Jobs/VerifyUpcomingPostConnections.php`, mail `PostAtRisk` |
| Publishing engine | Temporal workflows | Laravel scheduler + queue job | Laravel queue per platform | P: `orchestrator/workflows/post-workflows/post.workflow.v1.0.8.ts`; M: `Commands/RunScheduledPosts.php`, `Jobs/AccountPublishPostJob.php`; T: `Jobs/PublishToSocialPlatform.php`, `Platform::queue()` |
| Per-network concurrency limits | Y | N | Y (separate queues) | P: provider `maxConcurrentJob` (Reddit 1, LinkedIn Page 2, ...) |

### 1.3 Channels & accounts (per network)

Postiz columns show what Postiz does. Mixpost Lite has only X, Facebook Page, Mastodon. TryPost has 15 variants. Character limits are what each app enforces.

| Network | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| X (Twitter) | OAuth 1.0a, dev app; text, max 4 images or 1 video, threads, article, community, who-can-reply, AI and paid-partnership flags; 280 (100000 premium) | OAuth 1.0a, dev app (keys entered in Services); 280, 4 photos / 1 video / 1 GIF, no mixing | OAuth 2.0, dev app; post, poll, threads; 280; 4 images; alt text 1000 | P: `L:integrations/social/x.provider.ts`, `x.dto.ts`; M: `src/SocialProviders/Twitter/TwitterProvider.php`, `config/mixpost.php`; T: `Services/Social/XPublisher.php`, `config/services.php x` |
| Facebook Page | OAuth 2.0 (Facebook Login), dev app; text, photos, video (optional title), story, coloured text background; 63206 | OAuth 2.0, dev app; 5000, 10 photos / 1 video / 1 GIF | OAuth 2.0, dev app; post, reel, story; 10000; 10 images | P: `facebook.provider.ts`, `facebook.dto.ts` (post_type, text_format_preset_id, title); M: `SocialProviders/Meta/FacebookPageProvider.php`; T: `FacebookPublisher.php`, `ContentType` FacebookPost/Reel/Story |
| Facebook Group | N | UI component only (?) | N | M: `Components/Account/AddFacebookGroup.vue` and `config facebook_group` exist, but provider not registered in `SocialProviderManager.php` |
| Instagram via Facebook Business | OAuth 2.0 via Facebook app; feed, carousel, reel, story (1 media), collaborators, audio, trial reel; 2200 | Pro | OAuth 2.0 via Facebook app; feed (carousel 10), reel, story, collaborators, licensed audio search, trial reel graduation, share-to-feed; 2200, max 5 hashtags | P: `instagram.provider.ts`, `instagram.dto.ts`; T: `InstagramPublisher.php`, `SearchInstagramAudioTool.php` (instagram-facebook only), `Platform::maxHashtags()` |
| Instagram standalone (Instagram Login) | OAuth 2.0, Instagram app; same post types | Pro | OAuth 2.0, Instagram app; same post types | P: `instagram.standalone.provider.ts`; T: `Platform::Instagram`, `Socialite/InstagramProvider.php` |
| Threads | OAuth 2.0, Meta app; text, images, video; 500; auto-plug | N | OAuth 2.0, Meta app; post, ghost post, topic tag; 500; 10 images | P: `threads.provider.ts`; T: `ThreadsPublisher.php` meta.topic_tag, `ContentType::ThreadsGhostPost` |
| LinkedIn (personal) | OAuth 2.0, dev app; text, images, video (1), image carousel posted as PDF (min 2 images); 3000 | Pro | OAuth 2.0, dev app; post with images (10), video, PDF document with title, comment; 3000 | P: `linkedin.provider.ts`, `linkedin.dto.ts` post_as_images_carousel, carousel_name; T: `AbstractLinkedInPublisher.php` document_title, `Platform::allowedMediaTypes()` |
| LinkedIn Page (company) | OAuth 2.0, dev app (Community Management API); same as LinkedIn; analytics | Pro | OAuth 2.0, dev app; same as LinkedIn + organization_id | P: `linkedin.page.provider.ts`; T: `LinkedInPagePublisher.php` |
| TikTok (personal) | OAuth 2.0, dev app; 1 video or photos; privacy level, disable comments/duet/stitch, auto music, brand flags, AI flag, DIRECT_POST vs UPLOAD (inbox draft); 2000 | Pro | OAuth 2.0, dev app; video, photo carousel; privacy level from creator info, comments/duet/stitch, auto music, brand flags, AIGC; 2200 | P: `tiktok.provider.ts`, `tiktok.dto.ts` privacy_level PUBLIC_TO_EVERYONE/MUTUAL_FOLLOW_FRIENDS/FOLLOWER_OF_CREATOR/SELF_ONLY; T: `TikTokPublisher.php`, `GetTikTokCreatorInfoTool.php` |
| TikTok Business | OAuth 2.0, TikTok Business app; up to 35 photos, music library search, location tag; 2200 | N | N | P: `tiktok.business.provider.ts` (media domain must be verified in the TikTok app) |
| YouTube | OAuth 2.0 (Google), dev app; 1 video required; title, privacy public/private/unlisted, made-for-kids, thumbnail, tags; 5000 | Pro | OAuth 2.0 (Google), dev app; Shorts only; privacy, category, licence, embeddable, notify subscribers, made-for-kids, AI flag; 5000 | P: `youtube.provider.ts`, `youtube.settings.dto.ts`; T: `YouTubePublisher.php`, `Enums/YouTube/*` |
| Pinterest | OAuth 2.0, dev app; image pin (max 5 images) or video + cover; board, title, link, dominant colour; 500 | Pro | OAuth 2.0, dev app; pin, video pin, carousel; board (list and create), title, link; 800 | P: `pinterest.provider.ts`, `pinterest.dto.ts`; T: `PinterestPublisher.php`, `CreatePinterestBoardTool.php` |
| Reddit | OAuth 2.0, dev app; self, link or media post; subreddit, title, flair (required check); 10000 | N | N | P: `reddit.provider.ts`, `reddit.dto.ts` |
| Google Business Profile | OAuth 2.0 (Google), dev app + API access; text + 1 image; Standard, Event, Offer; CTA URL; 1500 | N | OAuth 2.0 (Google), dev app; Standard/Event/Offer; CTA Book/Order/Shop/Learn more/Sign up/Call; 1 image; 1500 | P: `gmb.provider.ts`, `gmb.settings.dto.ts`; T: `GoogleBusinessPublisher.php`, `Enums/GoogleBusiness/*` |
| Bluesky | App password (service, handle, password); text, max 4 images or 1 video; 300; auto-repost/plug | N | App password; post, threads, video via Bluesky video service (300 MB); 300; alt text 2000 | P: `bluesky.provider.ts customFields()`; T: `Http/Controllers/Auth/BlueskyController.php`, `config/trypost.php bluesky` |
| Mastodon (default instance) | OAuth 2.0 with app on configured instance; 500 | OAuth 2.0, app auto-registered per instance; 500, 4 photos / 1 video | OAuth 2.0, app registered on user-entered instance; 500, threads, spoiler | P: `mastodon.provider.ts` (env MASTODON_URL); M: `Actions/CreateMastodonApp.php`; T: `Auth/MastodonController.php` |
| Mastodon custom instance | Instance URL entered by user | (same as above) | (same as above) | P: `mastodon.custom.provider.ts` ("M. Instance") |
| Telegram | Shared bot (TELEGRAM_TOKEN), user adds bot and links chat; HTML; 4096 | N | Shared bot added as channel admin, webhook for reactions; 4096; 10 images | P: `telegram.provider.ts`; T: `config/trypost.php telegram`, `routes/webhook.php telegram/webhook` |
| Discord | OAuth 2.0 + bot (own Discord app); pick channel; markdown; 1980 | N | OAuth 2.0 bot scope + shared bot token; pick channel; 2000 | P: `discord.provider.ts`, `discord.dto.ts channel`; T: `config/trypost.php discord` (permissions 248832), `ListDiscordChannelsTool.php` |
| Slack | OAuth 2.0, own Slack app; pick channel; 400000 | N | N | P: `slack.provider.ts` |
| Dev.to | API key; markdown article; title, cover, canonical, organisation, tags | N | N | P: `dev.to.provider.ts`, `dev.to.settings.dto.ts` |
| Hashnode | API key; article; title, subtitle, cover, canonical, publication, tags | N | N | P: `hashnode.provider.ts` |
| Medium | API key; article; title, subtitle, canonical, publication, tags | N | N | P: `medium.provider.ts` |
| WordPress | Site URL + username + application password; HTML article; title, cover, post type, categories, tags, status | N | N | P: `wordpress.provider.ts`, `wordpress.dto.ts` |
| Listmonk (newsletter) | Instance URL + username + password; email with subject, preview text, list, template | N | N | P: `listmonk.provider.ts` |
| Lemmy | Instance + username + password; post to communities with title and URL | N | N | P: `lemmy.provider.ts` |
| Nostr | Private key (hex) | N | N | P: `nostr.provider.ts` |
| Farcaster (Warpcast) | Sign-in via Neynar signer; images only; channels | N | N | P: `farcaster.provider.ts` (env NEYNAR_*) |
| Dribbble | OAuth 2.0, dev app; shot with title and team | N | N | P: `dribbble.provider.ts` |
| Tumblr | OAuth 2.0, dev app; title, link, source URL, tags; 32768 | N | N | P: `tumblr.provider.ts` |
| VK | OAuth 2.0 (VK ID), dev app; 2048 | N | N | P: `vk.provider.ts` |
| MeWe | OAuth (MeWe app key); timeline or group post | N | N | P: `mewe.provider.ts`, `mewe.dto.ts` |
| Kick | OAuth 2.0, dev app; chat message 500 | N | N | P: `kick.provider.ts` |
| Twitch | OAuth 2.0, dev app; chat message or coloured announcement 500 | N | N | P: `twitch.provider.ts`, `twitch.dto.ts` |
| Whop | OAuth 2.0, dev app; forum post in company/experience; markdown | N | N | P: `whop.provider.ts` |
| Skool | Chrome extension (session cookies); group post with title and label | N | N | P: `skool.provider.ts` isChromeExtension, `apps/extension/src/providers/list/skool.provider.ts` |
| Moltbook (AI agent network) | Agent registration returns API key; submolt | N | N | P: `moltbook.provider.ts registerAgent()` |
| Alt text on media | Y | N | Y (per-network max) | P: `F:new-launch/media.settings.section.tsx`; T: `Platform::altTextMaxLength()` |
| Per-network media type rules (images, video, PDF, GIF, mixing) | Y (Rules text) | Y | Y (rich) | T: `ListContentTypesTool.php` returns min/max media, accept_gif, forbids_mixed_media, aspect ratio |
| Custom channel name / nickname / avatar change | Y | N | N | P: `PUT /integrations/:id/custom-name`, `POST /:id/nickname` |
| Disable / enable channel | Y | N | N (?) | P: `POST /integrations/disable`, `/enable` |
| Channel ordering | N (?) | N | Y | T: `PUT settings/workspace/channels/order`, `SocialAccount.position` |
| Token refresh + reconnect flow | Y | N (marks unauthorised) | Y | P: `refresh.token.workflow.ts`; M: `Events/AccountUnauthorized.php`; T: `Jobs/RefreshSocialToken.php`, `Platform::hasTokenRefreshFlow()` |
| Feature flags to switch off a network | N (?) | N | Y | T: `Platform::isEnabled()` env `X_ENABLED` etc. |
| Connect link for a client (connect without logging in) | Y | N | N | P: `GET/POST /integrations/public/connect/:token`, `F:launches/connect.link.tsx`, MCP `integrationConnectTool` (1-hour URL) |

### 1.4 Teams, permissions & approvals

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Multiple users | Y | N (single admin) | Y | P: `UserOrganization`; M: Workspaces are Pro; T: `user_workspace` |
| Multiple organisations / workspaces per login | Y (switch org) | Pro | Y (account > workspaces) | P: `POST /user/change-org`; T: `Account` owns many `Workspace`, `POST workspaces/{workspace}/switch` |
| Roles | SUPERADMIN, ADMIN, USER | N | Flags: is_admin, requires_approval | P: `Role` enum; T: migration `2026_10_01_222005_add_permissions_to_user_workspace_and_invites_tables.php` |
| Invite by email | Y | N | Y (to chosen workspaces) | P: `POST /settings/team`; T: `Invite.workspaces`, `routes/auth.php invites/{invite}/accept` |
| Approval workflow (draft > pending > approved/rejected) | N | Pro | Y | T: `Enums/Post/Status.php` pending_approval, `Actions/Post/Approval/*`, mails `PostApprovalRequested`, `PostApproved`, `PostRejected` |
| Approver can override schedule on approve | N | N | Y | T: `ApprovePostTool.php` (scheduled_at optional) |
| Internal comments / notes on a post | Y (with text anchors, replies, resolve) | Pro (Post Activity) | Y (notes with @mentions, email) | P: `Comments` (anchorStart, anchorEnd, parentId, resolvedAt), `PUT /posts/comments/:id/resolve`; M: `PostActivity.vue` locked; T: `PostNote`, mail `MentionedInComment` |
| Customers (group channels per client) | Y | N | N (use workspaces) | P: `Customer` model, `PUT /integrations/:id/group`, MCP `groupList` |
| Impersonation (admin) | Y | N | N | P: `GET/POST /user/impersonate` |
| Notification preferences (email/in-app per event) | Y (success, failure, streak emails) | N | Y (8 types x email/in-app/both) | P: `User.sendSuccessEmails` etc.; T: `Enums/Notification/Type.php`, `Channel.php` |
| In-app notifications list | Y | Y (toast) | Y (realtime) | P: `GET /notifications/list`; T: `Broadcasting/WorkspaceChannel.php`, `Events/NotificationCreated.php` |
| Email digest | Y | N | N | P: `orchestrator/workflows/digest.email.workflow.ts` |
| Posting streak gamification | Y | N | N | P: `Organization.streakSince`, `streak.workflow.ts` |

### 1.5 Media library & editor

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Media library with search | Y | Y | Y | P: `GET /media`, MCP `mediaListTool` (18/page, filename search); M: `Pages/Media.vue`; T: `MediaTray.vue` |
| Upload from device | Y | Y | Y (chunked) | M: max 5 MB image, 15 MB GIF, 200 MB video (`config/mixpost.php`); T: `POST media/chunked`, `Services/Media/ChunkedAssetReceiver.php` |
| Import from URL | Y | Y | Y | P: `/public/v1/upload-from-url`; M: `POST media/download`; T: `POST media/from-url` |
| Stock photos (Unsplash) | N | Y | Y | M: `Services/UnsplashService.php`; T: `media/unsplash/search`, `trending` |
| GIF search | N | Y (Tenor) | N (Giphy removed) | M: `Services/TenorService.php`; T: migration `clear_giphy_source_from_stored_media` |
| Canva integration | N | N | Y | T: `integrations/canva/*` routes, `Enums/Media/CanvaPreset.php` |
| Google Photos / Google Drive picker | N | N | Y | T: `integrations/google/*`, `media/google-photos/sessions`, `Enums/Media/Source.php` |
| Built-in design editor | Y (Polotno) | N | N | P: `F:launches/polonto.tsx` |
| Crop, appearance, thumbnail, user tags | Thumbnail + alt | N | Crop, appearance, thumbnail, tags, alt | P: `Media.thumbnail`, `thumbnailTimestamp`; T: `posts/composer/MediaEditor*Panel.vue` |
| Auto-adjust media to platform limits | Y | Thumbnails only | Y (optimiser) | P: `Media.status` processing, `process.media.workflow.ts`; M: `src/MediaConversions`; T: `Services/Media/MediaOptimizer.php` |
| PDF documents as media | N | N | Y | T: `Enums/Media/Type.php` Document (LinkedIn) |
| Signed upload link for agents | Y (upload widget ticket) | N | Y | P: `uploadWidgetTicketTool`; T: `RequestMediaUploadTool.php`, `POST /uploads/{token}` signed |
| Storage backends | Local, Cloudflare R2 | Laravel disk | Laravel disk (cloud chunk upload) | P: `L:upload/local.storage.ts`, `r2.uploader.ts`; M: `MIXPOST_DISK` |

### 1.6 AI features

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| AI writing assistant in composer | Y | Pro | Y (generate, regenerate, rephrase, shorten, expand, casual, formal) | P: `F:launches/generator/generator.tsx`; M: ProEditorButton "AI Assistant"; T: `Enums/Ai/PostAssistantMode.php`, `Ai/Agents/PostWritingAssistant.php` |
| Shorten to fit network limit | N (?) | N | Y | T: `Ai/Agents/PostContentShortener.php`, `Platform::recommendedAiContentLength()` |
| Generate posts from a URL / article | Y | N | N | P: `POST /posts/generator`, `L:openai/extract.content.service.ts` |
| AI chat agent inside the app | Y (Mastra agent, threads) | N | N | P: `F:agents/agent.chat.tsx`, `/copilot/agent`, `mastra_*` tables |
| AI image generation | Y (OpenAI, fal) | N | N (?) | P: `POST /media/generate-image`, `L:openai/fal.service.ts`; T: `Media Source::Ai` exists but no generator found |
| AI video generation | Y (Seedance, image+text slides with voice-over) | N | N | P: `L:videos/seedance/seedance.ts`, `videos/images-slides/images.slides.ts` |
| Long video to short clips with captions | Y | N | N | P: `Clipping` / `ClippingClip` models, `clipping.workflow.ts`, MCP `clippingTool` |
| AI alt text | N | N | Y | T: `Ai/Agents/MediaAltTextGenerator.php`, `POST posts/ai/alt-text` |
| AI idea generation | N | N | Y | T: `Ai/Agents/IdeaGenerator.php` (business, audience, notes, language), `POST create/ideas/generate` |
| Brand voice / workspace traits | N | N | Removed (?) | T: migration added traits then `drop_brand_columns_from_workspaces_table` |
| AI credits metering | Y | N | Removed | P: `Credits` model, `GET /copilot/credits`; T: `drop_workspace_ai_usages_table` |
| AI providers | OpenAI, fal | n/a | OpenAI, Gemini | P: `L:openai/*`; T: `config/ai.php` default `AI_TEXT_PROVIDER=openai` |

### 1.7 Analytics & reporting

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Per-channel analytics | Y (12 providers) | Y (X, FB Page, Mastodon) | Y (10 platforms) | P: `GET /analytics/:integration`; providers with `analytics()`: Dribbble, Facebook, GMB, Instagram x2, LinkedIn Page, Pinterest, Threads, TikTok x2, X, YouTube; M: `src/Reports/*`; T: `Platform::isIncludedInAnalytics()` |
| Per-post metrics | Y | N | Y | P: `GET /analytics/post/:postId`, `posts/:id/statistics`; T: `GetPostMetricsTool.php` |
| Follower / audience history | N (?) | Y | Y (daily snapshots) | M: `mixpost_audience`; T: `AnalyticsAccountDailySnapshot.followers_count` |
| Metric catalogue | Provider-specific | X: likes, retweets, impressions; FB: post engagements, impressions; Mastodon: replies, reblogs, favourites | 41 metric keys (reach, saves, watch time, story taps, subscribers gained/lost ...) | M: `Reports/*.php`; T: `Enums/Analytics/MetricKey.php`, `ANALYTIC.md` |
| Import posts published natively on the network | N | Y | Y | M: `mixpost_imported_posts`; T: `Origin::Network`, `Actions/Post/ImportExternalPosts.php` |
| Workspace-wide report across channels | N (?) | Dashboard | Y | T: `GetAnalyticsReportTool.php` (7d, 30d, mtd, custom) |
| Top posts ranked by metric, compare previous period | N | N | Y | T: `ListChannelPublicationsTool.php` |
| Filter analytics by label / post type | N | N | Y | T: `GetChannelInsightsTool.php` |
| Export report | N | N | Y (CSV, Markdown) | T: `Enums/Analytics/ExportFormat.php`, `insights/download/{format}` |
| GitHub stars tracking (Postiz origin) | Y | N | N | P: `Star`, `GitHub`, `Trending` models (legacy) |
| Admin error dashboard | Y | Logs page | N (?) | P: `/admin/errors`, `/admin/stats`; M: `Pages/System/Logs.vue`, `Status.vue` |

### 1.8 Engagement (comments, inbox, replies)

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Unified inbox of incoming comments / DMs | N | N | N | Not found in any app |
| Reply to comments from the app | N | N | N | Not found |
| Auto-reply ("plug") when a post passes N likes | Y (X, Bluesky, LinkedIn Page, Threads) | Pro ("conditions": follow-up comment on high performers) | N | P: `Plugs` model, `@Plug autoPlugPost` in `x.provider.ts`, `bluesky.provider.ts`, `linkedin.page.provider.ts`, `threads.provider.ts`; M: README "Post Versions and Conditions" |
| Auto-repost when a post passes N likes | Y (X, Bluesky, LinkedIn Page) | N | N | P: `autoRepostPost` plugs |
| Other own accounts comment on / repost the post | Y (LinkedIn, X) | N | N | P: internal plugs `linkedin-add-comment`, `x-repost-post-users`, `GET /integrations/:identifier/internal-plugs` |
| Reactions / replies counts from bot networks | N | N | Y (Telegram via webhook, Discord) | T: `ANALYTIC.md` |
| X poll results | N | N | Y | T: `publish/PostPollResults.vue`, `Enums/X/PollVotingStatus.php` |
| External comments on public preview | Y | N | N | P: `GET/POST /public/posts/:id/comments`, `Comments.displayName` |

### 1.9 Automation & integrations

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Public REST API | Y (`/public/v1`) | Pro | Y (`/api`) | P: `public-api/routes/v1/public.integrations.controller.ts`; T: `routes/api.php` (see section 4) |
| API key auth | Y (one key per org, rotate) | Pro | Y (many personal access tokens per workspace) | P: `Organization.apiKey`, `POST /user/api-key/rotate`; T: `CreateApiKeyTool.php`, regenerate route |
| OAuth for third-party apps / agents | Y (Postiz is an OAuth provider, dynamic client registration, PKCE) | N | Y (Passport, MCP OAuth, device codes) | P: `OAuthApp`, `OAuthAuthorization`, `/oauth/register`, `/oauth/token`; T: `oauth_*` migrations, `routes/ai.php Mcp::oauthRoutes()` |
| MCP server | Y (23 tools, Mastra) | N | Y (83 tools, Laravel MCP) | P: `L:chat/tools/tool.list.ts`, `L:chat/start.mcp.ts` (`/mcp`, `/mcp/:id`, `/sse/:id`); T: `app/Mcp/Servers/TryPostServer.php`, `/mcp/trypost` |
| MCP Apps widgets (interactive upload/clipping UI inside chat host) | Y | N | N | P: `L:chat/ui/upload.widget.ts`, `clipping.widget.ts` |
| Copy-paste agent prompt / MCP settings page | Y (per-agent landing pages) | N | Y | P: README agent list; T: `settings/workspace/mcp/prompt`, `McpPromptController.php` |
| Outgoing webhooks | Y (post published only, per-channel filter) | Pro | Y (8 events, HMAC signed, logs, replay, auto-pause) | P: `Webhooks` + `IntegrationsWebhooks`, `orchestrator/activities/post.activity.ts sendWebhooks()`; T: `Enums/Webhook/EventType.php`, `WebhookLog`, mail `WebhookPausedMail` |
| Webhook test send | Y | n/a | Y | P: `POST /webhooks/send`; T: `SendWebhookTestTool.php` |
| RSS / Atom / JSON Feed | Y (auto-post) | N | Y (reader into ideas) | P: `AutoPost` (url, onSlot, syncLast, addPicture, generateContent, integrations), `autopost.workflow.ts`; T: `RssFeed`, `RssFeedCollection`, `RssFeedItem`, curated feed library in `config/trypost.php`, `POST create/feed-items/{item}/idea` |
| Auto cross-post videos from one account to others | N | N | Y ("Repurpose": IG/FB reels, videos, stories to other channels, publish or draft) | T: `Repurpose`, `RepurposeItem`, `Enums/Repurpose/*` |
| Third-party content apps | Y (HeyGen, HubSpot, ReelFarm) | N | N | P: `L:3rdparties/*`, `/third-party` routes |
| n8n node | Y (external package) | N | N | P: README `n8n-nodes-postiz` |
| Make.com app | Y (external) | N | N | P: README `apps.make.com/postiz` |
| Zapier | Mentioned only (?) | N | N | P: README intro |
| CLI | Y (external `postiz` CLI, not in repo) | Artisan commands only | N | P: MCP tool descriptions reference `postiz upload`; P: `apps/commands/src/tasks/*` are admin tasks; M: `src/Commands/*` |
| SDK | Y (Node `@postiz/node`) | N | N | P: `apps/sdk/src/index.ts` (post, postList, upload, integrations, deletePost) |
| Browser extension | Y (Chrome) | N | N | P: `apps/extension/` (cookie-based providers, e.g. Skool) |
| Provider helper functions callable by agents | Y | N | Partial (dedicated tools) | P: `@Tool` methods (boards, subreddits, flairs, channels, tags...), MCP `triggerTool`; T: Pinterest boards, Discord channels, IG audio, TikTok creator info tools |

### 1.10 Links

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Link shortener | Y (Dub, Short.io, Kutt, LinkDrip) | N | Configured only (Bitly keys) (?) | P: `L:short-linking/providers/*`; T: `config/services.php bitly` (no usage found) |
| Shortening preference (ask, always, never) | Y | N | N | P: `ShortLinkPreference` enum, `GET/POST /settings/shortlink`, `POST /posts/should-shortlink` |
| UTM builder for post links | N | N | N | T: UTM columns are sign-up attribution only (`add_utm_columns_to_users_table`) |
| Link preview card in composer | N (?) | N | Y | T: `POST posts/link-preview`, `Services/Social/LinkCard/OpenGraphExtractor.php`, `ComposerLinkCard.vue` |
| Click tracking | Via shortener | N | Network metrics only | P: shortener provider stats (?) |

### 1.11 Content helpers

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Labels / tags with colour | Y | Y | Y | P: `Tags`, `TagsPosts`; M: `mixpost_tags.hex_color`; T: `WorkspaceLabel` (posts and ideas) |
| Signatures | Y (auto-add default) | N | Y (manual append) | P: `Signatures.autoAdd`, `GET /signatures/default`; T: `WorkspaceSignature` |
| Hashtag groups | N | Pro | N | M: ProEditorButton "Open Hashtag Manager" |
| Variables (dynamic text) | N | Pro | N | M: ProEditorButton "Open Variable Manager" |
| Post templates | Y ("Sets": saved channels + settings + content) | Pro | Y (personal or workspace visibility, emoji, built-in library) | P: `Sets` model, `F:sets/sets.tsx`; T: `PostTemplate.visibility`, `create/templates/library/{key}/duplicate` |
| Ideas board (kanban with stages) | N | N | Y | T: `Idea`, `IdeaStage`, `create/ideas` |
| Multilingual post versions | N | Pro | N | M: UpgradePro list "Multilingual" |
| Hashtag limit warning | N | N | Y (Instagram 5) | T: `Platform::hashtagOverflow()` |

### 1.12 Client-facing

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Public preview link for a post (no login) | Y | N | N | P: `app/(app)/(preview)/p/[id]`, `F:preview/*`, `GET /public/posts/:id` |
| Client comments on preview | Y | N | N | P: `POST /public/posts/:id/comments` |
| Customer entity / client selector | Y | N | N (workspace per client) | P: `Customer`, `F:launches/customer.modal.tsx` |
| Client connects their own channel via link | Y | N | N | P: `/integrations/public/connect/:token` |
| Client approval portal | N | N | N (approval is internal, needs a member seat with requires_approval) | T: `Invite.requires_approval` |
| White label | N | Pro | N | M: UpgradePro "White Label Logo" |
| Workspace logo | N | N | Y | T: `POST settings/workspace/logo` |
| Marketplace (buy/sell posts between orgs) | Y (legacy) | N | N | P: `Orders`, `OrderItems`, `MessagesGroup`, `SocialMediaAgency` |

### 1.13 Admin, billing & other

| Feature | Postiz | Mixpost Lite | TryPost | Notes |
|---|---|---|---|---|
| Billing | Stripe tiers STANDARD/PRO/TEAM/ULTIMATE, monthly/yearly, lifetime, coupons, trials | N | Stripe (Cashier), plans, trials, offers | P: `Subscription`, `billing.controller.ts`; T: `Plan`, `Offer`, `Subscription` |
| Self-host switch to skip billing | Y (no gating claimed) | n/a | Y | P: README "We do not gate features"; T: `config/trypost.php self_hosted` |
| Login methods | Local, GitHub, Google, Apple, Farcaster, wallet, generic OIDC | Host Laravel auth | Email, Google, GitHub | P: `Provider` enum; T: `routes/auth.php` |
| Onboarding questionnaire | Y | N | Y (persona, goals, previous software) | P: `F:onboarding`; T: `welcome/*` |
| i18n | Y | N | Y | P: `i18n.json`; T: `lang/`, `Enums/User/Locale.php` |
| Announcements / changelog | Y (announcements) | N | Y ("What's new") | P: `Announcement`; T: `ChangelogEntry` |
| System status and logs page | N (?) | Y | N | M: `system/status`, `system/logs` |
| Account deletion | Y | N | Y | P: `POST /user/delete-account`; T: `DELETE settings/profile` |
| Command palette | N | N | Y | T: `resources/js/components/command-palette` |
| Product analytics (PostHog) | N (?) | N | Y | T: `Services/PostHogService.php` |

---

## 2. Every supported network

"Developer app needed" means that a self-hoster must create their own app (client ID and secret, often with platform review) before users can connect. "Shared bot" means one bot set up once by the operator.

| Network | In which apps | Auth type | Developer app needed | Official API used | Posting capabilities (union across apps) |
|---|---|---|---|---|---|
| X (Twitter) | Postiz, Mixpost, TryPost | OAuth 1.0a (Postiz, Mixpost); OAuth 2.0 PKCE (TryPost) | Yes | X API v2 (`api.x.com/2`), v1.1 media upload (?) | Text 280 (longer for premium in Postiz), 4 images or 1 video or 1 GIF, threads, poll (TryPost), article (Postiz), community, reply settings, AI/paid flags |
| Facebook Page | All three | OAuth 2.0 (Facebook Login) | Yes (Meta app + review) | Graph API (v16 Mixpost, v25 TryPost) | Text, up to 10 photos, video with title, reel, story, coloured background |
| Facebook Group | Mixpost (UI only) | OAuth 2.0 | Yes | Graph API (groups publishing retired by Meta (?)) | Not functional (?) |
| Instagram (Facebook Business login) | Postiz, TryPost (Mixpost Pro) | OAuth 2.0 via Facebook | Yes | Instagram Graph API via graph.facebook.com | Feed image/video, carousel up to 10, reel, story (1 media), collaborators, licensed audio, trial reels |
| Instagram (Instagram login) | Postiz, TryPost | OAuth 2.0 (Instagram Login) | Yes | graph.instagram.com | Same as above (audio search only via Facebook login in TryPost) |
| Threads | Postiz, TryPost | OAuth 2.0 | Yes (Meta app) | graph.threads.net v1.0 | Text 500, up to 10 images, video, topic tag, ghost post |
| LinkedIn personal | Postiz, TryPost | OAuth 2.0 (OpenID + w_member_social) | Yes | LinkedIn REST API | Text 3000, up to 10 images, 1 video, PDF document / image carousel, comments |
| LinkedIn Page | Postiz, TryPost | OAuth 2.0 (w_organization_social) | Yes (Community Management API approval) | LinkedIn REST API | Same as personal, posted as organisation, analytics |
| TikTok | Postiz, TryPost | OAuth 2.0 | Yes (TikTok app + audit for public posting) | TikTok Content Posting API v2 | Video, photo carousel, privacy level, comments/duet/stitch toggles, auto music, brand flags, AIGC, direct post or inbox draft |
| TikTok Business | Postiz | OAuth 2.0 | Yes (TikTok Business app, verified media domain) | TikTok Business API | Video, up to 35 photos, commercial music, location |
| YouTube | Postiz, TryPost (Shorts) | OAuth 2.0 (Google) | Yes (Google Cloud project, YouTube Data API) | YouTube Data API v3, YouTube Analytics v2 | One video, title, description, tags, privacy, category, licence, made-for-kids, thumbnail, notify subscribers |
| Pinterest | Postiz, TryPost | OAuth 2.0 | Yes | Pinterest API v5 | Image pin, video pin with cover, carousel, board, title, link |
| Reddit | Postiz | OAuth 2.0 | Yes | Reddit API | Self, link or media post, subreddit, title, flair |
| Google Business Profile | Postiz, TryPost | OAuth 2.0 (Google) | Yes (API access request) | Business Profile APIs | Standard, event, offer posts, CTA, 1 image |
| Bluesky | Postiz, TryPost | App password | No | AT Protocol (PDS, video.bsky.app) | Text 300, 4 images or 1 video, threads, alt text |
| Mastodon | All three | OAuth 2.0 with app registered on the instance | No (auto-registered); Postiz default instance uses env keys | Mastodon REST API | Text 500, 4 images or 1 video, threads, content warning |
| Telegram | Postiz, TryPost | Shared bot token (BotFather), bot added to channel | Bot only | Telegram Bot API | Text 4096 (HTML), up to 10 images or video |
| Discord | Postiz, TryPost | OAuth 2.0 bot install + bot token | Yes (Discord application with bot) | Discord API v10 | Message to chosen channel, attachments, mentions |
| Slack | Postiz | OAuth 2.0 | Yes (Slack app) | Slack Web API | Message to chosen channel |
| Dev.to | Postiz | API key | No | Forem API | Markdown article with tags, cover, canonical URL |
| Hashnode | Postiz | API key (personal token) | No | Hashnode GraphQL | Article with subtitle, cover, publication, tags |
| Medium | Postiz | API key (integration token) | No | Medium API (legacy, closed to new tokens (?)) | Article with publication, tags |
| WordPress | Postiz | Site URL + username + application password | No | WordPress REST API | HTML article, cover, categories, tags, status |
| Listmonk | Postiz | Instance URL + username + password | No | Listmonk API | Email campaign: subject, preview, list, template |
| Lemmy | Postiz | Instance + username + password | No | Lemmy API | Community posts with title and URL |
| Nostr | Postiz | Private key | No | Nostr relays | Text notes |
| Farcaster | Postiz | Neynar signer (sign in with Farcaster) | Yes (Neynar account) | Neynar API | Casts with images, channels |
| Dribbble | Postiz | OAuth 2.0 | Yes | Dribbble API v2 | Shot with title, team |
| Tumblr | Postiz | OAuth 2.0 | Yes | Tumblr API v2 | Post with title, link, source, tags |
| VK | Postiz | OAuth 2.0 (VK ID) | Yes | VK API | Wall post 2048 |
| MeWe | Postiz | OAuth (MeWe app key) | Yes | MeWe API | Timeline or group post |
| Kick | Postiz | OAuth 2.0 | Yes | Kick API | Chat message 500 |
| Twitch | Postiz | OAuth 2.0 | Yes | Twitch Helix API | Chat message or announcement 500 |
| Whop | Postiz | OAuth 2.0 | Yes | Whop API | Forum post |
| Skool | Postiz | Browser extension session cookies | No (extension) | Unofficial (?) | Group post with title, label |
| Moltbook | Postiz | Agent registration (API key) | No | Moltbook API v1 | Posts to submolts |

Network count: 36 distinct targets (35 functional plus Mixpost's non-functional Facebook Group). Instagram (two logins), LinkedIn (personal, page) and TikTok (personal, business) count as separate targets.

---

## 3. Data model summary (as observed)

Common core across all three:

1. **Tenant**: Postiz `Organization`; Mixpost Lite has none (single install); TryPost `Account` (billing owner) > `Workspace` (brand). Users link through a join table with role flags (`UserOrganization.role`; `user_workspace.is_admin` and `requires_approval`).
2. **Channel / connected account**: Postiz `Integration`; Mixpost `mixpost_accounts`; TryPost `social_accounts`. Fields seen in all three: provider/platform, provider user id, name, username, avatar, encrypted access token, refresh token, expiry, status (authorised / needs reconnect / disabled), JSON `data/meta`. Extra fields: posting times or schedule (Postiz `postingTimes`, TryPost `posting_schedule`, `posting_goal`, `timezone`), customer link (Postiz `customerId`), custom instance details (Mastodon), `position` for ordering (TryPost), `last_verified_at` (TryPost).
3. **Post and per-channel target**. Two designs:
   - *One row per channel* (Postiz `Post`, TryPost `posts` after merging `post_platforms` in Oct 2026). Rows created together share a group id (Postiz `group`, TryPost `post_group_id`). Each row holds content, settings JSON, publish date, state, network release id and URL, error, and recurrence. Threads: Postiz uses `parentPostId` children; TryPost uses `meta.thread_replies` plus `thread_reply_ids`.
   - *Parent post with versions* (Mixpost): `mixpost_posts` (status, schedule_status, scheduled_at, published_at), `mixpost_post_accounts` (post x account, provider_post_id, errors), `mixpost_post_versions` (account_id, is_original, content JSON array of body + media ids).
   - TryPost's design note `docs/superpowers/specs/2026-09-24-independent-social-posts-design.md` documents why it moved to one row per channel.
4. **Status machine**: Postiz QUEUE / PUBLISHED / ERROR / DRAFT. Mixpost DRAFT / SCHEDULED / PUBLISHED / FAILED with schedule PENDING / PROCESSING / PROCESSED. TryPost draft / pending_approval / scheduled / publishing / published / failed, plus a publish status pending / publishing / retrying / pending_review / published / failed / rejected / deleted.
5. **Schedule fields**: `publishDate` / `scheduled_at`, `schedule_mode` (queue or custom), queue position, recurrence (interval, frequency, remaining, anchor, origin), approval fields (requested_at, requested_by, approved_by, approved_at, approval_queue_position).
6. **Media**: Postiz `Media` (path, type, size, thumbnail, alt, status, processingError); Mixpost `mixpost_media` (disk, path, mime, size, conversions); TryPost `medias` (polymorphic owner: post, idea, RSS item; collection, order, upload_token, meta). Posts reference media by id in JSON (Postiz `image`, Mixpost version content, TryPost `media`).
7. **Labels**: tag table with colour plus a post-tag join (`Tags`/`TagsPosts`, `mixpost_tags`/`mixpost_tag_post`, `workspace_labels`/`post_workspace_label` which also links ideas).
8. **Collaboration**: Postiz `Comments` (threaded, text anchors, resolved); TryPost `post_notes` (flat body, author). Notifications: Postiz `Notifications`; TryPost `notification_preferences` + Laravel notifications.
9. **Reusable content**: `Signatures` / `workspace_signatures`; `Sets` (Postiz) / `post_templates` (TryPost); `ideas` + `idea_stages` (TryPost).
10. **Automation**: Postiz `AutoPost` (RSS), `Plugs` + `ExisingPlugData` (engagement triggers), `Webhooks` + `IntegrationsWebhooks`; TryPost `rss_feed_collections` > `rss_feeds` > `rss_feed_items`, `repurposes` > `repurpose_items`, `webhooks` > `webhook_logs`.
11. **Analytics**: Mixpost `mixpost_metrics` (account, date, JSON), `mixpost_audience` (followers per date), `mixpost_facebook_insights`, `mixpost_imported_posts`. TryPost `analytics_publications` (one per remote post, TryPost or network origin), `analytics_publication_daily_snapshots`, `analytics_account_daily_snapshots` (followers + metrics JSON with provenance and precision), `analytics_sync_states`. Postiz fetches live from providers (no metrics tables seen).
12. **Access for agents**: Postiz `Organization.apiKey`, `OAuthApp`, `OAuthAuthorization` (PKCE), `OAuthSelfHostedAuthorization`; TryPost Passport tables (`oauth_clients`, `oauth_access_tokens`, `oauth_auth_codes` with workspace_id, `oauth_device_codes`) + personal access tokens.
13. **Ops**: Postiz `Errors` (per post, platform, body); Mixpost `mixpost_services` (encrypted API credentials entered in the UI) and `mixpost_settings`; TryPost per-platform queues, `retry_at`, `connection_warning_sent_at`.

Minimum entity set for AgencyFlow parity: Agency(tenant) > Brand(workspace) > Channel; User + Membership(flags); Post (one per channel) + PostGroup; Media + PostMedia order; PostingSchedule (per channel, weekly slots, timezone); Recurrence; Approval fields; Label + join; Note; Signature; Template; Idea + Stage; Feed + FeedItem; Repurpose rule; Webhook + DeliveryLog; ApiToken / OAuth client; AnalyticsPublication + daily snapshots (account and post).

---

## 4. MCP and public API: operations exposed to agents

### 4.1 Postiz

**MCP server** (Mastra MCPServer; endpoints `/mcp`, `/mcp/:id`, `/sse/:id`; OAuth scopes `mcp:read`, `mcp:write`; a directory-facing endpoint hides the AI media tools). Source: `L:chat/tools/tool.list.ts`. 23 tools:

1. `integrationList`: list channels, optional group filter
2. `groupList`: list groups (customers)
3. `integrationConnectTool`: return a one-hour URL to connect a new channel
4. `integrationSchema`: get the settings schema and rules for a channel
5. `triggerTool`: call a provider helper (boards, subreddits, flairs, channels, search)
6. `schedulePostTool`: create draft, scheduled or immediate posts
7. `postsListTool`: list posts between two dates
8. `postSettingsTool`: change provider settings of an unpublished post
9. `deletePostTool`: delete a post on one channel with its comments
10. `generateVideoOptions`: list video generators
11. `videoFunctionTool`: helper data for video generation (voice ids)
12. `generateVideoTool`: start AI video generation
13. `videoStatusTool`: poll video job
14. `clippingTool`: cut a YouTube video into captioned vertical clips, optional drafts
15. `clippingStatusTool`: poll clipping job
16. `clippingWidgetTicketTool`: short-lived ticket for the clipping widget
17. `generateImageTool`: AI image for a post
18. `uploadFromUrlTool`: import remote media into the library
19. `mediaListTool`: list library media (18 per page, filename search)
20. `mediaStatusTool`: check media adjustment status
21. `uploadWidgetTool`: show an upload widget (MCP Apps hosts)
22. `uploadWidgetTicketTool`: upload ticket for the widget
23. `uploadWidgetStatusTool`: list files uploaded in a widget session

**Public REST API** (`/public/v1`, API key in Authorization header). Source: `P:apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`:
- Media: `POST /upload`, `POST /upload-from-url`, `GET /media`, `GET /media/:id/status`
- Posts: `GET /posts`, `POST /posts`, `DELETE /posts/:id`, `DELETE /posts/group/:group`, `GET /posts/:id/missing`, `PUT /posts/:id/settings`, `PUT /posts/:id/status`, `PUT /posts/:id/release-id`
- Scheduling: `GET /find-slot/:id`
- Channels: `GET /integrations`, `GET /groups`, `GET /social/:integration` (connect URL), `POST /integrations/connect`, `DELETE /integrations/:id`, `GET /integration-settings/:id`, `POST /integration-trigger/:id`, `GET /is-connected`
- Analytics: `GET /analytics/:integration`, `GET /analytics/post/:postId`
- AI media: `POST /generate-video`, `POST /video/function`, `POST /clipping`, `GET /clipping`, `GET /clipping/:id`
- Account: `GET /me`, `GET /users`, `GET /notifications`, `POST /credits/reset`
- Debug: `GET /debug/posts/:id`, `/debug/account`, `/debug/channels`, `/debug/activity`

**SDK** (`P:apps/sdk/src/index.ts`): `post`, `postList`, `upload`, `integrations`, `deletePost`.

### 4.2 Mixpost Lite

No public API, no MCP, no webhooks. API and webhooks are listed as Pro features (`M:resources/js/Components/Pro/UpgradePro.vue`). Only internal Inertia web routes exist (`M:routes/web.php`).

### 4.3 TryPost

**MCP server** (Laravel MCP at `/mcp/trypost`, OAuth via `Mcp::oauthRoutes()`; methods initialize, ping, tools/list, tools/call). Source: `T:app/Mcp/Servers/TryPostServer.php`. 83 tools:

- Posts (14): list-posts, get-post, create-post, create-posts (multi-channel), update-post, publish-post (now, at time, or queue), approve-post, reject-post, preview-post, delete-post, attach-media-from-url, request-media-upload (signed URL), attach-media-from-upload, get-post-metrics
- Post notes (4): list, create, update, delete
- Recurrence (2): set-post-recurrence, clear-post-recurrence
- Analytics (4): get-analytics-report, get-analytics-publication, get-channel-insights, list-channel-publications
- Platform rules (1): list-content-types
- Signatures (4): list, create, update, delete
- Ideas (12): list, get, create, update, delete (bulk), duplicate, move; idea stages list, create, update, delete, reorder
- Labels (4): list, create, update, delete
- Channels and queue (8): list-social-accounts, get-posting-schedule, update-posting-schedule, generate-posting-schedule, copy-posting-schedule, list-free-slots, reorder-queue, move-post-to-slot
- Network helpers (6): list-pinterest-boards, create-pinterest-board, list-discord-channels, search-instagram-audio, get-instagram-audio, get-tiktok-creator-info
- Repurpose (11): list, create, get, update, activate, pause, resume, disable, list-items, list-source-formats, delete
- Webhooks (9): list, get, create, update, delete, send-test, rotate-secret, list-logs, replay-log
- Workspace (1): get-workspace (with caller's is_admin and requires_approval)
- API keys (3): list, create, delete

Total: 83, matching the 83 tool classes registered in the server file.

**Public REST API** (`T:routes/api.php`, `auth:api` = Passport tokens or personal access tokens, per-workspace, rate-limited):
- `GET /analytics`, `GET /analytics/publications/{publication}`
- `POST /uploads`, `POST /uploads/{token}` (signed)
- Posts: `GET /posts`, `POST /posts`, `POST /posts/batch`, `GET/PUT/DELETE /posts/{post}`, `PATCH/DELETE /posts/{post}/recurrence`, `POST /posts/{post}/media`, `/media/from-upload`, `/media/from-url`, `GET /posts/{post}/metrics`, `GET /posts/{post}/preview`, notes CRUD under `/posts/{post}/notes`, `POST /posts/{post}/approve`, `POST /posts/{post}/reject`
- `GET /content-types`, `GET /workspace`
- Signatures, ideas, idea-stages, labels: full CRUD (+ ideas duplicate, move, bulk delete; stages reorder)
- Channels: `GET /social-accounts`, Pinterest boards list/create, TikTok creator info, Instagram audio list/show, Discord channels, `GET /channels/{account}/insights` and `/insights/publications`, posting schedule show/update/generate/copy, queue slots, reorder, move to slot
- Repurposes: source formats, CRUD, items, activate, pause, resume, disable
- Webhooks: CRUD, send-test, rotate-secret, logs, replay
- API keys: list, create, delete

**Webhook events** (`T:app/Enums/Webhook/EventType.php`): post.created, post.scheduled, post.unscheduled, post.published, post.deleted_on_network, post.restored, post.failed, post.deleted (plus webhook.test ping). Signed with HMAC-SHA256 in `X-Webhook-Signature`.

**Postiz webhook events**: one event when a post is published, filtered by selected channels (`P:apps/orchestrator/src/activities/post.activity.ts sendWebhooks()`).
