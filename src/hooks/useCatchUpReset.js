import { useEffect, useRef } from 'react';
import { getCurrentETDate } from '../lib/clockService';
import { FAMILY_ID } from '../lib/constants';

export default function useCatchUpReset(supabase, systemState, refreshData, isOnline) {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!supabase || !isOnline || hasChecked.current) return;
    if (!systemState?.last_daily_reset) return;

    const todayET = getCurrentETDate();
    const lastReset = systemState.last_daily_reset.split('T')[0];

    if (lastReset < todayET) {
      hasChecked.current = true;
      supabase.rpc('perform_daily_reset', {
        p_family_id: FAMILY_ID,
        p_target_date: todayET,
      }).then(({ data }) => {
        if (data?.status === 'success') {
          refreshData();
        }
      });
    }
  }, [supabase, systemState, refreshData, isOnline]);

  useEffect(() => {
    if (!supabase || !isOnline) return;

    const handler = () => {
      if (document.visibilityState !== 'visible') return;
      if (!systemState?.last_daily_reset) return;

      const todayET = getCurrentETDate();
      const lastReset = systemState.last_daily_reset.split('T')[0];

      if (lastReset < todayET) {
        supabase.rpc('perform_daily_reset', {
          p_family_id: FAMILY_ID,
          p_target_date: todayET,
        }).then(({ data }) => {
          if (data?.status === 'success') {
            refreshData();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [supabase, systemState, refreshData, isOnline]);
}
