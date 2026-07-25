# EchoFM Authenticated MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a remote OAuth-authenticated MCP server that performs EchoFM Studio's complete draft-to-publish workflow for the signed-in Supabase user.

**Architecture:** A standalone Node TypeScript process exposes Streamable HTTP at `/mcp`, challenges unauthenticated clients with Supabase OAuth discovery metadata, and forwards each validated user bearer token to Supabase so existing RLS remains authoritative. Shared Studio services own episode persistence, OpenAI generation, Storage uploads, review, and publication; Next.js and MCP both call them.

**Tech Stack:** Next.js 16.2.11, TypeScript 5, React 19, Supabase JS 2.110.8, OpenAI JS 5.23.2, MCP SDK 1.29.0, Express 5.2.1, Zod 4.4.3, Jose 6.2.4, Vitest 3.2.7, Databricks Apps.

---

## File map

- `mcp/config.ts`: validated runtime configuration.
- `mcp/auth.ts`: OAuth protected-resource metadata and bearer validation.
- `mcp/server.ts`: EchoFM MCP tool registration.
- `mcp/http.ts` and `mcp/index.ts`: HTTP application and process entry point.
- `lib/server/studio/`: shared auth, episode, generation, review, and error services.
- `app/oauth/consent/page.tsx`: Supabase OAuth consent UI.
- `app/studio/connections/page.tsx`: list and revoke connected agents.
- `app/.well-known/oauth-protected-resource/route.ts`: OAuth resource discovery.
- `app.yaml`, `.env.example`, and `docs/mcp.md`: deployment and client setup.
- `tests/mcp/` and `tests/studio/`: protocol, ownership, and workflow verification.

### Task 1: Add the pinned MCP runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `mcp/tsconfig.json`
- Create: `mcp/config.ts`
- Test: `tests/mcp/config.test.ts`

- [ ] **Step 1: Write the failing configuration test**

```ts
import { describe, expect, it } from 'vitest';
import { readMcpConfig } from '../../mcp/config';

describe('readMcpConfig', () => {
  it('requires server settings and normalizes the public URL', () => {
    expect(() => readMcpConfig({})).toThrow('NEXT_PUBLIC_SUPABASE_URL');
    expect(readMcpConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      OPENAI_API_KEY: 'test-openai-key',
      MCP_PUBLIC_URL: 'https://echo.example/mcp/', PORT: '8787',
    })).toMatchObject({ publicUrl: 'https://echo.example/mcp', port: 8787 });
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- tests/mcp/config.test.ts`

Expected: FAIL because `mcp/config.ts` does not exist.

- [ ] **Step 3: Install exact dependencies and scripts**

```powershell
npm install --save-exact @modelcontextprotocol/sdk@1.29.0 express@5.2.1 jose@6.2.4 zod@4.4.3
npm install --save-dev --save-exact @types/express@5.0.6 tsx@4.23.1
```

Add `mcp:dev`, `mcp:build`, and `mcp:start` scripts that run `tsx watch mcp/index.ts`, `tsc -p mcp/tsconfig.json`, and `node dist/mcp/mcp/index.js`.

- [ ] **Step 4: Implement configuration**

```ts
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  MCP_PUBLIC_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
});

export function readMcpConfig(env: Record<string, string | undefined>) {
  const value = schema.parse(env);
  return { supabaseUrl: value.NEXT_PUBLIC_SUPABASE_URL, supabaseKey: value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    openaiKey: value.OPENAI_API_KEY, publicUrl: value.MCP_PUBLIC_URL.replace(/\/$/, ''), port: value.PORT };
}
```

- [ ] **Step 5: Pass tests, build, and commit**

```powershell
npm test -- tests/mcp/config.test.ts
npm run mcp:build
git add package.json package-lock.json mcp tests/mcp/config.test.ts
git commit -m "build: add MCP server runtime"
```

Expected: the focused test and MCP TypeScript build pass.

### Task 2: Add user-scoped authentication

**Files:**
- Create: `lib/server/studio/errors.ts`
- Create: `lib/server/studio/context.ts`
- Create: `mcp/auth.ts`
- Test: `tests/mcp/auth.test.ts`

- [ ] **Step 1: Write failing bearer and discovery tests**

```ts
it('rejects a missing bearer token', async () => {
  await expect(authenticateBearer(undefined, vi.fn())).rejects.toMatchObject({ code: 'unauthorized' });
});

it('advertises Supabase Auth', () => {
  expect(protectedResourceMetadata('https://echo.example/mcp', 'https://project.supabase.co'))
    .toEqual({ resource: 'https://echo.example/mcp', authorization_servers: ['https://project.supabase.co/auth/v1'] });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/mcp/auth.test.ts`

Expected: FAIL because the auth modules do not exist.

- [ ] **Step 3: Implement safe errors, user context, and bearer validation**

```ts
export class StudioError extends Error {
  constructor(public code: 'unauthorized' | 'not_found' | 'invalid_input' | 'not_ready' | 'dependency_failed',
    message: string, public status: number) { super(message); }
}

export async function authenticateBearer(header: string | undefined, verify: (token: string) => Promise<{ id: string }>) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new StudioError('unauthorized', 'Authentication is required.', 401);
  const user = await verify(match[1]);
  return { userId: user.id, token: match[1] };
}
```

`createStudioContext(token)` must create Supabase with the publishable key plus the same bearer token, call `auth.getUser(token)`, and return `{ user, supabase }`. It must never create a service-role client.

- [ ] **Step 4: Pass tests and commit**

```powershell
npm test -- tests/mcp/auth.test.ts
git add lib/server/studio/errors.ts lib/server/studio/context.ts mcp/auth.ts tests/mcp/auth.test.ts
git commit -m "feat: authenticate MCP users with Supabase"
```

Expected: missing, invalid, and valid bearer cases plus metadata pass.

### Task 3: Build the shared episode service

**Files:**
- Create: `lib/server/studio/episodes.ts`
- Modify: `lib/studio/publish.ts`
- Test: `tests/studio/episodes.test.ts`
- Test: `tests/studio/publish.test.ts`

- [ ] **Step 1: Write failing ownership and draft tests**

```ts
it('creates MCP episodes as drafts', async () => {
  const episode = await service.createEpisode({ seriesTitle: 'Signals', title: 'First Signal', script: 'At midnight...' });
  expect(episode).toMatchObject({ status: 'draft', published_at: null });
});

it('does not reveal an unowned episode', async () => {
  await expect(service.getEpisode('other-user-episode')).rejects.toMatchObject({ code: 'not_found' });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/studio/episodes.test.ts tests/studio/publish.test.ts`

Expected: FAIL because the episode service is absent.

- [ ] **Step 3: Implement the creator-scoped service**

```ts
export function createEpisodeService(context: StudioContext) {
  return {
    listSeries, listEpisodes, getEpisode, createEpisode, updateEpisode,
    selectVoice, selectMusic, attachNarration, attachThumbnail, publishEpisode,
  };
}
```

`createEpisode` accepts an owned `seriesId` or a `seriesTitle`, explicitly inserts draft state, and returns the inserted row. Queries resolve episodes only through creator-owned series. Mutations reject published rows. `publishEpisode(id, confirm)` rejects false confirmation and reruns `getPublishBlockers` immediately before setting `status` and `published_at`.

- [ ] **Step 4: Pass tests and commit**

```powershell
npm test -- tests/studio/episodes.test.ts tests/studio/publish.test.ts
git add lib/server/studio/episodes.ts lib/studio/publish.ts tests/studio/episodes.test.ts tests/studio/publish.test.ts
git commit -m "feat: share creator episode operations"
```

Expected: draft creation, validation, ownership isolation, and confirmation tests pass.

### Task 4: Share generation and review

**Files:**
- Create: `lib/server/studio/generation.ts`
- Create: `lib/server/studio/review.ts`
- Modify: `app/api/studio/generate/route.ts`
- Test: `tests/studio/generation.test.ts`
- Test: `tests/studio/review.test.ts`

- [ ] **Step 1: Write failing replacement-safety tests**

```ts
it('keeps old narration until all new parts upload', async () => {
  storage.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('failed') });
  await expect(generateNarration(context, 'episode-1', dependencies)).rejects.toMatchObject({ code: 'dependency_failed' });
  expect(episodes.attachNarration).not.toHaveBeenCalled();
  expect(storage.remove).toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/studio/generation.test.ts tests/studio/review.test.ts`

Expected: FAIL because shared generation and review modules do not exist.

- [ ] **Step 3: Implement generation and review contracts**

```ts
export function splitForSpeech(script: string, maxLength = 3900): string[];
export async function generateNarration(context: StudioContext, episodeId: string, deps?: GenerationDependencies): Promise<string[]>;
export async function generateThumbnail(context: StudioContext, episodeId: string, prompt: string, deps?: GenerationDependencies): Promise<string>;
export async function reviewEpisode(context: StudioContext, episodeId: string): Promise<EpisodeReview>;
```

Narration uses stored script/voice, `gpt-4o-mini-tts`, MP3 parts, attempt-specific owner paths, and cleanup after partial failure. Thumbnail uses `gpt-image-2`, low quality, `1024x1024`, and preserves previous art on failure. Review signs owned audio and image paths for 3,600 seconds and returns exact blockers.

- [ ] **Step 4: Refactor the Next route, pass tests, and commit**

```powershell
npm test -- tests/studio/generation.test.ts tests/studio/review.test.ts
npm test
git add lib/server/studio/generation.ts lib/server/studio/review.ts app/api/studio/generate/route.ts tests/studio
git commit -m "refactor: share Studio generation services"
```

Expected: the Next route is a thin authenticated adapter and all tests pass.

### Task 5: Register the complete MCP tools

**Files:**
- Create: `mcp/server.ts`
- Test: `tests/mcp/tools.test.ts`

- [ ] **Step 1: Write the failing tool-list test**

```ts
it('registers the full workflow', async () => {
  const names = (await listTools(server)).map((tool) => tool.name);
  expect(names).toEqual(expect.arrayContaining([
    'list_voices', 'list_music_tracks', 'list_series', 'list_episodes', 'get_episode',
    'create_episode', 'update_episode', 'select_voice', 'select_music',
    'generate_narration', 'generate_thumbnail', 'review_episode',
    'publish_episode', 'list_published_episodes',
  ]));
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- tests/mcp/tools.test.ts`

Expected: FAIL because `mcp/server.ts` does not exist.

- [ ] **Step 3: Implement strict tool schemas and safe responses**

```ts
server.registerTool('publish_episode', {
  inputSchema: { episode_id: z.string().uuid(), confirm: z.literal(true) },
}, async ({ episode_id, confirm }) => toToolResult(await episodes.publishEpisode(episode_id, confirm)));
```

Register every listed tool with Zod input schemas. Return human-readable `content` plus `structuredContent`. Resolve a fresh `StudioContext` for the authenticated request, map `StudioError` to `isError: true`, and never include stack traces or secrets.

- [ ] **Step 4: Pass tests and commit**

```powershell
npm test -- tests/mcp/tools.test.ts
git add mcp/server.ts tests/mcp/tools.test.ts
git commit -m "feat: expose EchoFM Studio MCP tools"
```

Expected: tools list correctly, invalid input is rejected, and publish requires literal confirmation.

### Task 6: Expose Streamable HTTP and OAuth discovery

**Files:**
- Create: `mcp/http.ts`
- Create: `mcp/index.ts`
- Create: `app/.well-known/oauth-protected-resource/route.ts`
- Test: `tests/mcp/http.test.ts`

- [ ] **Step 1: Write failing HTTP contract tests**

```ts
it('challenges unauthenticated MCP requests', async () => {
  const response = await request(app).post('/mcp').send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  expect(response.status).toBe(401);
  expect(response.headers['www-authenticate']).toContain('resource_metadata=');
});

it('serves protected-resource metadata', async () => {
  expect((await request(app).get('/.well-known/oauth-protected-resource')).body.authorization_servers)
    .toEqual(['https://project.supabase.co/auth/v1']);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/mcp/http.test.ts`

Expected: FAIL because the HTTP application is absent.

- [ ] **Step 3: Implement the HTTP process**

```ts
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/.well-known/oauth-protected-resource', (_req, res) => res.json(metadata));
app.all('/mcp', authenticatedMcpHandler);
```

`authenticatedMcpHandler` returns `401` with `WWW-Authenticate: Bearer resource_metadata="<public-origin>/.well-known/oauth-protected-resource"` when no valid token exists. For authenticated calls it creates a request-scoped `McpServer` and `StreamableHTTPServerTransport`, connects them, delegates `handleRequest`, and closes both after stateless requests. `mcp/index.ts` listens on the configured port and closes cleanly on `SIGTERM` and `SIGINT`.

- [ ] **Step 4: Add the matching Next metadata route, pass tests, and commit**

```powershell
npm test -- tests/mcp/http.test.ts
npm run mcp:build
git add mcp/http.ts mcp/index.ts app/.well-known/oauth-protected-resource/route.ts tests/mcp/http.test.ts
git commit -m "feat: serve OAuth protected MCP over HTTP"
```

Expected: discovery, challenge, initialize, tool listing, health, and production build pass.

### Task 7: Add OAuth consent and grant revocation UI

**Files:**
- Create: `app/oauth/consent/page.tsx`
- Create: `app/studio/connections/page.tsx`
- Modify: `app/studio/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/oauth-consent.test.tsx`
- Test: `tests/studio-connections.test.tsx`

- [ ] **Step 1: Read the installed Next.js 16 documentation**

Run: `rg -n "useSearchParams|useRouter|Client Component|Route Handlers" node_modules/next/dist/docs`

Expected: locate and read the relevant current guides before editing routes.

- [ ] **Step 2: Write failing approval and revocation tests**

```tsx
it('approves the displayed OAuth client', async () => {
  render(<ConsentPage />);
  expect(await screen.findByText('Cursor')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /allow access/i }));
  expect(oauth.approveAuthorization).toHaveBeenCalledWith('authorization-request');
});

it('revokes a connected agent', async () => {
  render(<ConnectionsPage />);
  await user.click(await screen.findByRole('button', { name: /revoke cursor/i }));
  expect(oauth.revokeGrant).toHaveBeenCalledWith('cursor-client-id');
});
```

- [ ] **Step 3: Verify the UI tests fail**

Run: `npm test -- tests/oauth-consent.test.tsx tests/studio-connections.test.tsx`

Expected: FAIL because the routes are missing.

- [ ] **Step 4: Implement consent and connections**

```ts
const { data } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
const decision = await supabase.auth.oauth.approveAuthorization(authorizationId);
window.location.assign(decision.data.redirect_url);
```

The consent route preserves `authorization_id` through sign-in, displays client/scopes, supports approve and deny, and redirects only to the URL returned by Supabase. The connections route uses `getUserGrants()` and `revokeGrant(clientId)`. Add a Studio navigation link while preserving the five-step editor.

- [ ] **Step 5: Pass UI checks and commit**

```powershell
npm test -- tests/oauth-consent.test.tsx tests/studio-connections.test.tsx
npm run lint
git add app/oauth app/studio app/globals.css tests/oauth-consent.test.tsx tests/studio-connections.test.tsx
git commit -m "feat: add EchoFM agent authorization UI"
```

Expected: approval, denial, sign-in preservation, grant listing, and revocation pass.

### Task 8: Add Databricks deployment and client documentation

**Files:**
- Create: `app.yaml`
- Create: `.env.example`
- Create: `docs/mcp.md`
- Test: `tests/mcp/deployment.test.ts`

- [ ] **Step 1: Write the failing manifest test**

```ts
it('starts MCP without embedded secrets', () => {
  const manifest = readFileSync('app.yaml', 'utf8');
  expect(manifest).toContain('npm run mcp:start');
  expect(manifest).not.toMatch(/sk-proj-|service_role|sb_secret_/);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- tests/mcp/deployment.test.ts`

Expected: FAIL because deployment files do not exist.

- [ ] **Step 3: Add deployment configuration and documentation**

```yaml
command:
  - npm
  - run
  - mcp:start
```

`.env.example` lists only the five required variable names with empty values. `docs/mcp.md` includes exact local build/start commands, Databricks sync/deploy commands, Supabase Site URL and `/oauth/consent` configuration, OAuth enablement, asymmetric signing keys, dynamic client registration, health verification, and Claude/Cursor/Codex `/mcp` connection examples.

- [ ] **Step 4: Pass safety checks and commit**

```powershell
npm test -- tests/mcp/deployment.test.ts
git grep -n -E "sk-proj-|service_role|sb_secret_" -- ':!package-lock.json' ':!.env.local'
git add app.yaml .env.example docs/mcp.md tests/mcp/deployment.test.ts
git commit -m "docs: add Databricks MCP deployment guide"
```

Expected: deployment test passes and committed files contain no credential values.

### Task 9: Verify the authenticated workflow and push

**Files:**
- Create: `tests/mcp/workflow.test.ts`
- Modify: only files needed to correct failures discovered by this verification

- [ ] **Step 1: Write the full owner-isolation workflow test**

```ts
it('creates and publishes only the authenticated user episode', async () => {
  const created = await tools.createEpisode({ series_title: 'Night Signals', title: 'The Rain Radio', script: shortStory });
  expect(created.status).toBe('draft');
  await tools.selectVoice({ episode_id: created.id, voice: 'coral' });
  await tools.selectMusic({ episode_id: created.id, music_track_id: 'night-drive' });
  await tools.generateNarration({ episode_id: created.id });
  await tools.generateThumbnail({ episode_id: created.id, prompt: 'A rain-lit radio tower at midnight' });
  expect((await tools.reviewEpisode({ episode_id: created.id })).blockers).toEqual([]);
  expect((await tools.publishEpisode({ episode_id: created.id, confirm: true })).status).toBe('published');
  await expect(otherUserTools.getEpisode({ episode_id: created.id })).rejects.toMatchObject({ code: 'not_found' });
});
```

- [ ] **Step 2: Run every automated check**

```powershell
npm test
npm run lint
npm run build
npm run mcp:build
```

Expected: all four commands exit successfully.

- [ ] **Step 3: Run authenticated Supabase smoke verification**

Use temporary verified users and mocked low-cost OpenAI dependencies to initialize MCP, list tools, create and update a draft, confirm it appears through the Studio query, and prove a second user cannot read it. Remove temporary users, rows, and assets after the run.

Expected: only the authenticated owner can see or mutate the episode.

- [ ] **Step 4: Run security and repository checks**

```powershell
git diff --check
git status --short
git grep -n -E "sk-proj-|service_role|sb_secret_" -- ':!package-lock.json' ':!.env.local'
```

Run the Supabase security advisor if policies or schema changed.

Expected: no whitespace errors, unexpected files, advisor findings, or committed secrets.

- [ ] **Step 5: Commit verification and push `main`**

```powershell
git add tests/mcp/workflow.test.ts
git commit -m "test: verify authenticated MCP episode workflow"
git push origin main
```

Expected: `origin/main` contains the complete verified implementation.
