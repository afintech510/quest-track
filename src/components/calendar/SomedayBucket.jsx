import { Sparkles } from 'lucide-react';

export default function SomedayBucket({ events, kids }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-400" />
        <h3 className="font-fredoka text-base text-amber-400">Someday</h3>
      </div>
      <div className="space-y-2">
        {events.map(event => {
          const kid = event.kid_id ? kids.find(k => k.id === event.kid_id) : null;
          return (
            <div
              key={event.id}
              className="tv-focusable bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center gap-3"
            >
              <span className="text-lg">✨</span>
              <div className="flex-1 min-w-0">
                <p className="font-fredoka text-sm text-white truncate">{event.title}</p>
                {event.description && (
                  <p className="font-quicksand text-xs text-slate-500 truncate">{event.description}</p>
                )}
              </div>
              {kid && (
                <span className="text-[10px] font-quicksand px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                  {kid.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
