# EchoFM Studio Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a secure EchoFM Studio where creators write scripts, select OpenAI voices and music tracks, generate narration and thumbnails, save drafts, and publish episodes.

**Architecture:** Next.js server services own Studio operations. Supabase Auth identifies creators, Postgres persists series and episodes, and private Storage holds generated media. UI calls authenticated route handlers; OpenAI calls remain server-only. Service modules will be reused by Phase 2 MCP tools.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase, OpenAI Node SDK, Vitest, React Testing Library.

---

### Task 1: Install dependencies and test harness

**Files:**
- Modify: package.json, package-lock.json
- Create: vitest.config.ts, tests/setup.ts, tests/studio/publish-readiness.test.ts

- [ ] **Step 1: Write the failing readiness test**

~~~ts
import { expect, it } from 'vitest';
import { getPublishBlockers } from '@/lib/studio/publish';

it('requires all creator choices and generated media before publishing', () => {
  expect(getPublishBlockers({ title: '', script: '', voice: null, musicTrackId: null, narrationPaths: [], thumbnailPath: null }))
    .toEqual(['title', 'script', 'voice', 'music', 'narration', 'thumbnail']);
});
~~~

- [ ] **Step 2: Verify RED**

Run: npm run test -- tests/studio/publish-readiness.test.ts

Expected: FAIL because Vitest and the Studio module do not exist.

- [ ] **Step 3: Add tooling**

Run: npm install @supabase/supabase-js @supabase/ssr openai && npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom

Add test: vitest run to package.json. Configure jsdom, React, the tests/setup.ts file, and the existing @ alias in vitest.config.ts. Put import '@testing-library/jest-dom/vitest'; in setup.

- [ ] **Step 4: Commit**

~~~bash
git add package.json package-lock.json vitest.config.ts tests
git commit -m "test: add Studio test harness"
~~~

### Task 2: Build the secure Supabase contract

**Files:**
- Create: supabase/migrations/20260725120000_create_studio.sql
- Create: supabase/seed.sql

- [ ] **Step 1: Prove schema is absent**

Run against project jordiykrxhzyxdvfaeqf:

~~~sql
select to_regclass('public.episodes') as episodes_table;
~~~

Expected: null.

- [ ] **Step 2: Write and apply the migration**

Create profiles, series, episodes, and music_tracks. Episodes include creator ID, title, number, script, voice, instructions, music track ID, narration paths, thumbnail path, thumbnail prompt, draft/published status, and timestamps.

Enable RLS everywhere. Use TO authenticated ownership policies with (select auth.uid()) = creator_id for profiles, series, and episodes. Make music_tracks authenticated-read only. Create private episode-audio and episode-art buckets with owner-folder SELECT, INSERT, UPDATE, and DELETE policies. Seed six stable music tracks containing title, mood, duration, and preview URL.

- [ ] **Step 3: Verify and commit**

Run:

~~~sql
select tablename from pg_tables where schemaname = 'public'
and tablename in ('profiles', 'series', 'episodes', 'music_tracks') order by tablename;
~~~

Expected: all four rows. Run advisors and correct every migration-related warning.

~~~bash
git add supabase
git commit -m "feat: add Studio Supabase schema"
~~~

### Task 3: Implement typed Studio services

**Files:**
- Create: lib/supabase/client.ts, lib/supabase/server.ts
- Create: lib/studio/types.ts, lib/studio/catalog.ts, lib/studio/publish.ts, lib/studio/episodes.ts
- Create: tests/studio/catalog.test.ts

- [ ] **Step 1: Add a failing voice catalog test**

~~~ts
import { expect, it } from 'vitest';
import { OPENAI_VOICES, isSupportedVoice } from '@/lib/studio/catalog';

it('exposes selectable OpenAI narration voices', () => {
  expect(OPENAI_VOICES).toContain('nova');
  expect(isSupportedVoice('not-a-voice')).toBe(false);
});
~~~

- [ ] **Step 2: Verify RED**

Run: npm run test -- tests/studio/publish-readiness.test.ts tests/studio/catalog.test.ts

Expected: FAIL for missing Studio modules.

- [ ] **Step 3: Implement and verify GREEN**

Export alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, and cedar. Implement getPublishBlockers in documented order. Implement createEpisodeDraft, updateEpisodeScript, setEpisodeVoice, setEpisodeMusic, attachNarration, attachThumbnail, and publishEpisode; each mutation filters by both episode and creator ID.

Run: npm run test -- tests/studio/publish-readiness.test.ts tests/studio/catalog.test.ts

Expected: PASS.

- [ ] **Step 4: Commit**

~~~bash
git add lib tests/studio
git commit -m "feat: add Studio domain services"
~~~

### Task 4: Add secure generation APIs

**Files:**
- Create: app/api/studio/episodes/route.ts
- Create: app/api/studio/episodes/[episodeId]/route.ts
- Create: app/api/studio/episodes/[episodeId]/narration/route.ts
- Create: app/api/studio/episodes/[episodeId]/thumbnail/route.ts
- Create: lib/studio/openai.ts
- Create: tests/studio/request-validation.test.ts

- [ ] **Step 1: Write a failing request test**

~~~ts
import { expect, it } from 'vitest';
import { validateNarrationInput } from '@/lib/studio/openai';

it('rejects an unsupported voice', () => {
  expect(validateNarrationInput({ voice: 'invalid', script: 'Hello' }).ok).toBe(false);
});
~~~

- [ ] **Step 2: Verify RED**

Run: npm run test -- tests/studio/request-validation.test.ts

Expected: FAIL because lib/studio/openai.ts is absent.

- [ ] **Step 3: Implement generation**

Create OpenAI clients in server modules only. Validate inputs and split scripts at sentence boundaries below 4,096 characters. Narration authenticates creator, verifies ownership, calls audio.speech.create with gpt-4o-mini-tts per chunk, uploads MP3s to episode-audio/user-id/episode-id/segment-N.mp3, persists ordered paths, and returns signed previews.

Thumbnail generation verifies ownership, calls images.generate with gpt-image-2 and portrait low-quality output, saves to episode-art/user-id/episode-id/thumbnail.png, and persists its path. Return recoverable validation, rate-limit, moderation, and Storage errors.

- [ ] **Step 4: Verify GREEN and commit**

Run: npm run test -- tests/studio/request-validation.test.ts

Expected: PASS.

~~~bash
git add app/api lib/studio/openai.ts tests/studio/request-validation.test.ts
git commit -m "feat: add Studio generation APIs"
~~~

### Task 5: Build the five-step Studio workspace

**Files:**
- Replace: app/studio/page.tsx
- Create: components/studio/StudioShell.tsx, EpisodeStepper.tsx, ScriptStep.tsx, VoiceStep.tsx, MusicStep.tsx, ThumbnailStep.tsx, ReviewStep.tsx, StudioStatus.tsx, types.ts
- Modify: app/globals.css
- Create: tests/studio/stepper.test.tsx

- [ ] **Step 1: Write the failing interaction test**

~~~tsx
import { fireEvent, render, screen } from '@testing-library/react';
import StudioShell from '@/components/studio/StudioShell';

it('moves from script to voice after valid script input', async () => {
  render(<StudioShell initialEpisodes={[]} initialMusicTracks={[]} />);
  fireEvent.change(screen.getByLabelText('Episode title'), { target: { value: 'The First Signal' } });
  fireEvent.change(screen.getByLabelText('Script'), { target: { value: 'A signal arrived at midnight.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to voice' }));
  expect(await screen.findByRole('heading', { name: 'Choose narration voice' })).toBeInTheDocument();
});
~~~

- [ ] **Step 2: Verify RED**

Run: npm run test -- tests/studio/stepper.test.tsx

Expected: FAIL because StudioShell is absent.

- [ ] **Step 3: Implement and verify GREEN**

Build StudioShell as the client coordinator for active step, current draft, API calls, saving/generation state, and errors. Build focused steps:

- Script: title, number, textarea, counters, save.
- Voice: accessible voice select, delivery instructions, generation, playlist.
- Music: accessible seeded music select and preview.
- Thumbnail: prompt, generate/regenerate, art preview.
- Review: readiness checklist, Save draft, Publish.

Use existing fm design tokens and responsive Tailwind layout. Unauthenticated visitors see a scoped email sign-in panel.

Run: npm run test -- tests/studio/stepper.test.tsx

Expected: PASS.

- [ ] **Step 4: Commit**

~~~bash
git add app/studio app/globals.css components/studio tests/studio/stepper.test.tsx
git commit -m "feat: build Studio episode workflow"
~~~

### Task 6: Document and complete verification

**Files:**
- Create: .env.example
- Modify: README.md

- [ ] **Step 1: Add safe configuration docs**

~~~text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
~~~

Document migration, environment variables, and Studio startup.

- [ ] **Step 2: Run automated checks**

~~~bash
npm run test
npm run lint
npm run build
~~~

Expected: all exit 0.

- [ ] **Step 3: Browser and database verification**

Verify /studio presents Script, Voice, Music, Thumbnail, Review; the voice dropdown has every supported value; the music dropdown has seeded tracks; publish is blocked until ready; a ready draft publishes. Run Supabase advisors and confirm private buckets plus RLS policies.

- [ ] **Step 4: Commit**

~~~bash
git add README.md .env.example
git commit -m "docs: document Studio setup"
~~~

