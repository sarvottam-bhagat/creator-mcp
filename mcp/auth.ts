import { StudioError } from '../lib/server/studio/errors';

type VerifyUser = (token: string) => Promise<{ id: string }>;

export async function authenticateBearer(header: string | undefined, verify: VerifyUser) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new StudioError('unauthorized', 'Authentication is required.', 401);
  }

  try {
    const user = await verify(match[1]);
    if (!user.id) throw new Error('Supabase returned no user ID.');
    return { userId: user.id, token: match[1] };
  } catch {
    throw new StudioError(
      'unauthorized',
      'Your EchoFM authorization is invalid or expired.',
      401,
    );
  }
}

export function protectedResourceMetadata(resource: string, supabaseUrl: string) {
  return {
    resource,
    authorization_servers: [`${supabaseUrl.replace(/\/$/, '')}/auth/v1`],
    bearer_methods_supported: ['header'],
  };
}
