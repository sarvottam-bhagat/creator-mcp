import { describe, expect, it, vi } from 'vitest';

import { createStudioContext } from '../../lib/server/studio/context';

describe('createStudioContext', () => {
  it('creates a Supabase client scoped to the verified bearer token', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'creator@example.com' } },
      error: null,
    });
    const client = { auth: { getUser } };
    const factory = vi.fn().mockReturnValue(client);

    const context = await createStudioContext(
      'signed-token',
      { supabaseUrl: 'https://project.supabase.co', supabaseKey: 'sb_publishable_test' },
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'sb_publishable_test',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer signed-token' } },
      }),
    );
    expect(getUser).toHaveBeenCalledWith('signed-token');
    expect(context.user.id).toBe('user-1');
    expect(context.accessToken).toBe('signed-token');
  });

  it('rejects tokens without a current Supabase user', async () => {
    const factory = vi.fn().mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('expired') }),
      },
    });

    await expect(
      createStudioContext(
        'expired-token',
        { supabaseUrl: 'https://project.supabase.co', supabaseKey: 'sb_publishable_test' },
        factory,
      ),
    ).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
  });
});
