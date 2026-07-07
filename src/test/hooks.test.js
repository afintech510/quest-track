import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDebounce, { useDebouncedAction } from '../hooks/useDebounce';
import { EARLY_BIRD_START_HOUR, EARLY_BIRD_END_HOUR } from '../lib/constants';

describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  test('updates value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'hello' } }
    );

    rerender({ value: 'world' });
    expect(result.current).toBe('hello');

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('world');
  });

  test('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(150); });

    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe('c');
  });
});

describe('useDebouncedAction', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('first call executes immediately', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedAction(callback, 1000));

    act(() => { result.current('arg1'); });
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  test('second call within delay is suppressed', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedAction(callback, 1000));

    act(() => {
      result.current('first');
      vi.advanceTimersByTime(500);
      result.current('second');
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
  });

  test('call after delay executes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedAction(callback, 1000));

    act(() => {
      result.current('first');
      vi.advanceTimersByTime(1001);
      result.current('second');
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });
});

describe('clockService constants', () => {
  test('Early Bird window starts at hour 5 (5 AM ET)', () => {
    expect(EARLY_BIRD_START_HOUR).toBe(5);
  });

  test('Early Bird window ends at hour 9 (9 AM ET)', () => {
    expect(EARLY_BIRD_END_HOUR).toBe(9);
  });

  test('Early Bird window spans 4 hours', () => {
    expect(EARLY_BIRD_END_HOUR - EARLY_BIRD_START_HOUR).toBe(4);
  });
});
