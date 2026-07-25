import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { StudioError } from './errors';

export type StudioContextConfig = {
  supabaseUrl: string;
  supabaseKey: string;
};

export type StudioContext = {
  accessToken: string;
  supabase: SupabaseClient;
  user: User;
};

type SupabaseFactory = typeof createClient;

export async function createStudioContext(
  accessToken: string,
  config: StudioContextConfig,
  createSupabaseClient: SupabaseFactory = createClient,
): Promise<StudioContext> {
  const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new StudioError(
      'unauthorized',
      'Your EchoFM authorization is invalid or expired.',
      401,
    );
  }

  return {
    accessToken,
    supabase,
    user: data.user,
  };
}
