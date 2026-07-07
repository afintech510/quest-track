export default function App() {
  return (
    <div className="min-h-screen bg-surface-dark p-8">
      <header className="text-center mb-12">
        <h1 className="font-fredoka text-5xl font-bold text-primary mb-2">
          QuestTrack Academy
        </h1>
        <p className="font-quicksand text-lg text-slate-400">
          Learn. Quest. Level Up.
        </p>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-2xl p-6 border-2 border-quinn/30 hover:border-quinn transition-colors">
          <div className="text-4xl mb-3">🦁</div>
          <h2 className="font-fredoka text-xl font-semibold text-quinn mb-1">Quinn</h2>
          <p className="font-quicksand text-sm text-slate-400">Level 1 Explorer</p>
          <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-quinn rounded-full" style={{ width: '35%' }} />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-6 border-2 border-cora/30 hover:border-cora transition-colors">
          <div className="text-4xl mb-3">🦄</div>
          <h2 className="font-fredoka text-xl font-semibold text-cora mb-1">Cora</h2>
          <p className="font-quicksand text-sm text-slate-400">Level 1 Explorer</p>
          <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-cora rounded-full" style={{ width: '20%' }} />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-6 border-2 border-family/30 hover:border-family transition-colors">
          <div className="text-4xl mb-3">🏠</div>
          <h2 className="font-fredoka text-xl font-semibold text-family mb-1">Family Hub</h2>
          <p className="font-quicksand text-sm text-slate-400">Calendar & Events</p>
          <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-family rounded-full" style={{ width: '50%' }} />
          </div>
        </div>
      </div>

      <footer className="text-center mt-16 text-slate-600 font-quicksand text-sm">
        Phase 00 — Environment Setup Complete
      </footer>
    </div>
  );
}
