'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Status = 'loading' | 'success' | 'invalid' | 'expired';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('No verification token was found in the link.');
      return;
    }

    let cancelled = false;

    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? '';
        if (msg.toLowerCase().includes('expired')) {
          setStatus('expired');
          setMessage('This verification link has expired. Please register again or contact support.');
        } else {
          setStatus('invalid');
          setMessage('The verification link is invalid or has already been used.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-5">
      {status === 'loading' && (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-5xl" aria-hidden="true">🎉</div>
          <h2 className="text-xl font-semibold">Email verified!</h2>
          <p className="text-sm text-muted-foreground">
            Your email address has been confirmed. You can now sign in.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </>
      )}

      {(status === 'invalid' || status === 'expired') && (
        <>
          <div className="text-5xl" aria-hidden="true">
            {status === 'expired' ? '⏰' : '❌'}
          </div>
          <h2 className="text-xl font-semibold">
            {status === 'expired' ? 'Link expired' : 'Invalid link'}
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </>
      )}
    </div>
  );
}
