'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
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
          We email you a link. No password to remember or lose.
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
        ) : (
          <form onSubmit={sendLink} className="panel p-5">
            <label className="lbl block mb-1.5" htmlFor="email">
              Work email
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
            <button
              type="submit"
              className="btn btn-accent w-full justify-center mt-3"
              disabled={state === 'sending' || !email.trim()}
            >
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>

            {state === 'error' && (
              <p className="text-failed text-[12.5px] mt-3">{message}</p>
            )}
          </form>
        )}

        <p className="mono text-faint mt-5 leading-relaxed">
          Agency staff land on the console. Clients land on their own portal.
        </p>
      </div>
    </main>
  );
}
