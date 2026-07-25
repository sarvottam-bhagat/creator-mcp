import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
  getAuthorizationDetails: vi.fn().mockResolvedValue({
    data: {
      authorization_id: 'authorization-request',
      redirect_uri: 'http://127.0.0.1/callback',
      client: { id: 'client-1', name: 'Cursor', uri: 'https://cursor.com', logo_uri: '' },
      user: { id: 'user-1', email: 'creator@example.com' },
      scope: 'openid email',
    },
    error: null,
  }),
  approveAuthorization: vi.fn().mockResolvedValue({
    data: { redirect_url: 'http://127.0.0.1/callback?code=approved' }, error: null,
  }),
  denyAuthorization: vi.fn(),
  redirectBrowser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('authorization_id=authorization-request'),
}));

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      oauth: {
        getAuthorizationDetails: mocks.getAuthorizationDetails,
        approveAuthorization: mocks.approveAuthorization,
        denyAuthorization: mocks.denyAuthorization,
      },
    },
  },
}));

vi.mock('../lib/studio/browser-navigation', () => ({
  redirectBrowser: mocks.redirectBrowser,
  reloadBrowser: vi.fn(),
}));

import ConsentPage from '../app/oauth/consent/page';

it('shows the requesting client and approves through Supabase OAuth', async () => {
  render(<ConsentPage />);

  expect(await screen.findByText('Cursor')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /allow access/i }));

  await waitFor(() => {
    expect(mocks.approveAuthorization).toHaveBeenCalledWith(
      'authorization-request',
      { skipBrowserRedirect: true },
    );
    expect(mocks.redirectBrowser).toHaveBeenCalledWith(
      'http://127.0.0.1/callback?code=approved',
    );
  });
});
