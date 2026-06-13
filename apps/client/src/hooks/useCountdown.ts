import { useState, useEffect } from 'react';

export function useCountdown(targetDate: Date | string) {
  const target = new Date(targetDate).getTime();
  const [remaining, setRemaining] = useState(Math.max(0, target - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, target - Date.now());
      setRemaining(diff);
      if (diff === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  const hours   = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return { hours, minutes, seconds, expired: remaining === 0 };
}
