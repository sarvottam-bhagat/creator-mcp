import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
  listGrants: vi.fn().mockResolvedValue({
    data: [{
      client: { id: 'cursor-client-id', name: 'Cursor', uri: 'https://cursor.com', logo_uri: '' },
      scopes: ['openid', 'email'],
      granted_at: '2026-07-25T12:00:00.000Z',
    }],
    error: null,
  }),
  revokeGrant: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      oauth: { listGrants: mocks.listGrants, revokeGrant: mocks.revokeGrant },
    },
  },
}));

import ConnectionsPage from '../app/studio/connections/page';

it('lists and revokes a connected agent after confirmation', async () => {
  render(<ConnectionsPage />);

  expect(await screen.findByText('Cursor')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /revoke cursor/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirm revoke/i }));

  await waitFor(() => {
    expect(mocks.revokeGrant).toHaveBeenCalledWith({ clientId: 'cursor-client-id' });
  });
});
