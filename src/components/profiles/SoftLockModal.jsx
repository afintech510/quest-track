import { useState, useEffect, useCallback } from 'react';
import { SOFT_LOCK_LENGTH } from '../../lib/constants';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

const ARROW_ICONS = {
  ArrowUp: ArrowUp,
  ArrowDown: ArrowDown,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
};

async function hashSequence(sequence) {
  const encoder = new TextEncoder();
  const data = encoder.encode(sequence.join('-'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export { hashSequence };

export default function SoftLockModal({ kid, onSuccess, onCancel }) {
  const [sequence, setSequence] = useState([]);
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState('');

  const handleKey = useCallback(async (e) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (e.key === 'Escape') onCancel?.();
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const next = [...sequence, e.key];
    setSequence(next);

    if (next.length === SOFT_LOCK_LENGTH) {
      const hash = await hashSequence(next);
      if (hash === kid.soft_lock_hash) {
        onSuccess?.();
      } else {
        setShaking(true);
        setError('Try again!');
        setTimeout(() => {
          setSequence([]);
          setShaking(false);
          setError('');
        }, 600);
      }
    }
  }, [sequence, kid, onSuccess, onCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleKey]);

  return (
    <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center">
      <div className={`bg-surface rounded-3xl p-10 text-center max-w-sm ${shaking ? 'animate-shake' : ''}`}>
        <p className="font-fredoka text-2xl text-white mb-2">
          {kid.name}'s Secret Code
        </p>
        <p className="font-quicksand text-slate-400 mb-8">
          Enter your 3-button sequence
        </p>

        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: SOFT_LOCK_LENGTH }).map((_, i) => {
            const key = sequence[i];
            const Icon = key ? ARROW_ICONS[key] : null;
            return (
              <div
                key={i}
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                  key
                    ? 'border-primary bg-primary/20'
                    : 'border-slate-600 bg-slate-800'
                }`}
              >
                {Icon && <Icon size={28} className="text-primary" />}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="font-quicksand text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          className="tv-focusable font-quicksand text-sm text-slate-500 hover:text-slate-300"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
