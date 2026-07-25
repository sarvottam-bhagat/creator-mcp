# EchoFM Studio Design

## Goal

Create a secure, persistent creator workspace where an authenticated creator writes an episode script, selects an OpenAI narration voice and a background-music track from dropdowns, generates a thumbnail from a prompt, and saves or publishes the episode.

## Product flow

1. A creator opens `/studio` and sees their series and episode drafts.
2. Selecting **New episode** opens a five-step workspace: Script, Voice, Music, Thumbnail, and Review.
3. The creator writes a title, episode number, and script.
4. The creator picks an available OpenAI built-in voice from a dropdown, optionally adds delivery instructions, and generates narration.
5. The creator picks a background music mood/track from a dropdown. Music choices are a curated catalog; selecting one persists its identifier with the episode and enables preview alongside narration.
6. The creator writes an image prompt and generates a portrait thumbnail.
7. The Review step displays the script summary, chosen voice, music, narration audio, and thumbnail. The creator saves a draft or publishes.

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
- Thumbnail generation uses `gpt-image-2` with portrait output suitable for episode art. A generated image is uploaded to private Storage, then saved on the episode.
- Each route validates the authenticated creator owns the episode before calling OpenAI or writing media.
- Errors from validation, quota/rate limits, image moderation, and Storage are shown as recoverable UI errors without losing the script.

## Save and publish behavior

- Script and selections are saved as an episode draft.
- Generating voice or art updates the same draft after successful Storage upload.
- Publishing requires title, non-empty script, a chosen voice, selected music, generated narration, and thumbnail.
- Published episodes render in a read-only summary state; the creator may explicitly return one to draft to revise it.

## Validation

- Unit tests cover episode readiness validation, request validation, ownership checks, and music/voice option contracts.
- Integration tests cover draft persistence and publish preconditions against Supabase.
- Manual browser verification covers the full five-step journey, dropdown selection, generated-media preview, draft save, and publish state.

## Scope boundaries

This first version generates narration audio and persists the selected background music. It does not mix narration and music into one rendered master file; previews use the narration player and selected music track. A future render pipeline can compose them after the creator workflow is proven.
