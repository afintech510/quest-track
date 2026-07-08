import { useState, useEffect, useCallback } from 'react';
import { X, Delete } from 'lucide-react';
import { useToast } from '../layout/Toast';
import { PIN_MAX_ATTEMPTS, PIN_LOCKOUT_MINUTES } from '../../lib/constants';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['backspace', '0', 'submit'],
];

export default function ParentPinPad({ onSuccess, onClose }) {
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(PIN_MAX_ATTEMPTS);
  const { showToast } = useToast();

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const submitPin = useCallback(async (pin) => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/verify-pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.status === 200) {
        onSuccess(data.session_token, data.expires_at);
        return;
      }

      if (response.status === 423) {
        setLockoutSeconds(data.seconds_remaining || PIN_LOCKOUT_MINUTES * 60);
        setDigits('');
        return;
      }

      if (response.status === 401) {
        setAttemptsRemaining(data.attempts_remaining ?? PIN_MAX_ATTEMPTS);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        showToast(`Incorrect PIN — ${data.attempts_remaining} attempt${data.attempts_remaining !== 1 ? 's' : ''} remaining`, 'error');
        setDigits('');
        return;
      }

      showToast(data.error || 'PIN verification failed', 'error');
      setDigits('');
    } catch {
      showToast('Could not verify PIN. Check your connection.', 'error');
      setDigits('');
    } finally {
      setLoading(false);
    }
  }, [onSuccess, showToast]);

  const handleKey = useCallback((key) => {
    if (loading || lockoutSeconds > 0) return;

    if (key === 'backspace') {
      setDigits(prev => prev.slice(0, -1));
      return;
    }

    if (key === 'submit') {
      if (digits.length === 4) submitPin(digits);
      return;
    }

    setDigits(prev => {
      const next = prev + key;
      if (next.length === 4) {
        setTimeout(() => submitPin(next), 100);
      }
      return next.length <= 4 ? next : prev;
    });
  }, [loading, lockoutSeconds, digits, submitPin]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      else if (e.key === 'Backspace') handleKey('backspace');
      else if (e.key === 'Enter') handleKey('submit');
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey, onClose]);

  const formatLockout = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className={`bg-surface rounded-2xl p-8 w-full max-w-xs relative ${shake ? 'animate-shake' : ''}`}>
        <button
          className="tv-focusable absolute top-3 right-3 text-slate-400 hover:text-white"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <h2 className="font-fredoka text-xl text-white text-center mb-2">Parent PIN</h2>

        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                i < digits.length ? 'bg-primary' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>

        {isLocked ? (
          <div className="text-center mb-6">
            <p className="font-quicksand text-sm text-red-400 mb-1">Too many attempts. Try again in 5 minutes.</p>
          </div>
        ) : (
          attemptsRemaining < PIN_MAX_ATTEMPTS && (
            <p className="font-quicksand text-xs text-amber-400 text-center mb-4">
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
            </p>
          )
        )}

        <div className="grid grid-cols-3 gap-3">
          {KEYS.flat().map((key) => {
            if (key === 'backspace') {
              return (
                <button
                  key={key}
                  className="tv-focusable flex items-center justify-center h-14 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-fredoka text-lg transition-colors disabled:opacity-30"
                  onClick={() => handleKey('backspace')}
                  disabled={isLocked || loading}
                >
                  <Delete size={20} />
                </button>
              );
            }
            if (key === 'submit') {
              return (
                <button
                  key={key}
                  className="tv-focusable flex items-center justify-center h-14 rounded-xl bg-primary hover:bg-primary/80 text-white font-fredoka text-lg transition-colors disabled:opacity-30"
                  onClick={() => handleKey('submit')}
                  disabled={isLocked || loading || digits.length < 4}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : '✓'}
                </button>
              );
            }
            return (
              <button
                key={key}
                className="tv-focusable flex items-center justify-center h-14 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-fredoka text-lg transition-colors disabled:opacity-30"
                onClick={() => handleKey(key)}
                disabled={isLocked || loading}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
