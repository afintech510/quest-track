import { useState, useEffect } from 'react';
import { BarChart3, BookOpen, Brain, Swords, Flame } from 'lucide-react';

export default function AdminDashboard({ supabase, kids }) {
  const [analytics, setAnalytics] = useState([]);
  const [weeklyRates, setWeeklyRates] = useState([]);
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [selectedKid, setSelectedKid] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const [analyticsRes, weeklyRes] = await Promise.all([
        supabase.from('kid_analytics').select('*'),
        supabase.from('weekly_completion_rate').select('*'),
      ]);
      setAnalytics(analyticsRes.data || []);
      setWeeklyRates(weeklyRes.data || []);
      if (!selectedKid && kids?.length) setSelectedKid(kids[0].id);
    })();
  }, [supabase, kids, selectedKid]);

  useEffect(() => {
    if (!supabase || !selectedKid) return;
    (async () => {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('id, kid_id, lesson_id, score, total, created_at, early_bird')
        .eq('kid_id', selectedKid)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentQuizzes(data || []);
    })();
  }, [supabase, selectedKid]);

  const kidAnalytics = analytics.find(a => a.kid_id === selectedKid);
  const kidWeekly = weeklyRates.find(w => w.kid_id === selectedKid);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 size={20} className="text-primary" />
        <h3 className="font-fredoka text-lg text-white">Dashboard</h3>
      </div>

      {kids?.length > 1 && (
        <div className="flex gap-2">
          {kids.map(kid => (
            <button
              key={kid.id}
              className={`tv-focusable px-4 py-2 rounded-xl font-quicksand text-sm transition-all ${
                selectedKid === kid.id
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              onClick={() => setSelectedKid(kid.id)}
            >
              {kid.name}
            </button>
          ))}
        </div>
      )}

      {kidAnalytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Swords size={16} />} label="Level" value={kidAnalytics.level} color="text-primary" />
          <StatCard icon={<Flame size={16} />} label="XP" value={kidAnalytics.xp} color="text-amber-400" />
          <StatCard label="Coins" value={kidAnalytics.coins} emoji="🪙" color="text-yellow-400" />
          <StatCard label="Streak" value={`${kidAnalytics.streak_days}d`} emoji="🔥" color="text-orange-400" />
          <StatCard icon={<Swords size={16} />} label="Chores (7d)" value={kidAnalytics.chores_7d} color="text-emerald-400" />
          <StatCard icon={<Brain size={16} />} label="Quizzes" value={kidAnalytics.total_quizzes} color="text-blue-400" />
          <StatCard icon={<Brain size={16} />} label="Avg Score" value={`${kidAnalytics.avg_quiz_pct}%`} color="text-indigo-400" />
          <StatCard icon={<BookOpen size={16} />} label="Books Done" value={kidAnalytics.books_completed} color="text-purple-400" />
          {kidWeekly && (
            <StatCard label="Weekly %" value={`${kidWeekly.completion_pct}%`} emoji="📊" color="text-cyan-400" />
          )}
        </div>
      )}

      {recentQuizzes.length > 0 && (
        <div>
          <h4 className="font-fredoka text-sm text-white mb-2">Recent Quizzes</h4>
          <div className="space-y-1.5">
            {recentQuizzes.map(q => (
              <div key={q.id} className="bg-slate-800/50 rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {q.early_bird && <span className="text-xs">🌅</span>}
                  <span className="font-quicksand text-sm text-white">
                    {q.score}/{q.total}
                  </span>
                  <span className="font-quicksand text-xs text-slate-500">
                    ({Math.round((q.score / q.total) * 100)}%)
                  </span>
                </div>
                <span className="font-quicksand text-xs text-slate-500">
                  {new Date(q.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, emoji }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 text-center">
      <div className={`flex items-center justify-center gap-1 mb-1 ${color}`}>
        {emoji && <span className="text-sm">{emoji}</span>}
        {icon}
      </div>
      <p className={`font-fredoka text-xl ${color}`}>{value}</p>
      <p className="font-quicksand text-xs text-slate-400">{label}</p>
    </div>
  );
}
