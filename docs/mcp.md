# EchoFM remote MCP server

EchoFM exposes a remote Streamable HTTP MCP endpoint at `https://<mcp-app-url>/mcp`.
It uses Supabase OAuth 2.1, so every agent connects as the EchoFM user who approves it.
The server only uses that user's bearer token; the existing database row-level security keeps drafts, episodes, and generated assets private to that account.

## What agents can do

Agents can list the available voices, music, series and episodes; create and update drafts; select a voice and music track; generate narration and a thumbnail; review the signed previews; and publish an episode only with an explicit `publish_episode` call.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. In Supabase Dashboard, enable **Authentication → OAuth Server** and configure the consent path as `/oauth/consent` on the deployed Studio site URL.
3. Start the Studio with `npm run dev` and the MCP service with `npm run mcp:dev`.
4. Set `MCP_PUBLIC_URL` to the public MCP URL. OAuth clients cannot complete a localhost callback unless their client supports it.

The consent page is `/oauth/consent`. Users can later view or revoke client grants from **Studio → Connected agents**.

## Deploy on Databricks Apps

This repository's `app.yaml` starts the MCP process on the Databricks Apps port. Build the server before deployment:

```bash
npm ci
npm run mcp:build
databricks apps create echofm-mcp
databricks sync . /Workspace/Users/<you>/echofm-mcp
databricks apps deploy echofm-mcp --source-code-path /Workspace/Users/<you>/echofm-mcp
```

Set the four values referenced by `app.yaml` (`mcp_public_url`, `supabase_url`, `supabase_publishable_key`, and `openai_api_key`) as Databricks App configuration/secrets. `mcp_public_url` must be the final Databricks Apps URL with `/mcp` appended.

Deploy the Next.js Studio as its own web application. It needs the same Supabase URL and publishable key, plus the OpenAI key for generation. Configure the Supabase OAuth Server only after both public URLs are known.

## Connect an agent

Add this URL to a client that supports remote MCP with OAuth:

```text
https://<mcp-app-url>/mcp
```

The client opens EchoFM's consent screen. After the user signs in and allows access, the client receives a user-scoped access token and can operate that user's Studio. Do not copy OpenAI or Supabase secret keys into a client configuration.

For diagnostics, `GET /health` is public. `POST /mcp` requires a bearer token and advertises its protected-resource metadata at `/.well-known/oauth-protected-resource/mcp`.
