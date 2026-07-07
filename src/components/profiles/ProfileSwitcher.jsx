import { useState } from 'react';
import SoftLockModal from './SoftLockModal';
import SoftLockSetup from './SoftLockSetup';

const PROFILES = [
  { key: 'family', label: 'Family Hub', emoji: '🏠', color: 'emerald' },
];

export default function ProfileSwitcher({ kids, activeProfileId, onSelectProfile, supabase }) {
  const [lockState, setLockState] = useState(null);

  const handleSelect = (kid) => {
    if (!kid) {
      onSelectProfile(null, 'family');
      return;
    }

    if (!kid.soft_lock_hash) {
      setLockState({ type: 'setup', kid });
    } else {
      setLockState({ type: 'lock', kid });
    }
  };

  const kidColor = (kid) => {
    const c = kid.color_hex || kid.color || '';
    if (c === '#04D9FF' || kid.color_name === 'teal' || kid.name === 'Quinn') return 'quinn';
    if (c === '#a855f7' || kid.color_name === 'purple' || kid.name === 'Cora') return 'purple';
    return 'primary';
  };

  const colorClasses = {
    quinn: 'border-quinn/50 hover:border-quinn bg-quinn/10',
    purple: 'border-cora/50 hover:border-cora bg-cora/10',
    emerald: 'border-family/50 hover:border-family bg-family/10',
    primary: 'border-primary/50 hover:border-primary bg-primary/10',
  };

  const activeClasses = {
    quinn: 'border-quinn bg-quinn/20 ring-2 ring-quinn',
    purple: 'border-cora bg-cora/20 ring-2 ring-cora',
    emerald: 'border-family bg-family/20 ring-2 ring-family',
    primary: 'border-primary bg-primary/20 ring-2 ring-primary',
  };

  return (
    <>
      <div className="flex justify-center gap-4 mb-8">
        {(kids || []).map(kid => {
          const color = kidColor(kid);
          const isActive = activeProfileId === kid.id;
          const emoji = kid.avatar_emoji || (kid.name === 'Quinn' ? '⚾' : kid.name === 'Cora' ? '🦄' : '👤');
          return (
            <button
              key={kid.id}
              className={`tv-focusable rounded-2xl p-5 border-2 transition-all min-w-[140px] ${
                isActive ? activeClasses[color] : colorClasses[color]
              }`}
              onClick={() => handleSelect(kid)}
            >
              <div className="text-3xl mb-2">{emoji}</div>
              <p className="font-fredoka text-lg text-white">{kid.name}</p>
              <p className="font-quicksand text-xs text-slate-400">Level {kid.level}</p>
            </button>
          );
        })}

        <button
          className={`tv-focusable rounded-2xl p-5 border-2 transition-all min-w-[140px] ${
            activeProfileId === null && activeProfileId !== undefined
              ? activeClasses.emerald
              : colorClasses.emerald
          }`}
          onClick={() => handleSelect(null)}
        >
          <div className="text-3xl mb-2">🏠</div>
          <p className="font-fredoka text-lg text-white">Family Hub</p>
          <p className="font-quicksand text-xs text-slate-400">Calendar & Events</p>
        </button>
      </div>

      {lockState?.type === 'lock' && (
        <SoftLockModal
          kid={lockState.kid}
          onSuccess={() => {
            onSelectProfile(lockState.kid.id, kidColor(lockState.kid));
            setLockState(null);
          }}
          onCancel={() => setLockState(null)}
        />
      )}

      {lockState?.type === 'setup' && (
        <SoftLockSetup
          kid={lockState.kid}
          siblings={kids}
          supabase={supabase}
          onComplete={(hash) => {
            lockState.kid.soft_lock_hash = hash;
            setLockState({ type: 'lock', kid: lockState.kid });
          }}
          onCancel={() => setLockState(null)}
        />
      )}
    </>
  );
}
