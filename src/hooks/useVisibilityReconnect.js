import { useEffect } from 'react';

export default function useVisibilityReconnect(supabase, onWake) {
  useEffect(() => {
    if (!supabase) return;
    const handler = () => {
      if (document.visibilityState === 'visible') {
        onWake?.();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [supabase, onWake]);
}
