'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase/client';

export default function ProfilePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState('Checking your account…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAccountEmail(user.email ?? 'Google account');
        setNotice('You are signed in. Your Studio drafts and connected agents are private to this account.');
      } else {
        setNotice('Sign in to create and manage your private Studio episodes.');
      }
    }
    void loadAccount();
  }, []);

  async function signInWithGoogle() {
    setBusy(true);
    setNotice('Opening Google sign-in…');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/profile` },
    });
    if (error) {
      setNotice(error.message);
      setBusy(false);
    }
  }

  async function signIn() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) setNotice(error?.message ?? 'Could not sign in.');
    else window.location.reload();
    setBusy(false);
  }

  async function signUp() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setNotice(error.message);
    else if (data.session) window.location.reload();
    else setNotice('Account created. Confirm your email, then return here to sign in.');
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) setNotice(error.message);
    else {
      setAccountEmail(null);
      setNotice('Signed out. Sign in to access your Studio.');
    }
    setBusy(false);
  }

  return (
    <>
      <TopBar userName="Profile" />
      <main className="mx-auto flex min-h-[76vh] w-full max-w-3xl items-center px-5 py-12 sm:px-8">
        <section className="w-full rounded-3xl border border-fm-divider bg-fm-surface p-6 sm:p-10">
          <p className="text-xs font-medium tracking-[0.18em] text-fm-red uppercase">Creator profile</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fm-primary">Your EchoFM account</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-fm-tertiary">{notice}</p>

          {accountEmail ? (
            <div className="mt-8 rounded-2xl border border-fm-border bg-black/15 p-5">
              <p className="text-xs tracking-[0.14em] text-fm-tertiary uppercase">Signed in as</p>
              <p className="mt-2 break-all text-lg font-medium text-fm-primary">{accountEmail}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/studio" className="rounded-full bg-fm-red px-5 py-3 text-sm font-semibold text-white">Open Studio</Link>
                <button onClick={() => void signOut()} disabled={busy} className="rounded-full border border-fm-border px-5 py-3 text-sm font-semibold text-fm-secondary disabled:opacity-50">Sign out</button>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid max-w-md gap-4">
              <button onClick={() => void signInWithGoogle()} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"><span className="text-base" aria-hidden="true">G</span>Continue with Google</button>
              <div className="flex items-center gap-3 text-xs text-fm-tertiary before:h-px before:flex-1 before:bg-fm-divider after:h-px after:flex-1 after:bg-fm-divider">or use email</div>
              <label className="text-sm text-fm-secondary">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="mt-2 h-11 w-full rounded-xl border border-fm-border bg-black/20 px-3 text-fm-primary outline-none focus:border-fm-border-bright" /></label>
              <label className="text-sm text-fm-secondary">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Password" className="mt-2 h-11 w-full rounded-xl border border-fm-border bg-black/20 px-3 text-fm-primary outline-none focus:border-fm-border-bright" /></label>
              <div className="flex flex-wrap gap-3"><button onClick={() => void signIn()} disabled={busy || !email || !password} className="rounded-full bg-fm-red px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Sign in</button><button onClick={() => void signUp()} disabled={busy || !email || !password} className="rounded-full border border-fm-border px-5 py-3 text-sm font-semibold text-fm-secondary disabled:opacity-50">Create account</button></div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
