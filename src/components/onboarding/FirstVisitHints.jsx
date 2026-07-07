import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';

const STORAGE_KEY = 'questtrack_visited';

export default function FirstVisitHints() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, 'true');
    };
    window.addEventListener('keydown', dismiss);
    window.addEventListener('click', dismiss);
    return () => {
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('click', dismiss);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-surface rounded-3xl p-10 text-center max-w-md">
        <p className="font-fredoka text-3xl text-white mb-6">Welcome!</p>

        <div className="flex justify-center gap-2 mb-4">
          <div className="bg-slate-700 p-3 rounded-lg"><ArrowUp size={24} className="text-slate-300" /></div>
        </div>
        <div className="flex justify-center gap-2 mb-6">
          <div className="bg-slate-700 p-3 rounded-lg"><ArrowLeft size={24} className="text-slate-300" /></div>
          <div className="bg-slate-700 p-3 rounded-lg"><ArrowDown size={24} className="text-slate-300" /></div>
          <div className="bg-slate-700 p-3 rounded-lg"><ArrowRight size={24} className="text-slate-300" /></div>
        </div>

        <p className="font-quicksand text-lg text-slate-300 mb-2">
          Use <strong>arrow keys</strong> to navigate
        </p>

        <div className="flex justify-center mb-4">
          <div className="bg-slate-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CornerDownLeft size={20} className="text-slate-300" />
            <span className="font-quicksand text-sm text-slate-300">Enter</span>
          </div>
        </div>

        <p className="font-quicksand text-lg text-slate-300 mb-6">
          Press <strong>Enter</strong> to select
        </p>

        <p className="font-quicksand text-sm text-slate-500">
          Pick your profile to get started! Press any key to dismiss.
        </p>
      </div>
    </div>
  );
}
