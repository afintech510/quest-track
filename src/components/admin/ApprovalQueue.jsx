import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, CheckCheck, Loader2 } from 'lucide-react';
import { useToast } from '../layout/Toast';

export default function ApprovalQueue({ choreEvents, kids, supabase, sessionToken, refreshData }) {
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(new Set());

  const pendingEvents = useMemo(() => {
    return (choreEvents || []).filter(e => e.status === 'pending_approval');
  }, [choreEvents]);

  const parentFetch = async (fnName, body) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
      body: JSON.stringify(body),
    });
    return response.json();
  };

  const handleApprove = async (eventId) => {
    setProcessing(prev => new Set(prev).add(eventId));
    try {
      const data = await parentFetch('approve-chore', { chore_event_id: eventId });
      if (data.status === 'success') {
        showToast('Chore approved!', 'success');
        await refreshData();
      } else {
        showToast(data.message || 'Approval failed', 'error');
      }
    } catch {
      showToast('Could not approve chore', 'error');
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(eventId); return next; });
    }
  };

  const handleReject = async (eventId) => {
    setProcessing(prev => new Set(prev).add(eventId));
    try {
      const data = await parentFetch('reject-chore', { chore_event_id: eventId });
      if (data.status === 'success') {
        showToast(`Chore rejected — ${data.reversed?.coins || 0} coins, ${data.reversed?.xp || 0} XP clawed back`, 'info');
        await refreshData();
      } else {
        showToast(data.message || 'Rejection failed', 'error');
      }
    } catch {
      showToast('Could not reject chore', 'error');
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(eventId); return next; });
    }
  };

  const handleApproveAll = async () => {
    const ids = pendingEvents.map(e => e.id);
    setProcessing(new Set(ids));
    try {
      await Promise.all(ids.map(id => parentFetch('approve-chore', { chore_event_id: id })));
      showToast(`${ids.length} chore${ids.length > 1 ? 's' : ''} approved!`, 'success');
      await refreshData();
    } catch {
      showToast('Some approvals may have failed', 'error');
    } finally {
      setProcessing(new Set());
    }
  };

  if (pendingEvents.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
        <p className="font-fredoka text-base text-white">All caught up!</p>
        <p className="font-quicksand text-sm text-slate-400">No chores need review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-fredoka text-lg text-white">Review Quests</h3>
        <button
          className="tv-focusable flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-quicksand transition-colors disabled:opacity-50"
          onClick={handleApproveAll}
          disabled={processing.size > 0}
        >
          <CheckCheck size={14} />
          Approve All ({pendingEvents.length})
        </button>
      </div>

      <div className="space-y-2">
        {pendingEvents.map(event => {
          const kid = kids?.find(k => k.id === event.kid_id);
          const chore = event.chore_definitions;
          const isProcessing = processing.has(event.id);

          return (
            <div key={event.id} className="bg-slate-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: kid?.color || '#6366f1' }}>
                {kid?.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-quicksand text-sm text-white truncate">
                  {chore?.title || 'Unknown chore'}
                </p>
                <p className="font-quicksand text-xs text-slate-400">
                  {kid?.name} · {event.coins_awarded || 0} coins · {event.xp_awarded || 0} XP
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="tv-focusable p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 transition-colors disabled:opacity-30"
                  onClick={() => handleApprove(event.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                </button>
                <button
                  className="tv-focusable p-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors disabled:opacity-30"
                  onClick={() => handleReject(event.id)}
                  disabled={isProcessing}
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
