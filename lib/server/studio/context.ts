import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { StudioError } from './errors';

export type StudioContextConfig = {
  supabaseUrl: string;
  supabaseKey: string;
};

export type StudioContext = {
  accessToken: string;
  expiresAt: number;
  supabase: SupabaseClient;
  user: User;
};

type SupabaseFactory = typeof createClient;

function readTokenExpiration(accessToken: string) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) return payload.exp;
  } catch {
    // The verified token still needs an expiry before it is accepted by the MCP resource server.
  }
  throw new StudioError('unauthorized', 'Your EchoFM authorization is invalid or expired.', 401);
}

export async function createStudioContext(
  accessToken: string,
  config: StudioContextConfig,
  createSupabaseClient: SupabaseFactory = createClient,
): Promise<StudioContext> {
  // Keep token verification separate from the client used for data access.
  // OAuth tokens are not persisted as a Supabase browser session, so the data
  // client must receive the token through `accessToken` on every RLS query.
  const verifier = createSupabaseClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await verifier.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new StudioError(
      'unauthorized',
      'Your EchoFM authorization is invalid or expired.',
      401,
    );
  }

  const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey, {
    accessToken: async () => accessToken,
  });

  return {
    accessToken,
    expiresAt: readTokenExpiration(accessToken),
    supabase,
    user: data.user,
  };
}
