import { z } from 'zod';

const mcpConfigSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  MCP_PUBLIC_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
});

export function readMcpConfig(env: Record<string, string | undefined>) {
  const value = mcpConfigSchema.parse(env);

  return {
    supabaseUrl: value.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    openaiKey: value.OPENAI_API_KEY,
    publicUrl: value.MCP_PUBLIC_URL.replace(/\/$/, ''),
    port: value.PORT,
  };
}

export type McpConfig = ReturnType<typeof readMcpConfig>;
