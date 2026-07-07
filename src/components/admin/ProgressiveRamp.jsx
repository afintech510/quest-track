import { useState, useEffect, useMemo } from 'react';
import useDeviceType from '../../hooks/useDeviceType';
import { useToast } from '../layout/Toast';
import { FAMILY_ID } from '../../lib/constants';
import defaultChores from '../../data/defaultChoreBank.json';
import { TrendingUp, Plus, Loader2 } from 'lucide-react';

export default function ProgressiveRamp({ supabase, kids, choreEvents }) {
  const deviceType = useDeviceType();
  const { showToast } = useToast();
  const [completionRates, setCompletionRates] = useState([]);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('weekly_completion_rate').select('*').then(({ data }) => {
      if (data) setCompletionRates(data);
    });
  }, [supabase, choreEvents]);

  const activeChores = useMemo(() => {
    const titles = new Set();
    for (const event of choreEvents || []) {
      const def = event.chore_definitions;
      if (def && !def.deleted_at && def.is_active) {
        titles.add(def.title.toLowerCase());
      }
    }
    return titles;
  }, [choreEvents]);

  const readyKids = completionRates.filter(r => r.completion_pct >= 80);

  if (deviceType === 'tv' || readyKids.length === 0) return null;

  const suggestions = defaultChores
    .filter(c => !activeChores.has(c.title.toLowerCase()))
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  const handleQuickAdd = async (chore) => {
    setAdding(chore.title);
    try {
      const { error } = await supabase.functions.invoke('create-chore', {
        body: { family_id: FAMILY_ID, ...chore },
      });
      if (error) throw error;
      showToast(`Added "${chore.title}"!`, 'success');
    } catch {
      showToast('Failed to add chore', 'error');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={18} className="text-emerald-400" />
        <h3 className="font-fredoka text-base text-emerald-400">Ready to Grow!</h3>
      </div>

      <div className="space-y-2 mb-3">
        {readyKids.map(kid => (
          <p key={kid.kid_id} className="font-quicksand text-sm text-slate-300">
            <span className="text-emerald-400 font-bold">{kid.name}</span> — {kid.completion_pct}% this week
          </p>
        ))}
      </div>

      {suggestions.length > 0 && (
        <>
          <p className="font-quicksand text-xs text-slate-400 mb-2">Try adding a new chore:</p>
          <div className="space-y-2">
            {suggestions.map(chore => (
              <div key={chore.title} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-2">
                <span className="text-lg">{chore.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-quicksand text-sm text-white truncate">{chore.title}</p>
                  <p className="font-quicksand text-xs text-slate-500">{chore.frequency} · {chore.coin_reward} coins</p>
                </div>
                <button
                  className="shrink-0 w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-colors"
                  onClick={() => handleQuickAdd(chore)}
                  disabled={adding === chore.title}
                >
                  {adding === chore.title
                    ? <Loader2 size={14} className="text-white animate-spin" />
                    : <Plus size={14} className="text-white" />
                  }
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
