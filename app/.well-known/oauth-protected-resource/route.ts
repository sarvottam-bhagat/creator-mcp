import { protectedResourceMetadata } from '@/mcp/auth';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configuredUrl = process.env.MCP_PUBLIC_URL;
  if (!supabaseUrl) {
    return Response.json({ error: 'OAuth discovery is not configured.' }, { status: 503 });
  }
  const resource = configuredUrl?.replace(/\/$/, '') || new URL('/mcp', request.url).href;
  return Response.json(protectedResourceMetadata(resource, supabaseUrl));
}
