'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase/client';

type OAuthGrant = {
  client: { id: string; name: string; uri: string; logo_uri: string };
  scopes: string[];
  granted_at: string;
};

export default function ConnectionsPage() {
  const [grants, setGrants] = useState<OAuthGrant[]>([]);
  const [message, setMessage] = useState('Loading connected agents…');
  const [pendingClient, setPendingClient] = useState<string | null>(null);

  async function loadGrants() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage('Sign in to manage connected agents.');
      return;
    }
    const { data, error } = await supabase.auth.oauth.listGrants();
    if (error) {
      setMessage(error.message);
      return;
    }
    setGrants((data ?? []) as OAuthGrant[]);
    setMessage(data?.length ? 'These AI clients can act on your EchoFM Studio account.' : 'No AI clients are connected yet.');
  }

  useEffect(() => { void loadGrants(); }, []);

  async function revoke(clientId: string) {
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (error) {
      setMessage(error.message);
      return;
    }
    setPendingClient(null);
    setMessage('Agent access revoked.');
    await loadGrants();
  }

  return (
    <>
      <TopBar userName="Creator" />
      <main className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-8">
        <div className="border-b border-fm-divider pb-7">
          <Link href="/studio" className="text-xs text-fm-tertiary hover:text-fm-primary">← Back to Studio</Link>
          <p className="mt-5 text-xs font-medium tracking-[0.18em] text-fm-red uppercase">Studio security</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fm-primary">Connected agents</h1>
          <p className="mt-2 text-sm text-fm-tertiary">{message}</p>
        </div>

        <section className="mt-8 grid gap-4">
          {grants.map((grant) => (
            <article key={grant.client.id} className="rounded-2xl border border-fm-divider bg-fm-surface p-5 sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-fm-primary">{grant.client.name}</h2>
                <p className="mt-1 text-xs text-fm-tertiary">Connected {new Date(grant.granted_at).toLocaleDateString()} · {grant.scopes.join(', ')}</p>
              </div>
              {pendingClient === grant.client.id ? (
                <div className="mt-4 flex gap-2 sm:mt-0">
                  <button onClick={() => void revoke(grant.client.id)} className="rounded-full bg-fm-red px-4 py-2 text-sm font-semibold text-white">Confirm revoke</button>
                  <button onClick={() => setPendingClient(null)} className="rounded-full border border-fm-border px-4 py-2 text-sm text-fm-secondary">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setPendingClient(grant.client.id)} className="mt-4 rounded-full border border-fm-border px-4 py-2 text-sm text-fm-secondary sm:mt-0">Revoke {grant.client.name}</button>
              )}
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
