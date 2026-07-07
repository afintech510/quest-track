import { useCallback } from 'react';
import { queueMutation } from '../lib/offlineCache';

export default function useEconomy(supabase, activeKid, showToast, triggerLevelUp, refreshData, isOnline) {
  const completeChore = useCallback(async (choreEventId) => {
    if (!activeKid) return null;
    const mutationId = crypto.randomUUID();

    if (!isOnline) {
      await queueMutation({
        mutation_id: mutationId,
        rpc_name: 'complete_chore',
        params: { p_chore_event_id: choreEventId, p_mutation_id: mutationId },
      });
      showToast('Chore saved offline — will sync when connected!', 'info');
      return { status: 'queued' };
    }

    const { data, error } = await supabase.rpc('complete_chore', {
      p_chore_event_id: choreEventId,
      p_mutation_id: mutationId,
    });

    if (error) {
      showToast('Failed to complete chore. Try again!', 'error');
      return null;
    }

    if (data.status === 'already_processed') {
      return data;
    }

    if (data.status === 'invalid_state') {
      showToast('This chore has already been completed!', 'info');
      return data;
    }

    if (data.status === 'success') {
      const parts = [];
      if (data.coins_awarded > 0) parts.push(`+${data.coins_awarded} coins`);
      if (data.xp_awarded > 0) parts.push(`+${data.xp_awarded} XP`);
      showToast(`✨ ${parts.join(', ')}!`, 'gold');

      if (data.leveled_up) {
        triggerLevelUp(activeKid.name, data.level, activeKid.color);
      }

      refreshData();
    }

    return data;
  }, [supabase, activeKid, showToast, triggerLevelUp, refreshData, isOnline]);

  const redeemReward = useCallback(async (rewardId) => {
    if (!activeKid) return null;
    const mutationId = crypto.randomUUID();

    if (!isOnline) {
      await queueMutation({
        mutation_id: mutationId,
        rpc_name: 'redeem_reward',
        params: { p_kid_id: activeKid.id, p_reward_id: rewardId, p_mutation_id: mutationId },
      });
      showToast('Purchase saved offline — will sync when connected!', 'info');
      return { status: 'queued' };
    }

    const { data, error } = await supabase.rpc('redeem_reward', {
      p_kid_id: activeKid.id,
      p_reward_id: rewardId,
      p_mutation_id: mutationId,
    });

    if (error) {
      showToast('Purchase failed. Try again!', 'error');
      return null;
    }

    if (data.status === 'insufficient_coins') {
      const needed = data.cost - data.coins;
      showToast(`Not enough coins! Need ${needed} more.`, 'error');
      return data;
    }

    if (data.status === 'daily_limit_reached') {
      showToast('Limit reached for today!', 'error');
      return data;
    }

    if (data.status === 'success') {
      showToast(`🎉 ${data.reward_title} purchased!`, 'gold');
      refreshData();
    }

    return data;
  }, [supabase, activeKid, showToast, refreshData, isOnline]);

  return { completeChore, redeemReward };
}
