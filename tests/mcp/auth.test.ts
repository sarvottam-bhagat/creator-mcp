import { describe, expect, it, vi } from 'vitest';

import { authenticateBearer, protectedResourceMetadata } from '../../mcp/auth';

describe('MCP authentication', () => {
  it('rejects a missing bearer token', async () => {
    await expect(authenticateBearer(undefined, vi.fn())).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });

  it('returns the verified user and original token', async () => {
    const verify = vi.fn().mockResolvedValue({ id: 'user-1' });

    await expect(authenticateBearer('Bearer signed-token', verify)).resolves.toEqual({
      userId: 'user-1',
      token: 'signed-token',
    });
    expect(verify).toHaveBeenCalledWith('signed-token');
  });

  it('maps failed verification to an unauthorized error', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('internal auth detail'));

    await expect(authenticateBearer('Bearer invalid', verify)).rejects.toMatchObject({
      code: 'unauthorized',
      message: 'Your EchoFM authorization is invalid or expired.',
    });
  });

  it('advertises the Supabase authorization server', () => {
    expect(
      protectedResourceMetadata('https://echo.example/mcp', 'https://project.supabase.co'),
    ).toEqual({
      resource: 'https://echo.example/mcp',
      authorization_servers: ['https://project.supabase.co/auth/v1'],
      bearer_methods_supported: ['header'],
    });
  });
});
