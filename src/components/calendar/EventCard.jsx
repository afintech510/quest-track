import { Calendar } from 'lucide-react';

export default function EventCard({ event, kids }) {
  const kid = event.kid_id ? kids.find(k => k.id === event.kid_id) : null;

  const colorClass = kid
    ? kid.name === 'Quinn'
      ? 'border-amber-400 bg-amber-400/10'
      : 'border-purple-400 bg-purple-400/10'
    : 'border-emerald-400 bg-emerald-400/10';

  const badgeClass = kid
    ? kid.name === 'Quinn'
      ? 'bg-amber-400/20 text-amber-400'
      : 'bg-purple-400/20 text-purple-400'
    : 'bg-emerald-400/20 text-emerald-400';

  const time = event.start_time
    ? new Date(event.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      })
    : null;

  return (
    <div className={`tv-focusable border-l-4 rounded-lg p-3 ${colorClass}`}>
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <p className="font-fredoka text-sm text-white flex-1 truncate">{event.title}</p>
        {(kid || !event.kid_id) && (
          <span className={`text-[10px] font-quicksand px-2 py-0.5 rounded-full ${badgeClass}`}>
            {kid ? kid.name : 'Family'}
          </span>
        )}
      </div>
      {time && (
        <p className="font-quicksand text-xs text-slate-400 mt-1 ml-6">{time}</p>
      )}
      {event.description && (
        <p className="font-quicksand text-xs text-slate-500 mt-1 ml-6 truncate">{event.description}</p>
      )}
    </div>
  );
}
