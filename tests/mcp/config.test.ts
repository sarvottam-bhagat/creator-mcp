import { describe, expect, it } from 'vitest';

import { readMcpConfig } from '../../mcp/config';

describe('readMcpConfig', () => {
  it('requires every server-side setting', () => {
    expect(() => readMcpConfig({})).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('normalizes the public URL and port', () => {
    expect(
      readMcpConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        OPENAI_API_KEY: 'test-openai-key',
        MCP_PUBLIC_URL: 'https://echo.example/mcp/',
        PORT: '8787',
      }),
    ).toMatchObject({
      publicUrl: 'https://echo.example/mcp',
      port: 8787,
    });
  });
});
