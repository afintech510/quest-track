import { useRef, useState } from 'react';
import { useDebouncedAction } from '../../hooks/useDebounce';
import { fireConfetti } from '../shared/ConfettiCanvas';
import { Check, Clock, X, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
  reset: { icon: null, label: '', style: 'border-slate-600 hover:border-slate-400' },
  completed: { icon: Check, label: 'Done!', style: 'border-emerald-500 bg-emerald-500/10' },
  pending_approval: { icon: Clock, label: 'Waiting for review', style: 'border-amber-500 bg-amber-500/10' },
  approved: { icon: Check, label: 'Approved!', style: 'border-amber-400 bg-amber-400/10' },
  rejected: { icon: X, label: 'Not approved', style: 'border-red-500 bg-red-500/10' },
};

export default function ChoreCard({ chore, event, onComplete, isMonthly }) {
  const cardRef = useRef(null);
  const [completing, setCompleting] = useState(false);
  const status = event?.status || 'reset';
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const handleComplete = useDebouncedAction(async () => {
    if (status !== 'reset' || completing || !event) return;
    setCompleting(true);
    try {
      const result = await onComplete(event.id);
      if (result?.status === 'success') {
        fireConfetti(cardRef.current);
      }
    } finally {
      setCompleting(false);
    }
  }, 1000);

  const canComplete = status === 'reset' && !completing;

  return (
    <div
      ref={cardRef}
      className={`tv-focusable relative border-2 rounded-xl p-4 transition-all ${config.style} ${
        isMonthly ? 'border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-transparent' : ''
      } ${canComplete ? 'cursor-pointer' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && canComplete) handleComplete(); }}
      onClick={() => { if (canComplete) handleComplete(); }}
    >
      {isMonthly && (
        <span className="absolute top-2 right-2 text-[10px] font-fredoka uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
          Epic
        </span>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0 ${
          status === 'approved' ? 'bg-amber-400/20' :
          status === 'completed' ? 'bg-emerald-500/20' :
          status === 'rejected' ? 'bg-red-500/20' :
          'bg-slate-700'
        }`}>
          {completing ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : StatusIcon ? (
            <StatusIcon size={16} className={
              status === 'approved' ? 'text-amber-400' :
              status === 'completed' ? 'text-emerald-400' :
              status === 'rejected' ? 'text-red-400' :
              'text-slate-400'
            } />
          ) : (
            <span className="text-base">{chore.icon || '⚔️'}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-fredoka text-sm truncate ${
            status === 'reset' ? 'text-white' : 'text-slate-400'
          }`}>
            {chore.title}
          </p>
          {config.label && (
            <p className="font-quicksand text-xs text-slate-500 mt-0.5">{config.label}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-quicksand text-xs text-amber-400">+{chore.coin_reward}🪙</span>
          <span className="font-quicksand text-xs text-cyan-400">+{chore.xp_reward}⭐</span>
        </div>
      </div>
    </div>
  );
}
