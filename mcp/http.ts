import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createStudioContext, type StudioContext } from '../lib/server/studio/context';
import type { McpConfig } from './config';
import { protectedResourceMetadata } from './auth';
import { createEchoFmMcpServer, createEchoFmMcpServices } from './server';

export type McpHttpDependencies = {
  verifyToken(token: string): Promise<StudioContext>;
  createServer(context: StudioContext): McpServer;
};

export function createMcpHttpApp(
  config: McpConfig,
  providedDependencies?: Partial<McpHttpDependencies>,
) {
  const dependencies: McpHttpDependencies = {
    verifyToken: (token) => createStudioContext(token, {
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
    }),
    createServer: (context) => createEchoFmMcpServer(createEchoFmMcpServices(context)),
    ...providedDependencies,
  };
  const publicUrl = new URL(config.publicUrl);
  const metadataUrl = getOAuthProtectedResourceMetadataUrl(publicUrl);
  const metadata = protectedResourceMetadata(config.publicUrl, config.supabaseUrl);
  const app = createMcpExpressApp({
    host: '0.0.0.0',
    allowedHosts: [publicUrl.hostname, 'localhost', '127.0.0.1'],
  });

  const verifier: OAuthTokenVerifier = {
    async verifyAccessToken(token) {
      const context = await dependencies.verifyToken(token);
      return {
        token,
        clientId: 'supabase-oauth',
        scopes: [],
        expiresAt: context.expiresAt,
        extra: { studioContext: context },
      };
    },
  };
  const requireAuth = requireBearerAuth({ verifier, resourceMetadataUrl: metadataUrl });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'echofm-mcp' });
  });
  app.get('/.well-known/oauth-protected-resource', (_request, response) => {
    response.json(metadata);
  });
  app.get('/.well-known/oauth-protected-resource/mcp', (_request, response) => {
    response.json(metadata);
  });

  app.post('/mcp', requireAuth, async (request, response) => {
    const context = request.auth?.extra?.studioContext as StudioContext | undefined;
    if (!context) {
      response.status(401).set('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"`).json({
        error: 'Authentication is required.',
      });
      return;
    }

    const server = dependencies.createServer(context);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch {
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'EchoFM could not process the MCP request.' },
          id: null,
        });
      }
    } finally {
      await transport.close();
      await server.close();
    }
  });

  app.get('/mcp', requireAuth, (_request, response) => {
    response.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'GET is unavailable in stateless mode.' },
      id: null,
    });
  });
  app.delete('/mcp', requireAuth, (_request, response) => {
    response.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'DELETE is unavailable in stateless mode.' },
      id: null,
    });
  });

  return app;
}
