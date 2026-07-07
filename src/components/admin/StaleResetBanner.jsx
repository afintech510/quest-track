import { AlertTriangle } from 'lucide-react';

export default function StaleResetBanner({ systemState }) {
  if (!systemState?.last_daily_reset) return null;

  const hoursSinceReset = (Date.now() - new Date(systemState.last_daily_reset).getTime()) / (1000 * 60 * 60);
  if (hoursSinceReset <= 26) return null;

  return (
    <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-3 flex items-center gap-3 mb-4">
      <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
      <p className="font-quicksand text-sm text-amber-300">
        Daily reset may have been missed — check WiFi connection.
      </p>
    </div>
  );
}
