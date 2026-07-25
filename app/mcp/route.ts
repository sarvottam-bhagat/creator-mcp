import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { readMcpConfig } from '@/mcp/config';
import { createStudioContext, type StudioContext } from '@/lib/server/studio/context';
import { createEchoFmMcpServer, createEchoFmMcpServices } from '@/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized(request: Request) {
  const resourceMetadataUrl = new URL('/.well-known/oauth-protected-resource/mcp', request.url).href;
  return Response.json(
    { error: 'invalid_token', error_description: 'Missing or invalid Authorization header' },
    {
      status: 401,
      headers: { 'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"` },
    },
  );
}

async function authenticate(request: Request, context: StudioContext) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return context.accessToken === match[1] ? context : null;
}

async function handle(request: Request) {
  if (request.method !== 'POST') {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32000, message: `${request.method} is unavailable in stateless mode.` }, id: null },
      { status: 405 },
    );
  }

  const config = readMcpConfig(process.env);
  const header = request.headers.get('authorization');
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized(request);

  let context: StudioContext;
  try {
    context = await createStudioContext(token, {
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
    });
  } catch {
    return unauthorized(request);
  }
  if (!await authenticate(request, context)) return unauthorized(request);

  // Vercel functions are stateless. JSON avoids an SSE stream being closed during
  // function cleanup before MCP clients receive the initialize response.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createEchoFmMcpServer(createEchoFmMcpServices(context));
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'EchoFM could not process the MCP request.' }, id: null },
      { status: 500 },
    );
  } finally {
    await transport.close();
    await server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
