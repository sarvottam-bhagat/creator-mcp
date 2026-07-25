# EchoFM Authenticated MCP Server Design

## Goal

Build a production-oriented remote MCP server that lets Claude, Cursor, Codex, and other compatible AI agents operate the existing EchoFM Studio workflow for an authenticated creator. Every agent action must resolve to the same Supabase user as the Studio session, create or update only that creator's records, and save new episodes as private drafts unless the creator explicitly requests publication.

This specification supersedes the personal-token and stdio MCP proposal in the original Studio design. The selected design uses Supabase Auth as an OAuth 2.1 authorization server and exposes EchoFM through a remote Streamable HTTP MCP endpoint.

## Success criteria

- Connecting an MCP client opens a browser-based EchoFM sign-in and consent flow.
- The MCP server receives a short-lived Supabase OAuth access token and validates it before handling tools.
- All database and Storage operations run with that user token, so existing RLS policies enforce creator ownership.
- An agent can complete the full Studio workflow: create a draft, write the script, choose voice and music, generate narration and art, review readiness, publish, and list the finished episode.
- Drafts created through MCP appear immediately in that same user's `/studio` workspace.
- Studio and MCP use one shared generation and publication service rather than separate implementations.
- The service runs locally and is packaged for deployment as a Databricks App.

## Architecture

The repository will contain two independently runnable application entry points:

1. The existing Next.js Studio serves the creator UI, sign-in experience, OAuth consent screen, generated-media API, and episode library.
2. A Node.js TypeScript MCP service exposes a Streamable HTTP endpoint at `/mcp` using the official Model Context Protocol SDK.

Supabase remains the system of record and authorization authority. Supabase Auth provides OAuth 2.1 authorization-code flow with PKCE, refresh-token rotation, discovery metadata, and dynamic client registration. The EchoFM MCP endpoint acts as the protected resource and points MCP clients to the Supabase authorization server through protected-resource metadata and an OAuth challenge on unauthenticated requests.

The MCP service never receives a Supabase secret or service-role key from a client. It uses only the server's publishable project key plus the creator's OAuth bearer token. The OpenAI key remains server-only in the deployment environment.

## OAuth and consent flow

1. A creator adds the deployed EchoFM `/mcp` URL to an MCP client.
2. The client discovers the protected resource and Supabase OAuth authorization server.
3. The client registers dynamically when supported and begins authorization-code flow with PKCE.
4. Supabase redirects the browser to EchoFM's `/oauth/consent?authorization_id=...` route.
5. If the creator has no Studio session, EchoFM asks them to sign in and preserves the authorization request.
6. The consent page displays the requesting client, requested identity scopes, and the capabilities the agent will gain. The creator may approve or deny access.
7. Supabase issues access and refresh tokens to the MCP client after approval.
8. Each MCP request carries the access token. The MCP server validates the current user with Supabase Auth and creates a Supabase client that forwards the same token to Database and Storage.
9. Expired or revoked sessions return a standards-compliant `401` challenge so the MCP client can refresh or reauthorize.

The Studio will also expose a small connected-agents area where a signed-in creator can view authorized OAuth clients and revoke a grant. Revocation must immediately prevent future token refresh and require a new consent flow.

## Authorization and ownership

The existing ownership model remains authoritative:

- `series.creator_id` must equal `auth.uid()`.
- `episodes` are accessible only through a series owned by `auth.uid()`.
- generated audio and images live under a first Storage path segment equal to the authenticated user ID.
- `music_tracks` remains a read-only catalog for authenticated users.

The MCP service does not bypass RLS and does not use a service-role client for creator operations. A valid token from one user therefore cannot select, update, publish, sign, or delete another user's rows or media.

New MCP-created episodes always start with `status = 'draft'` and `published_at = null`. Publication is available only through the explicit `publish_episode` tool, requires `confirm: true`, and runs the same readiness validator used by Studio.

## Shared Studio service layer

Generation and episode operations will move into focused server modules under `lib/server/studio/`:

- `auth.ts`: bearer extraction, Supabase token validation, and user-scoped Supabase client creation.
- `episodes.ts`: creator-scoped series and episode queries, draft creation, updates, lists, and publication.
- `generation.ts`: narration chunking, OpenAI TTS, image generation, private uploads, and safe cleanup of partial uploads.
- `review.ts`: readiness checks, selected voice/music metadata, and short-lived signed preview URLs.
- `errors.ts`: typed validation, authentication, authorization, dependency, and generation errors.

The existing Next.js generation route becomes a thin adapter over this service. MCP tools call the same service functions directly. The browser API and MCP cannot diverge on model choices, asset paths, validation, or publishing requirements.

## MCP tools

Every tool has a strict input schema and returns both concise human-readable text and structured JSON.

- `list_voices`: returns supported OpenAI narration voices and display names.
- `list_music_tracks`: returns the current curated background-music catalog.
- `list_series`: lists the authenticated creator's series.
- `list_episodes`: lists that creator's drafts and published episodes, optionally filtered by series or status.
- `get_episode`: returns one creator-owned episode and generation state.
- `create_episode`: creates a draft. It accepts an existing owned `series_id` or creates a new series using `series_title`.
- `update_episode`: updates the title and script of a creator-owned draft. Editing a published episode is rejected until it is deliberately returned to draft in Studio.
- `select_voice`: validates and stores one supported voice.
- `select_music`: validates and stores one catalog track.
- `generate_narration`: generates ordered MP3 parts from the saved script and voice, uploads them privately, then updates the draft only after every part succeeds.
- `generate_thumbnail`: creates episode art from a supplied prompt, uploads it privately, and updates the draft after upload succeeds.
- `review_episode`: returns publish blockers, episode choices, asset metadata, and short-lived signed preview URLs.
- `publish_episode`: requires `confirm: true`, rechecks every publish condition, then sets `status = 'published'` and records `published_at`.
- `list_published_episodes`: returns the creator's published library.

The first release does not expose destructive delete tools. It also does not allow an agent to alter the music catalog, voice catalog, ownership fields, Storage paths, or another user's records.

## Generation behavior

Narration uses the existing server-side `gpt-4o-mini-tts` integration and supported voice catalog. Long scripts are split into ordered chunks below the model input limit. Database state is updated only after all chunks upload successfully. If a later chunk fails, newly created files from that attempt are removed where possible and the previous narration remains attached to the episode.

Thumbnail generation uses the existing `gpt-image-2` integration with the Studio's square episode-art settings. A failed generation or upload leaves the previous thumbnail unchanged.

MCP generation responses report model, voice, part count, private asset paths, and estimated readiness. They never return the OpenAI key, Supabase refresh token, private bucket credentials, or raw internal exception details.

## Review and publication

`review_episode` uses the shared readiness rules. Publication requires:

- a non-empty title;
- a non-empty script;
- a supported selected voice;
- a current music-track selection;
- at least one generated narration part;
- a generated thumbnail.

The tool returns blockers without changing status. `publish_episode` reruns the checks immediately before updating the row, so an agent cannot publish stale or incomplete state. Calling it without `confirm: true` returns a confirmation-required result rather than publishing.

## Error handling

- Missing or invalid bearer tokens return `401` with OAuth discovery information.
- Valid users requesting unowned records receive a not-found style response that does not reveal whether another creator's record exists.
- Invalid voice, music, status, or malformed tool inputs return actionable validation errors without side effects.
- OpenAI rate-limit, billing, moderation, and transient failures map to safe MCP errors and preserve the draft.
- Supabase Database or Storage failures do not produce a false success response.
- Logs include a request ID, tool name, user ID, episode ID where applicable, outcome, and duration. Access tokens, story text, and secrets are excluded from logs.

## Deployment

The repository will include:

- production build and start scripts for the MCP service;
- a health endpoint that does not expose user or configuration data;
- Databricks App configuration with the MCP process command;
- an environment-variable example containing names only;
- connection examples for Claude, Cursor, and Codex using the deployed `/mcp` URL;
- a deployment checklist for configuring Supabase Site URL, `/oauth/consent` authorization path, OAuth 2.1 server, asymmetric JWT signing keys, and dynamic client registration.

Local development can test the MCP protocol and bearer validation immediately. The complete interactive OAuth redirect flow requires a reachable Studio origin registered in Supabase; final production callback values will be set after the Databricks App URL exists.

Required runtime configuration is limited to the Supabase project URL, publishable key, OpenAI key, MCP public URL, and port. Secrets are supplied through the deployment environment and are never committed.

## Testing

### Unit tests

- MCP tool schemas and validation.
- Narration chunking and safe replacement behavior.
- Publish readiness and explicit confirmation.
- Error mapping and secret-safe logging.

### Service tests

- A valid user creates a draft and sees it through the same Studio query path.
- Another authenticated user cannot read or mutate that draft.
- Voice/music selection validates against the shared catalogs.
- Generation updates the episode only after successful private uploads.
- Review reports exact blockers; publish rejects incomplete episodes.

### Protocol tests

- Unauthenticated `/mcp` requests receive a correct OAuth challenge.
- OAuth protected-resource metadata identifies the Supabase authorization server.
- An MCP client can initialize, list tools, and call tools over Streamable HTTP.
- Revoked or expired user access is rejected.
- The full agent journey succeeds from draft creation through publication.

### Verification before delivery

- Run unit and integration tests, lint, TypeScript checks, Next.js production build, and MCP production build.
- Run Supabase security advisors after any policy or schema change.
- Execute an authenticated smoke test against the configured Supabase project using a temporary user, then remove that test user and assets.
- Confirm the repository contains no access tokens, OpenAI keys, Supabase secret keys, generated private media, or local environment files.
- Commit and push verified work directly to `main`, matching the creator's requested branch workflow.

## Scope boundaries

- This phase builds the remote MCP server, shared server services, OAuth consent UI, connected-agent revocation UI, tests, and deployment configuration.
- It preserves the existing five-step Studio design and published episode library.
- It does not introduce billing, team accounts, moderation dashboards, arbitrary custom voices, music uploads through MCP, or destructive episode deletion.
- Narration and background music continue to preview together without rendering a permanently mixed master file. A separate media-rendering pipeline can be added later without changing MCP authentication or episode ownership.

## External configuration gate

Supabase OAuth 2.1 server settings are control-plane configuration rather than repository code. After the public Studio/MCP origin is known, the project owner must enable OAuth 2.1, set the Studio Site URL and `/oauth/consent` authorization path, enable dynamic client registration, and use asymmetric signing keys. The implementation and documentation will make these exact values explicit; no source-code redesign is required at that stage.
