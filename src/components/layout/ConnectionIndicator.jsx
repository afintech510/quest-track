import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const STATUS_CONFIG = {
  online: { icon: Wifi, color: 'text-emerald-400', label: 'Online' },
  offline: { icon: WifiOff, color: 'text-red-400', label: 'Offline' },
  syncing: { icon: RefreshCw, color: 'text-amber-400', label: 'Syncing' },
};

export default function ConnectionIndicator({ status, pendingCount = 0 }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.online;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 ${config.color}`}>
      <Icon size={16} className={status === 'syncing' ? 'animate-spin' : ''} />
      <span className="font-quicksand text-xs">
        {config.label}
        {pendingCount > 0 && ` (${pendingCount})`}
      </span>
    </div>
  );
}
