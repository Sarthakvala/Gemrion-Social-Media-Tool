'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setState('error');
      setMessage(error.message);
    } else {
      const next = new URLSearchParams(window.location.search).get('next') || '/';
      router.push(next);
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    const supabase = createClient();

    const next = new URLSearchParams(window.location.search).get('next') || '/';
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setState('error');
      setMessage(error.message);
    } else {
      setState('sent');
    }
  }

  return (
    <main className="flex-1 grid place-items-center px-5 py-16">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2 mb-7">
          <span className="w-[9px] h-[9px] rounded-full bg-accent" />
          <span className="mono font-semibold tracking-tight">AGENCYFLOW</span>
        </div>

        <h1 className="text-[26px] font-semibold tracking-tight leading-tight">
          Sign in
        </h1>
        <p className="text-muted mt-1.5 mb-6 text-[13.5px]">
          {mode === 'password'
            ? 'Enter your email and password.'
            : 'We email you a link. No password to remember or lose.'}
        </p>

        {state === 'sent' ? (
          <div className="panel p-5">
            <div className="lbl mb-2">Check your email</div>
            <p className="text-[13.5px] text-ink-2">
              A sign-in link is on its way to <b>{email}</b>. It expires in an hour.
            </p>
            <button
              className="btn btn-ghost btn-sm mt-4"
              onClick={() => { setState('idle'); setEmail(''); }}
            >
              Use a different email
            </button>
          </div>
        ) : mode === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="panel p-5">
            <label className="lbl block mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />

            <label className="lbl block mb-1.5 mt-3" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />

            <button
              type="submit"
              className="btn btn-accent w-full justify-center mt-4"
              disabled={state === 'loading' || !email.trim() || !password}
            >
              {state === 'loading' ? 'Signing in...' : 'Sign in'}
            </button>

            {state === 'error' && (
              <p className="text-failed text-[12.5px] mt-3">{message}</p>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm w-full justify-center mt-3"
              onClick={() => { setMode('magic'); setState('idle'); setMessage(''); }}
            >
              Use magic link instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="panel p-5">
            <label className="lbl block mb-1.5" htmlFor="email-magic">
              Work email
            </label>
            <input
              id="email-magic"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <button
              type="submit"
              className="btn btn-accent w-full justify-center mt-3"
              disabled={state === 'loading' || !email.trim()}
            >
              {state === 'loading' ? 'Sending...' : 'Email me a link'}
            </button>

            {state === 'error' && (
              <p className="text-failed text-[12.5px] mt-3">{message}</p>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm w-full justify-center mt-3"
              onClick={() => { setMode('password'); setState('idle'); setMessage(''); }}
            >
              Use password instead
            </button>
          </form>
        )}

        <p className="mono text-faint mt-5 leading-relaxed">
          Agency staff land on the console. Clients land on their own portal.
        </p>
      </div>
    </main>
  );
}
