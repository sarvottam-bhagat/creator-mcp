'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import TopBar from '@/components/TopBar';
import { redirectBrowser, reloadBrowser } from '@/lib/studio/browser-navigation';
import { supabase } from '@/lib/supabase/client';

type AuthorizationDetails = {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
  scope: string;
};

function ConsentContent() {
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get('authorization_id');
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [state, setState] = useState<'loading' | 'signed-out' | 'ready' | 'submitting' | 'error'>('loading');
  const [message, setMessage] = useState('Checking this authorization request…');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let active = true;
    async function loadAuthorization() {
      if (!authorizationId) {
        setMessage('This authorization request is missing its identifier. Start the connection again from your AI client.');
        setState('error');
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      if (!userData.user) {
        setState('signed-out');
        setMessage('Sign in to choose whether this AI client can access your EchoFM Studio.');
        return;
      }
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error || !data) {
        setMessage(error?.message ?? 'This authorization request is invalid or expired.');
        setState('error');
        return;
      }
      if ('redirect_url' in data) {
        redirectBrowser(data.redirect_url);
        return;
      }
      setDetails(data as AuthorizationDetails);
      setState('ready');
      setMessage('Review the client and approve only if you trust it.');
    }
    void loadAuthorization();
    return () => { active = false; };
  }, [authorizationId]);

  async function signIn() {
    setState('submitting');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setState('signed-out');
      return;
    }
    reloadBrowser();
  }

  async function signInWithGoogle() {
    if (!authorizationId) return;
    setState('submitting');
    const redirectTo = new URL('/oauth/consent', window.location.origin);
    redirectTo.searchParams.set('authorization_id', authorizationId);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.href },
    });
    if (error) {
      setMessage(error.message);
      setState('signed-out');
    }
  }

  async function decide(allow: boolean) {
    if (!authorizationId) return;
    setState('submitting');
    const response = allow
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (response.error || !response.data?.redirect_url) {
      setMessage(response.error?.message ?? 'EchoFM could not complete the authorization decision.');
      setState('error');
      return;
    }
    redirectBrowser(response.data.redirect_url);
  }

  return (
    <>
      <TopBar userName="Creator" />
      <main className="mx-auto flex min-h-[75vh] w-full max-w-3xl items-center px-5 py-12 sm:px-8">
        <section className="w-full rounded-3xl border border-fm-divider bg-fm-surface p-6 sm:p-10">
          <p className="text-xs font-medium tracking-[0.18em] text-fm-red uppercase">EchoFM authorization</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fm-primary">Connect an AI agent</h1>
          <p className="mt-3 text-sm leading-6 text-fm-tertiary">{message}</p>

          {state === 'signed-out' && (
            <div className="mt-8 grid gap-4">
              <button onClick={() => void signInWithGoogle()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-black transition hover:bg-zinc-200"><span className="text-base" aria-hidden="true">G</span>Continue with Google</button>
              <div className="flex items-center gap-3 text-xs text-fm-tertiary before:h-px before:flex-1 before:bg-fm-divider after:h-px after:flex-1 after:bg-fm-divider">or use email</div>
              <label className="text-sm text-fm-secondary">Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-2 h-11 w-full rounded-xl border border-fm-border bg-black/20 px-3 text-fm-primary" />
              </label>
              <label className="text-sm text-fm-secondary">Password
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 h-11 w-full rounded-xl border border-fm-border bg-black/20 px-3 text-fm-primary" />
              </label>
              <button onClick={() => void signIn()} className="mt-2 rounded-full bg-fm-red px-5 py-3 font-semibold text-white">Sign in and continue</button>
            </div>
          )}

          {details && (state === 'ready' || state === 'submitting') && (
            <div className="mt-8">
              <div className="rounded-2xl border border-fm-border bg-black/15 p-5">
                <p className="text-xs tracking-[0.14em] text-fm-tertiary uppercase">Requesting client</p>
                <h2 className="mt-2 text-2xl font-semibold text-fm-primary">{details.client.name}</h2>
                <p className="mt-2 break-all text-xs text-fm-tertiary">{details.redirect_uri}</p>
                <div className="mt-5 border-t border-fm-divider pt-5 text-sm leading-6 text-fm-secondary">
                  This client will be able to create and edit your private drafts, generate narration and thumbnails, review episodes, and publish only when it explicitly confirms publication.
                </div>
                <p className="mt-4 text-xs text-fm-tertiary">Identity scopes: {details.scope.split(' ').join(', ')}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => void decide(true)} disabled={state === 'submitting'} className="rounded-full bg-fm-red px-6 py-3 font-semibold text-white disabled:opacity-50">Allow access</button>
                <button onClick={() => void decide(false)} disabled={state === 'submitting'} className="rounded-full border border-fm-border px-6 py-3 font-semibold text-fm-secondary disabled:opacity-50">Deny</button>
              </div>
            </div>
          )}

          {state === 'loading' && <div className="mt-8 h-24 animate-pulse rounded-2xl bg-white/5" />}
          {state === 'error' && <Link href="/studio" className="mt-7 inline-block text-sm font-medium text-fm-red">Return to Studio</Link>}
        </section>
      </main>
    </>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<main className="p-10 text-fm-secondary">Loading authorization…</main>}>
      <ConsentContent />
    </Suspense>
  );
}
