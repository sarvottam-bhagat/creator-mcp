// @vitest-environment node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMcpHttpApp } from '../../mcp/http';
import type { StudioContext } from '../../lib/server/studio/context';

describe('MCP HTTP application', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    const app = createMcpHttpApp(
      {
        supabaseUrl: 'https://project.supabase.co',
        supabaseKey: 'sb_publishable_test',
        openaiKey: 'test-openai-key',
        publicUrl: 'https://echo.example/mcp',
        port: 8787,
      },
      {
        verifyToken: vi.fn().mockResolvedValue({
          user: { id: 'user-1' },
          expiresAt: Math.floor(Date.now() / 1_000) + 3_600,
        } as StudioContext),
        createServer: () => {
          const mcp = new McpServer({ name: 'test-echofm', version: '1.0.0' });
          mcp.registerTool('ping', { inputSchema: {} }, async () => ({
            content: [{ type: 'text', text: 'pong' }],
          }));
          return mcp;
        },
      },
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('returns a bearer challenge for unauthenticated requests', async () => {
    const response = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('serves protected-resource metadata at standard discovery paths', async () => {
    const response = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: 'https://echo.example/mcp',
      authorization_servers: ['https://project.supabase.co/auth/v1'],
    });
  });

  it('initializes and lists tools over authenticated Streamable HTTP', async () => {
    const client = new Client({ name: 'http-test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      requestInit: { headers: { Authorization: 'Bearer signed-token' } },
    });

    await client.connect(transport);
    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name)).toContain('ping');
    await client.close();
  });
});
