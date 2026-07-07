import { XP_PER_LEVEL } from '../../lib/constants';
import ConnectionIndicator from '../layout/ConnectionIndicator';
import { Star, Coins, Flame, TrendingUp } from 'lucide-react';

export default function HeroStatsHUD({ kid, connectionStatus, pendingCount }) {
  if (!kid) return null;

  const xpProgress = Math.min((kid.xp / XP_PER_LEVEL) * 100, 100);
  const themeColor = kid.color_hex || kid.color || '#f43f5e';

  return (
    <div className="bg-surface rounded-2xl p-6 mb-6 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-fredoka font-bold text-white"
          style={{ backgroundColor: themeColor }}
        >
          {kid.level}
        </div>
        <div>
          <p className="font-fredoka text-lg text-white">{kid.name}</p>
          <p className="font-quicksand text-xs text-slate-400">Level {kid.level}</p>
        </div>
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 mb-1">
          <Star size={14} className="text-amber-400" />
          <span className="font-quicksand text-xs text-slate-400">
            {kid.xp} / {XP_PER_LEVEL} XP
          </span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%`, backgroundColor: themeColor }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Coins size={18} className="text-amber-400" />
        <span className="font-fredoka text-xl text-amber-400">{kid.coins}</span>
      </div>

      <div className="flex items-center gap-2">
        <Flame size={18} className="text-orange-400" />
        <span className="font-quicksand text-sm text-slate-300">{kid.reading_streak || 0}d streak</span>
      </div>

      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-slate-400" />
        <span className="font-quicksand text-sm text-slate-300">
          {kid.daily_xp_earned || 0} / 200 daily XP
        </span>
      </div>

      <ConnectionIndicator status={connectionStatus} pendingCount={pendingCount} />
    </div>
  );
}
