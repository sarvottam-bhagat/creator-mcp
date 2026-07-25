# EchoFM — MCP-Native Audio Series Platform (PocketFM Hackathon)

## Context

PocketFM-organized hackathon, Databricks is the infra partner, **48 hours, solo**. The idea: a PocketFM-style web app (listener + creator sides) where every creator action is also exposed as an **MCP server** — so creators connect Claude Code/Codex as a plugin and build entire episodes by command ("build my second episode"), including script, voice selection, background sound, thumbnail, and publishing **as a draft**. On top: an analytics dashboard and an **ad-intelligence agent** that finds the most engaging time-window of a trending episode and pushes it to Meta Ads as a draft campaign (via Composio). The pitch to PocketFM: "this is what your creator ecosystem looks like when every creator has an agent — agents propose, humans approve."

Everything real (no mocks) except listener analytics data, which is seeded/simulated (clearly disclosed to judges per hackathon rules).

## Architecture (all on Databricks Free Edition)

| Piece | Runs on |
|---|---|
| Web app — Next.js, PocketFM-style UI | Databricks Apps (Node supported; 3-app limit) |
| Platform MCP server (HTTP/streamable) | **Same Databricks App** as web app — one server exposes UI + `/api/mcp` (conserves app quota) |
| Meta Ads MCP server | Second Databricks App (or same app, second endpoint `/api/ads-mcp`) — calls Composio Meta Ads toolkit |
| DB (users, series, episodes, assets, analytics) | Lakebase (managed Postgres) |
| Audio files, thumbnails, ad clips | Unity Catalog Volumes (via Databricks Files API) |
| Script writing, hook analysis, ad-window suggestion | Databricks Foundation Model APIs (Claude/Llama endpoints, OpenAI-client compatible). OpenAI GPT as fallback if quota issues |
| TTS voices, thumbnail images, transcription | OpenAI API (tts-1/gpt-4o-mini-tts, gpt-image-1, whisper-1) |
| Audio mixing (voice + BGM/SFX, ad clip cutting) | ffmpeg (bundled/static binary) inside the app; small pre-licensed BGM/SFX library (~8 tracks tagged by mood) |
| Auth | NextAuth credentials (email+password) in Lakebase; per-creator **API keys** generated in dashboard for MCP connect |

## Build order (priority-cut for 48h)

### Phase 1 — Foundation (~10h)
1. Next.js app scaffold, Lakebase schema: `users`, `series`, `episodes` (status: draft/published), `assets`, `listen_events` (seeded), `api_keys`.
2. Auth (NextAuth credentials), creator dashboard shell, listener home (browse series, episode player with HTML5 audio).
3. Deploy to Databricks Apps **immediately** (their own guide: deploy early), verify Lakebase + Volumes access from the app.

### Phase 2 — Creation pipeline, manual + MCP (~14h)
4. Episode creation pipeline as shared server functions (used by both UI and MCP):
   - `writeScript(seriesContext, prompt)` → Foundation Model API
   - `generateAudio(script, voiceId)` → OpenAI TTS → Volume
   - `mixAudio(voiceFile, bgmMood, pacing)` → ffmpeg (BGM bed at low gain, optional SFX)
   - `generateThumbnail(episodeSummary, style)` → gpt-image-1 → Volume
   - `saveEpisodeDraft(...)` → Lakebase
5. Manual creator UI: create series/episode, voice picker (preview clips of ~6 OpenAI voices), BGM mood picker, thumbnail generate/upload, publish button.
6. **Platform MCP server** at `/api/mcp` (streamable HTTP, Bearer = creator API key). Tools:
   `list_series`, `get_series`, `create_series`, `write_episode_script`, `create_episode` (script→voice→bgm→thumbnail→draft, params for voice/mood/pacing), `list_voices`, `list_bgm`, `generate_thumbnail`, `publish_episode`, `get_episode_analytics`. Creators can layer their own skills (e.g. viral-idea skill) on top in Claude Code — no work needed our side, but mention in demo.

### Phase 3 — Analytics + Ad intelligence (~10h)
7. Seed realistic `listen_events` for demo episodes → analytics dashboard: plays, completion rate, **retention curve** per episode, trending episode ranking.
8. **Hook Finder**: `suggest_ad_window(episode_id)` → Whisper transcript (word timestamps) → Foundation Model scores segments for hook strength (cliffhanger/conflict/emotion) → returns best 20–40s window + reasoning. Shown in dashboard ("Run an ad from 12:20–12:55 — here's why") and as MCP tool.
9. **Ads MCP server / flow**: `create_ad_draft(episode_id, start, end)` → ffmpeg clips segment + appends CTA voice line ("Listen free on EchoFM") → uploads creative → Composio Meta Ads: create campaign+adset+ad **paused/draft**. Creator does final publish in Meta themselves. `get_ad_metrics` tool for the close-the-loop story.

### Phase 4 — Polish + demo prep (~8h)
10. PocketFM-style visual polish (dark theme, series cards, player bar).
11. Rehearse the 3-minute demo: one Claude Code conversation → "create a 2-episode thriller, pick a tense voice and BGM, generate thumbnails, publish drafts" → switch to browser, episodes are playable → open analytics → "find the best ad hook for episode 1 and draft a Meta ad" → show draft campaign in Meta Ads Manager.
12. Screen-record the full flow as fallback (Databricks apps auto-stop after 24h; restart before judging). Credit third-party assets/models in submission.

## Key decisions already made
- **Draft-first everywhere**: agent creates drafts, human publishes (safety story for judges).
- **Shared service layer**: UI routes and MCP tools call the same functions — MCP is provably at parity with the UI.
- **Databricks FM APIs for text, OpenAI for TTS/image/whisper** — strongest partner story without capability loss.
- One Databricks App hosting UI + MCP endpoint(s) to stay within quotas.

## Risks
- Databricks Apps daily fair-use quota / auto-stop → deploy early, develop locally, recording fallback.
- Composio Meta Ads needs a Meta ad account connected — set this up in hour 1, not hour 40. If blocked, ads flow degrades to "creative generated + campaign JSON prepared" with screenshots.
- ffmpeg mixing is fiddly → keep BGM mixing to a simple low-gain bed under narration; skip per-scene SFX if time runs short.

## Verification
- End-to-end: fresh browser session → sign up → create episode manually → plays in listener view.
- MCP: connect Claude Code to deployed `/api/mcp` with an API key → `create_episode` → draft appears in dashboard with audio+thumbnail → publish → playable.
- Ad flow: `suggest_ad_window` returns sane window on a real episode; `create_ad_draft` produces a playable clip and a paused campaign visible in Meta Ads Manager (or prepared payload if Meta blocked).
- Run the exact demo script once from the final Databricks workspace before judging.
