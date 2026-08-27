import { useEffect, useState } from 'react';
import { useCallStore } from '@/stores/callStore';

export function formatCallDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useCallDuration(): string | null {
  const connectedAt = useCallStore((state) => state.connectedAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!connectedAt) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [connectedAt]);

  return connectedAt ? formatCallDuration(now - connectedAt) : null;
}
