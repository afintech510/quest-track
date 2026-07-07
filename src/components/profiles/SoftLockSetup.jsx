import { useState, useEffect, useCallback } from 'react';
import { SOFT_LOCK_LENGTH } from '../../lib/constants';
import { hashSequence } from './SoftLockModal';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useToast } from '../layout/Toast';

const ARROW_ICONS = {
  ArrowUp: ArrowUp,
  ArrowDown: ArrowDown,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
};

export default function SoftLockSetup({ kid, siblings, supabase, onComplete, onCancel }) {
  const [step, setStep] = useState('enter');
  const [firstSequence, setFirstSequence] = useState([]);
  const [confirmSequence, setConfirmSequence] = useState([]);
  const { showToast } = useToast();

  const activeSequence = step === 'enter' ? firstSequence : confirmSequence;
  const setActiveSequence = step === 'enter' ? setFirstSequence : setConfirmSequence;

  const handleKey = useCallback(async (e) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (e.key === 'Escape') onCancel?.();
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const next = [...activeSequence, e.key];
    setActiveSequence(next);

    if (next.length === SOFT_LOCK_LENGTH) {
      if (step === 'enter') {
        setStep('confirm');
      } else {
        if (next.join('-') !== firstSequence.join('-')) {
          showToast("Codes didn't match — try again!", 'error');
          setFirstSequence([]);
          setConfirmSequence([]);
          setStep('enter');
          return;
        }

        const hash = await hashSequence(next);
        const siblingHashes = (siblings || [])
          .filter(s => s.id !== kid.id)
          .map(s => s.soft_lock_hash);

        if (siblingHashes.includes(hash)) {
          showToast('Choose a different code — that one matches a sibling!', 'error');
          setFirstSequence([]);
          setConfirmSequence([]);
          setStep('enter');
          return;
        }

        const { error } = await supabase
          .from('kids')
          .update({ soft_lock_hash: hash })
          .eq('id', kid.id);

        if (error) {
          showToast('Could not save your code. Try again.', 'error');
        } else {
          showToast('Secret code saved!', 'success');
          onComplete?.(hash);
        }
      }
    }
  }, [activeSequence, step, firstSequence, kid, siblings, supabase, onComplete, onCancel, setActiveSequence, showToast]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleKey]);

  return (
    <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center">
      <div className="bg-surface rounded-3xl p-10 text-center max-w-sm">
        <p className="font-fredoka text-2xl text-white mb-2">
          {step === 'enter' ? 'Choose Your Secret Code!' : 'Enter It Again to Confirm!'}
        </p>
        <p className="font-quicksand text-slate-400 mb-8">
          Press 3 arrow keys to create your code
        </p>

        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: SOFT_LOCK_LENGTH }).map((_, i) => {
            const key = activeSequence[i];
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

        <div className="flex justify-center gap-4">
          <button
            className="tv-focusable font-quicksand text-sm text-slate-500 hover:text-slate-300"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="tv-focusable font-quicksand text-xs text-slate-600 hover:text-slate-400"
            onClick={onCancel}
          >
            Forgot your code?
          </button>
        </div>
      </div>
    </div>
  );
}
