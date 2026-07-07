import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEconomy from '../hooks/useEconomy';
import { DAILY_XP_CAP, XP_PER_LEVEL } from '../lib/constants';

function createMockSupabase(rpcResponse) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcResponse, error: null }),
  };
}

describe('Economy Constants', () => {
  test('daily XP cap is 200', () => {
    expect(DAILY_XP_CAP).toBe(200);
  });

  test('XP per level is 100', () => {
    expect(XP_PER_LEVEL).toBe(100);
  });
});

describe('useEconomy — completeChore', () => {
  let mockSupabase, showToast, triggerLevelUp, refreshData;

  beforeEach(() => {
    showToast = vi.fn();
    triggerLevelUp = vi.fn();
    refreshData = vi.fn();
  });

  test('successful chore completion calls RPC and shows toast', async () => {
    mockSupabase = createMockSupabase({
      status: 'success',
      coins_awarded: 10,
      xp_awarded: 15,
      leveled_up: false,
      level: 3,
    });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    let data;
    await act(async () => {
      data = await result.current.completeChore('event-1');
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_chore', expect.objectContaining({
      p_chore_event_id: 'event-1',
    }));
    expect(data.status).toBe('success');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('+10 coins'), 'gold');
    expect(refreshData).toHaveBeenCalled();
  });

  test('duplicate mutation returns already_processed without toast', async () => {
    mockSupabase = createMockSupabase({ status: 'already_processed' });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    let data;
    await act(async () => {
      data = await result.current.completeChore('event-1');
    });

    expect(data.status).toBe('already_processed');
    expect(showToast).not.toHaveBeenCalled();
  });

  test('invalid_state shows info toast', async () => {
    mockSupabase = createMockSupabase({ status: 'invalid_state' });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    await act(async () => {
      await result.current.completeChore('event-1');
    });

    expect(showToast).toHaveBeenCalledWith('This chore has already been completed!', 'info');
  });

  test('level-up triggers celebration', async () => {
    mockSupabase = createMockSupabase({
      status: 'success',
      coins_awarded: 10,
      xp_awarded: 15,
      leveled_up: true,
      level: 4,
    });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn', color: 'amber' }, showToast, triggerLevelUp, refreshData, true)
    );

    await act(async () => {
      await result.current.completeChore('event-1');
    });

    expect(triggerLevelUp).toHaveBeenCalledWith('Quinn', 4, 'amber');
  });

  test('RPC error shows error toast and returns null', async () => {
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'Server error' } }),
    };

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    let data;
    await act(async () => {
      data = await result.current.completeChore('event-1');
    });

    expect(data).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Failed to complete chore. Try again!', 'error');
  });

  test('offline queues mutation and shows offline toast', async () => {
    mockSupabase = createMockSupabase({});

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, false)
    );

    let data;
    await act(async () => {
      data = await result.current.completeChore('event-1');
    });

    expect(data.status).toBe('queued');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('offline'), 'info');
  });

  test('no active kid returns null without calling RPC', async () => {
    mockSupabase = createMockSupabase({});

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, null, showToast, triggerLevelUp, refreshData, true)
    );

    let data;
    await act(async () => {
      data = await result.current.completeChore('event-1');
    });

    expect(data).toBeNull();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe('useEconomy — redeemReward', () => {
  let mockSupabase, showToast, triggerLevelUp, refreshData;

  beforeEach(() => {
    showToast = vi.fn();
    triggerLevelUp = vi.fn();
    refreshData = vi.fn();
  });

  test('successful purchase shows toast and refreshes', async () => {
    mockSupabase = createMockSupabase({
      status: 'success',
      reward_title: 'Extra Screen Time',
    });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    await act(async () => {
      await result.current.redeemReward('reward-1');
    });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Extra Screen Time'), 'gold');
    expect(refreshData).toHaveBeenCalled();
  });

  test('insufficient coins shows error with deficit', async () => {
    mockSupabase = createMockSupabase({
      status: 'insufficient_coins',
      cost: 50,
      coins: 30,
    });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    await act(async () => {
      await result.current.redeemReward('reward-1');
    });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Need 20 more'), 'error');
  });

  test('daily_limit_reached shows error', async () => {
    mockSupabase = createMockSupabase({ status: 'daily_limit_reached' });

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, true)
    );

    await act(async () => {
      await result.current.redeemReward('reward-1');
    });

    expect(showToast).toHaveBeenCalledWith('Limit reached for today!', 'error');
  });

  test('offline queues mutation', async () => {
    mockSupabase = createMockSupabase({});

    const { result } = renderHook(() =>
      useEconomy(mockSupabase, { id: 'kid1', name: 'Quinn' }, showToast, triggerLevelUp, refreshData, false)
    );

    let data;
    await act(async () => {
      data = await result.current.redeemReward('reward-1');
    });

    expect(data.status).toBe('queued');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
