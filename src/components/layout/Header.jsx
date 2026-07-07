import { Lock, LogOut } from 'lucide-react';

export default function Header({ onAdminClick, isAdmin, onExitAdmin }) {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <h1 className="font-fredoka text-2xl font-bold text-primary">
        QuestTrack Academy
      </h1>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            className="tv-focusable flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 px-4 py-2 rounded-xl transition-colors"
            onClick={onExitAdmin}
          >
            <LogOut size={16} />
            <span className="font-quicksand text-sm">Exit Admin</span>
          </button>
        )}
        <button
          className={`tv-focusable flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
            isAdmin
              ? 'bg-primary text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          onClick={onAdminClick}
        >
          <Lock size={16} />
          <span className="font-quicksand text-sm">Admin</span>
        </button>
      </div>
    </header>
  );
}
