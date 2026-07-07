import { useState, useEffect } from 'react';
import { getPendingCount } from '../lib/offlineCache';

export default function useConnectionHealth(isOnline, systemState) {
  const [status, setStatus] = useState('online');
  const [isStaleReset, setIsStaleReset] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setStatus('offline');
      return;
    }

    getPendingCount().then(count => {
      setStatus(count > 0 ? 'syncing' : 'online');
    });
  }, [isOnline]);

  useEffect(() => {
    if (!systemState?.last_daily_reset) return;
    const lastReset = new Date(systemState.last_daily_reset);
    const hoursAgo = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60);
    setIsStaleReset(hoursAgo > 26);
  }, [systemState]);

  return { status, isStaleReset };
}
