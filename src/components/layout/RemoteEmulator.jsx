import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Check } from 'lucide-react';

function dispatchKey(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

export default function RemoteEmulator() {
  if (import.meta.env.PROD) return null;

  const btn = 'bg-slate-700 hover:bg-slate-600 text-white rounded-lg p-2 transition-colors active:bg-slate-500';

  return (
    <div className="fixed bottom-4 left-4 z-30 bg-slate-900/90 rounded-2xl p-3 shadow-lg border border-slate-700">
      <p className="text-xs text-slate-500 font-quicksand mb-2 text-center">D-Pad</p>
      <div className="grid grid-cols-3 gap-1 w-[120px]">
        <div />
        <button className={btn} onClick={() => dispatchKey('ArrowUp')}><ArrowUp size={16} /></button>
        <div />
        <button className={btn} onClick={() => dispatchKey('ArrowLeft')}><ArrowLeft size={16} /></button>
        <button className={btn} onClick={() => dispatchKey('Enter')}><Check size={16} /></button>
        <button className={btn} onClick={() => dispatchKey('ArrowRight')}><ArrowRight size={16} /></button>
        <div />
        <button className={btn} onClick={() => dispatchKey('ArrowDown')}><ArrowDown size={16} /></button>
        <div />
      </div>
    </div>
  );
}
