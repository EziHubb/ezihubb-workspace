'use client';

import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';

interface DropCountdownProps {
  launchAt:    string;
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
  const [timeLeft, setTimeLeft]           = useState(getTimeLeft(launchAt));
  const [submitted, setSubmitted]         = useState(false);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [joining, setJoining]             = useState(false);

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

  const handleWaitlist = async () => {
    setJoining(true);
    await fetch(`/api/v1/products/${productSlug}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {});
    setSubmitted(true);
    setWaitlistCount(c => (c ?? 0) + 1);
    setJoining(false);
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  const units = [
    { label: 'DAYS',    value: timeLeft.days    },
    { label: 'HRS',     value: timeLeft.hours   },
    { label: 'MIN',     value: timeLeft.minutes },
    { label: 'SEC',     value: timeLeft.seconds, pulse: true },
  ];

  return (
    <div className="space-y-4">
      {/* Countdown units */}
      <div className="flex justify-center gap-2">
        {units.map(({ label, value, pulse }) => (
          <div
            key={label}
            className={`flex flex-col items-center bg-white rounded-xl px-3 py-2.5 min-w-[60px] shadow-sm ${pulse ? 'animate-pulse' : ''}`}
            style={{ border: '1px solid #E8E4DF' }}
          >
            <span className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
              {pad(value)}
            </span>
            <span className="text-[10px] font-medium text-gray-400 mt-1 tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* Waitlist count */}
      {waitlistCount !== null && !submitted && (
        <p className="text-xs text-center text-gray-500">{waitlistCount} people are waiting</p>
      )}

      {/* CTA */}
      {submitted ? (
        <div className="space-y-1.5 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: '#F0FDF4', color: '#2E7D52' }}
          >
            <Check className="w-4 h-4" />
            You&apos;re on the list! We&apos;ll email you when it launches.
          </div>
          {waitlistCount !== null && (
            <p className="text-xs text-gray-500">{waitlistCount} people waiting now</p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleWaitlist}
            disabled={joining}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-gray-900 transition-opacity disabled:opacity-50"
            style={{ background: '#F59E0B' }}
          >
            <Bell className="w-4 h-4" />
            {joining ? 'Joining…' : 'Join the waitlist'}
          </button>
          {waitlistCount !== null && (
            <p className="text-xs text-center text-gray-500">{waitlistCount} people are waiting</p>
          )}
        </div>
      )}
    </div>
  );
}
