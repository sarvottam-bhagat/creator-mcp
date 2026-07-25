# EchoFM Studio Design

## Goal

Create a secure, persistent creator workspace where an authenticated creator writes an episode script, selects an OpenAI narration voice and a background-music track from dropdowns, generates a thumbnail from a prompt, and saves or publishes the episode. The same backend will later power an MCP server for authorized AI agents.

## Product flow

1. A creator opens `/studio` and sees their series and episode drafts.
2. Selecting **New episode** opens a five-step workspace: Script, Voice, Music, Thumbnail, and Review.
3. The creator writes a title, episode number, and script.
4. The creator picks an available OpenAI built-in voice from a dropdown, optionally adds delivery instructions, and generates narration.
5. The creator picks a background music mood/track from a dropdown. Music choices are a curated catalog; selecting one persists its identifier with the episode and enables preview alongside narration.
6. The creator writes an image prompt and generates a portrait thumbnail.
7. The Review step displays the script summary, chosen voice, music, narration audio, and thumbnail. The creator saves a draft or publishes.

## Delivery sequencing

Phase 1 delivers the Studio web application, Supabase backend, and OpenAI integrations. Its service boundaries and API contracts are designed so a later MCP server can reuse them without duplicating creator, generation, or publication logic.

Phase 2 delivers the MCP server and agent configuration. A creator will then be able to connect Claude Code, Cursor, Codex, or another MCP host and ask it to create or publish an episode without browser automation.

## User interface

The Studio uses the existing EchoFM dark palette, typography, spacing, button shapes, cards, and status colors. It is a creator tool rather than a consumer browse page:

- left dashboard column: creator’s series and draft episodes;
- main workspace: a labeled stepper and focused editing panel;
- right review rail on desktop: episode metadata and generation status;
- responsive layout: review rail stacks under the editor on small screens;
- progress, loading, empty, generation-failure, and publish-success states are explicit.

## Data model

All public-schema tables have RLS enabled and owner policies based on `auth.uid()`.

- `profiles`: one creator profile per authenticated user.
- `series`: creator-owned title and description.
- `episodes`: creator-owned metadata, script, selected voice, selected music ID, narration storage path, thumbnail storage path, generation state, and `draft` or `published` status.
- `music_tracks`: seed-only catalog of selectable background tracks (title, mood, duration, preview URL). It is readable by authenticated users and writable only by server-side administration.

Storage uses two private buckets:

- `episode-audio`: generated narration files at `<user-id>/<episode-id>/narration.mp3`.
- `episode-art`: generated thumbnails at `<user-id>/<episode-id>/thumbnail.png`.

Storage policies restrict objects to their owner path. Signed URLs, rather than public object URLs, are issued for preview.

## OpenAI integration

Server-side Next.js route handlers use `OPENAI_API_KEY`; it is never exposed in browser code.

- Narration uses `gpt-4o-mini-tts` with the user-selected built-in voice and optional delivery instructions. The initial dropdown contains the currently supported built-in voices: Alloy, Ash, Ballad, Coral, Echo, Fable, Onyx, Nova, Sage, Shimmer, Verse, Marin, and Cedar.
- Scripts longer than the speech endpoint's 4,096-character input limit are split at sentence boundaries into ordered narration segments. Each segment is generated and stored independently, and the Studio player and MCP response expose the ordered playlist.
- Thumbnail generation uses `gpt-image-2` with portrait output suitable for episode art. A generated image is uploaded to private Storage, then saved on the episode.
- Each route validates the authenticated creator owns the episode before calling OpenAI or writing media.
- Errors from validation, quota/rate limits, image moderation, and Storage are shown as recoverable UI errors without losing the script.

## Save and publish behavior

- Script and selections are saved as an episode draft.
- Generating voice or art updates the same draft after successful Storage upload.
- Publishing requires title, non-empty script, a chosen voice, selected music, generated narration, and thumbnail.
- Published episodes render in a read-only summary state; the creator may explicitly return one to draft to revise it.

## MCP server

**Phase 2 — not part of the current Studio implementation.**

The project ships an independently runnable TypeScript MCP server using the official MCP TypeScript SDK and stdio transport. It is distributed with the repository and connects to the deployed EchoFM Studio backend using two environment variables:

- `ECHOFM_STUDIO_URL`: the deployed Studio origin.
- `ECHOFM_STUDIO_TOKEN`: a creator-scoped personal access token created in the Studio settings screen.

The token is stored only as a hash in the `mcp_tokens` table, is bound to one `profiles` row, can be revoked from Studio, and is sent as a bearer credential only to the configured Studio origin. The browser uses Supabase Auth; both browser requests and MCP requests resolve to the same `CreatorPrincipal` before invoking the same server-side studio service functions.

The MCP server registers concise, typed tools for the full workflow:

- `list_series` and `list_episodes` retrieve only the caller's records.
- `create_episode_draft` creates an episode under a caller-owned series.
- `update_episode_script` saves title, episode number, and script.
- `list_voices` returns the supported OpenAI voice choices; `set_episode_voice` saves the selected one.
- `list_music_tracks` returns the curated music dropdown choices; `set_episode_music` saves the selected track.
- `generate_narration` produces the ordered OpenAI narration playlist.
- `generate_thumbnail` creates episode art from a prompt.
- `get_episode_review` returns the readiness checklist, media metadata, and signed preview URLs.
- `save_episode_draft` persists the current state.
- `publish_episode` changes status only when every publish precondition is met and requires `confirm: true` to make the external side effect explicit to the agent and creator.

Every MCP tool validates its input, authenticates the token, checks episode ownership, and returns structured content designed for agent reasoning. It never accepts a Supabase service key from an MCP host.

## Validation

- Unit tests cover episode readiness validation, request validation, ownership checks, and music/voice option contracts.
- Integration tests cover draft persistence and publish preconditions against Supabase.
- MCP contract tests cover tool schemas, token authentication, ownership isolation, and the full agent-driven create-to-publish journey.
- Manual browser verification covers the full five-step journey, dropdown selection, generated-media preview, draft save, and publish state.

## Scope boundaries

The current Studio version generates narration audio and persists the selected background music. It does not mix narration and music into one rendered master file; previews use the narration playlist and selected music track. A future render pipeline can compose them after the creator workflow is proven. The MCP server is explicitly deferred to Phase 2 and is not built alongside the Studio.
