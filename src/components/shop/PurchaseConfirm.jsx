import { useState, useRef, useCallback } from 'react';
import useDeviceType from '../../hooks/useDeviceType';
import PurchaseProgressIndicator from '../shared/PurchaseProgressIndicator';

const HOLD_DURATION = 2000;
const TICK_INTERVAL = 50;

export default function PurchaseConfirm({ reward, onConfirm, onCancel, kidCoins }) {
  const deviceType = useDeviceType();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef(null);
  const insufficient = kidCoins < reward.cost;

  const startHold = useCallback(() => {
    if (insufficient || holdTimer.current) return;
    holdTimer.current = setInterval(() => {
      setHoldProgress(prev => {
        const next = prev + (100 / (HOLD_DURATION / TICK_INTERVAL));
        if (next >= 100) {
          clearInterval(holdTimer.current);
          holdTimer.current = null;
          onConfirm();
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL);
  }, [insufficient, onConfirm]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-6 max-w-sm w-full text-center">
        <p className="text-4xl mb-3">{reward.icon || '🎁'}</p>
        <p className="font-fredoka text-xl text-white mb-1">{reward.title}</p>
        <p className="font-quicksand text-amber-400 text-lg mb-4">{reward.cost} coins</p>

        {insufficient ? (
          <>
            <p className="font-quicksand text-red-400 text-sm mb-4">
              Not enough coins! Need {reward.cost - kidCoins} more.
            </p>
            <button
              className="tv-focusable bg-slate-700 hover:bg-slate-600 text-white font-fredoka px-6 py-2.5 rounded-xl"
              onClick={onCancel}
            >
              Back
            </button>
          </>
        ) : deviceType === 'tv' ? (
          <div className="space-y-3">
            <p className="font-quicksand text-sm text-slate-400">
              Hold <kbd className="bg-slate-700 px-2 py-0.5 rounded text-xs">Enter</kbd> for 2 seconds to confirm
            </p>
            <div className="relative">
              <button
                className="tv-focusable w-full bg-emerald-600 hover:bg-emerald-500 text-white font-fredoka px-6 py-3 rounded-xl relative overflow-hidden"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startHold(); }}}
                onKeyUp={(e) => { if (e.key === 'Enter') cancelHold(); }}
                onBlur={cancelHold}
                autoFocus
              >
                <PurchaseProgressIndicator progress={holdProgress} />
                <span className="relative z-10">
                  {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'Hold to Buy'}
                </span>
              </button>
            </div>
            <button
              className="tv-focusable bg-slate-700 hover:bg-slate-600 text-white font-quicksand px-4 py-2 rounded-xl text-sm"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            <button
              className="bg-slate-700 hover:bg-slate-600 text-white font-quicksand px-6 py-2.5 rounded-xl"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-fredoka px-6 py-2.5 rounded-xl"
              onClick={onConfirm}
            >
              Buy Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
