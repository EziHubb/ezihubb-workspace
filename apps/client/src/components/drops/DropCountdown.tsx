'use client';
import { useEffect, useState } from 'react';

interface DropCountdownProps {
  launchAt: string;
  productSlug: string;
}

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number }

function getTimeLeft(target: string): TimeLeft {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export function DropCountdown({ launchAt, productSlug }: DropCountdownProps) {
  const [timeLeft, setTimeLeft]     = useState(getTimeLeft(launchAt));
  const [email, setEmail]           = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(launchAt)), 1000);
    return () => clearInterval(timer);
  }, [launchAt]);

  useEffect(() => {
    fetch(`/api/v1/products/${productSlug}/waitlist/count`)
      .then(r => r.json())
      .then(d => setWaitlistCount(d.count))
      .catch(() => {});
  }, [productSlug]);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/v1/products/${productSlug}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSubmitted(true);
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 text-center space-y-4">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
        <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
        Exclusive Drop
      </div>
      <p className="text-sm text-gray-600 font-medium">Launching in</p>
      <div className="flex justify-center gap-3">
        {[
          { label: 'Days',    value: timeLeft.days    },
          { label: 'Hours',   value: timeLeft.hours   },
          { label: 'Minutes', value: timeLeft.minutes },
          { label: 'Seconds', value: timeLeft.seconds },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center">
            <span className="text-3xl font-bold text-purple-800 tabular-nums">{pad(value)}</span>
            <span className="text-xs text-gray-500 mt-0.5">{label}</span>
          </div>
        ))}
      </div>
      {waitlistCount !== null && (
        <p className="text-xs text-gray-500">{waitlistCount} people on waitlist</p>
      )}
      {submitted ? (
        <p className="text-sm font-medium text-green-700">You&apos;re on the waitlist!</p>
      ) : (
        <form onSubmit={handleWaitlist} className="flex gap-2 max-w-xs mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            type="submit"
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Notify Me
          </button>
        </form>
      )}
    </div>
  );
}
