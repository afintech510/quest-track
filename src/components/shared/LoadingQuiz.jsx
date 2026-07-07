import { Sparkles } from 'lucide-react';

export default function LoadingQuiz({ onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={40} className="text-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        <p className="font-fredoka text-2xl text-white mb-2">Summoning Quiz...</p>
        <p className="font-quicksand text-sm text-slate-400 mb-8">
          Preparing your questions
        </p>

        <button
          className="tv-focusable px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-quicksand text-sm hover:bg-slate-700 transition-colors"
          onClick={onCancel}
        >
          &larr; Back to Lesson
        </button>
      </div>
    </div>
  );
}
