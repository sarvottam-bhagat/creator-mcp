# EchoFM Studio

EchoFM is an AI-powered workspace for creating, improving, publishing, and marketing audio-story series. A creator can work manually in the Studio or securely ask an AI assistant such as Codex or Claude to work inside their own EchoFM account through MCP.

**Live app:** [echofm-studio.vercel.app](https://echofm-studio.vercel.app)
**Remote MCP endpoint:** `https://echofm-studio.vercel.app/mcp`

## What EchoFM does

### Create audio series in Studio

- Create a series and multiple connected episodes.
- Write a script manually or paste an existing script.
- Save work as a private draft or publish it deliberately.
- Choose an available OpenAI narration voice.
- Choose an available background-music track.
- Generate private narration and cinematic thumbnail art.
- Review an episode before publishing and play its private preview.
- Browse drafts and published episodes grouped by series.

### Improve the writing

- **Cliffhanger Optimizer:** scores a draft ending and suggests stronger endings plus a next-episode hook.
- **Plot Hole Hunter:** reads a selected series and reports continuity risks across its drafts and published episodes.
- **Rewrite Engine:** creates a separate private draft in a new genre or tone while preserving the source episode.
- **Writers Room skill:** helps an AI agent act like a careful story editor, director, critic, character psychologist, historian, and audience lens.

### Create marketing content

- Select a narrated, published episode.
- Ask EchoFM to analyze that episode and suggest five episode-specific talking-head UGC hook scripts.
- Edit every hook script before any paid video generation begins.
- Generate approved vertical talking-head UGC videos with Seedance through OpenRouter.
- Select one hook to make a private 26-second reel:
  - 4 seconds of talking-head hook
  - 20 seconds of episode narration with cover visual
  - 2-second branded end card with series title, episode title, and editable CTA
- Play or download private UGC clips and finished reels.

## Simple product flow

```mermaid
flowchart LR
  Creator --> Studio
  Studio --> "Series + scripts"
  "Series + scripts" --> "Voice, music, thumbnail"
  "Voice, music, thumbnail" --> "Narration + review"
  "Narration + review" --> "Draft or publish"

  Creator --> "Codex / Claude"
  "Codex / Claude" --> "Secure EchoFM sign-in"
  "Secure EchoFM sign-in" --> "EchoFM MCP + Writers Room"
  "EchoFM MCP + Writers Room" --> "Create, improve, review, publish"

  "Draft or publish" --> Marketing
  Marketing --> "Episode-specific UGC hooks"
  "Episode-specific UGC hooks" --> "Editable scripts"
  "Editable scripts" --> "Talking-head videos"
  "Talking-head videos" --> "Hook + episode preview + CTA reel"
```

## Architecture and security

The Studio UI, marketing UI, OAuth consent screen, API routes, and MCP endpoint are deployed as **one Vercel application**. The MCP server is a remote Streamable HTTP endpoint at `/mcp`.

```text
Creator
  -> EchoFM web app or Codex / Claude
  -> OAuth approval
  -> EchoFM MCP route
  -> Supabase Auth, Postgres, and private Storage
```

Every MCP request is made with the authenticated creator's access token. Supabase Row Level Security restricts database rows and private Storage assets to that creator. The app never exposes OpenAI, OpenRouter, or Supabase service credentials in the browser.

Publishing is intentionally guarded: an agent should review an episode immediately before publishing, stop if blockers exist, and call `publish_episode` only when the creator explicitly approves publication.

## Prerequisites

- Node.js 22 or newer
- npm
- A Supabase project
- An OpenAI API key for narration, thumbnails, cliffhanger analysis, rewrites, and episode-specific hook suggestions
- An OpenRouter API key with access to `bytedance/seedance-2.0-fast` for talking-head UGC generation
- A Vercel project for production deployment

## Run locally

1. Clone the repository and install dependencies.

   ```bash
   git clone https://github.com/sarvottam-bhagat/creator-mcp.git
   cd creator-mcp
   npm install
   ```

2. Copy the example environment file.

   ```bash
   Copy-Item .env.example .env.local
   ```

3. Fill in `.env.local`.

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   OPENAI_API_KEY=your-openai-api-key
   OPENROUTER_API_KEY=your-openrouter-api-key
   MCP_PUBLIC_URL=http://localhost:3000/mcp
   PORT=8787
   ```

   Never commit `.env.local` or any API key.

4. Apply the SQL files in `supabase/migrations/` to the linked Supabase project. The migrations create the Studio tables, private Storage buckets, RLS policies, UGC video records, and reel records.

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

5. Configure Google sign-in and the Supabase OAuth server in the Supabase dashboard.

   - Enable Google under **Authentication → Sign In / Providers**.
   - Add `http://localhost:3000` and the deployed app URL to allowed redirect URLs.
   - Enable **Authentication → OAuth Server**.
   - Set its authorization path to `/oauth/consent`.
   - Enable dynamic OAuth apps if you want Codex, Claude, and other compatible MCP clients to self-register.

6. Start the app.

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Verify before deployment

```bash
npm run build
npm test
```

`npm run build` checks the Next.js production build and TypeScript. Run it before each deployment.

## Deploy to Vercel

Set the same environment variables in Vercel. In production, `MCP_PUBLIC_URL` must be the public endpoint, for example:

```text
https://echofm-studio.vercel.app/mcp
```

Deploy:

```bash
vercel --prod
```

The app and the MCP server deploy together. There is no separate MCP deployment in the current architecture:

```text
https://echofm-studio.vercel.app       # EchoFM web app
https://echofm-studio.vercel.app/mcp   # EchoFM remote MCP server
```

## Connect EchoFM MCP to Codex, Claude, or Cursor

1. Sign in to EchoFM with Google.
2. In the AI client, choose **Add custom MCP server** or **Connect MCP**.
3. Select **Streamable HTTP** / **Remote MCP**.
4. Use this URL:

   ```text
   https://echofm-studio.vercel.app/mcp
   ```

5. Start authentication when the client asks.
6. EchoFM opens a consent screen. Sign in with the same EchoFM account and choose **Allow access**.
7. Return to the AI client. It can now use EchoFM tools only for that creator's data.

The exact button names differ between Codex, Claude, Cursor, and other clients, but the connection type and URL are the same.

To remove access later, open **Studio → Connected agents** and revoke the connected AI client.

## MCP tool catalog

| Tool | What it does | Important rule |
| --- | --- | --- |
| `list_series` | Lists the authenticated creator's series. | Read-only. |
| `list_episodes` | Lists draft or published episodes, optionally for a series. | Resolve IDs before changes. |
| `list_published_episodes` | Lists all published episodes for the creator. | Read-only. |
| `get_episode` | Returns one creator-owned episode and its assets. | Use an ID returned by a list or create call. |
| `create_episode` | Creates a new private episode draft and can create the first episode of a new series. | Draft by default. |
| `update_episode` | Changes a draft title or script. | Regenerate narration after script changes. |
| `list_voices` | Lists available OpenAI voices. | Do not invent voice IDs. |
| `select_voice` | Selects a voice for a draft. | Must happen before narration generation. |
| `list_music_tracks` | Lists available background tracks. | Do not invent track IDs. |
| `select_music` | Stores a music choice for a draft. | It stores metadata; it does not mix music into generated speech. |
| `generate_narration` | Generates private speech narration from the saved script and voice. | Paid generation; script should be final. |
| `generate_thumbnail` | Generates private episode art from a prompt. | Paid generation; agree on the concept first. |
| `review_episode` | Returns publication blockers and private preview links. | Run immediately before publishing. |
| `publish_episode` | Publishes a completed episode. | Requires explicit confirmation: `confirm: true`. |
| `score_cliffhanger` | Scores a draft ending and suggests three alternatives. | Draft only; saved script must have at least 40 characters. |
| `apply_cliffhanger_rewrite` | Applies a creator-selected ending to a draft. | Regenerate narration afterward. |
| `analyze_story_continuity` | Reports plot holes and inconsistencies across a series. | Read-only; does not modify episodes. |
| `rewrite_episode_script` | Creates a new private rewrite draft in the same series. | Preserves the original and never publishes automatically. |

## EchoFM Writers Room skill

The local `echofm-writers-room` skill gives an AI agent a safe creative workflow for EchoFM. It knows the tool order, creative checks, and publishing rules instead of treating every MCP tool call as an isolated action.

Skill location:

```text
C:\Users\User\.codex\skills\echofm-writers-room
```

It helps an agent:

- Build a story bible and multi-episode arc before creating a series.
- Work in drafts by default.
- Select the exact series and episode IDs before making changes.
- Use the right production order: voice and music → narration and thumbnail → review → publish gate.
- Use Plot Hole Hunter for a read-only series continuity audit.
- Use Cliffhanger Optimizer only on a saved draft, then wait for the creator to choose an option.
- Use Rewrite Engine to preserve the original episode and create a separate new draft.
- Treat asset generation and publication as creator-approved actions.

Example request:

```text
Use $echofm-writers-room to create a three-episode emotional mystery series.
Publish Episodes 1 and 2 after a blocker-free review.
Keep Episode 3 as a draft, run continuity analysis, and suggest a stronger emotional-payoff ending.
```

## Marketing and UGC workflow

1. Publish an episode with a final script and generated narration.
2. Open **Marketing** and select that episode.
3. Click **Suggest 5 hooks for this episode**.
4. EchoFM analyzes the episode's script and returns five concise UGC hook scripts.
5. Edit the hooks. No Seedance video is submitted yet.
6. Click **Generate 5 approved videos**.
7. When videos finish, select a completed hook in **Reel Maker**.
8. Edit the final CTA and create the reel.
9. Play or download the finished private MP4 from the reel library.

Hooks are linked to the selected episode, so Episode 1 hooks, Episode 2 hooks, and their finished reels stay separate.

## Responsible creative use

EchoFM can help creators explore genres, tones, pacing, hooks, and original premises. It should be used to create original work or work the creator has rights to use. Do not use it to copy protected books, films, or another creator's story word-for-word. A useful request describes desired themes or genre patterns rather than asking to clone a protected work.

## Project structure

```text
app/
  studio/                 Creator Studio UI
  marketing/              Episode-specific UGC and Reel Maker UI
  mcp/route.ts            Remote Streamable HTTP MCP endpoint
  oauth/consent/          OAuth approval screen for AI agents
  api/                    Studio and marketing API routes
mcp/
  server.ts               MCP tool registration and handlers
  http.ts                 Authenticated MCP HTTP transport
lib/
  server/studio/          Episodes, generation, review, cliffhanger, continuity
  server/marketing/       UGC suggestion and Seedance orchestration
  marketing/              Browser reel renderer
supabase/migrations/      Database, RLS, Storage, UGC, and reel migrations
```

## Key implementation notes

- Narration is generated as speech through OpenAI. A selected music track is stored separately as production metadata and is shown in review; it is not currently mixed into the narration file.
- The finished marketing reel is rendered privately in the creator's browser using ffmpeg.wasm, then uploaded to private Supabase Storage.
- Marketing videos and reels are private creator assets.
- Episode-specific hook text is generated before video generation so creators can edit and approve it first.
