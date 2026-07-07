import { useState, useCallback } from 'react';
import { ArrowLeft, BookOpen, Flame, CheckCircle, Star } from 'lucide-react';
import useDeviceType from '../../hooks/useDeviceType';
import { fireConfetti } from '../shared/ConfettiCanvas';

export default function BookDetail({
  book,
  progress,
  activeKid,
  supabase,
  isOnline,
  showToast,
  triggerLevelUp,
  refreshData,
  onBack,
  onCheckpoint,
  onComplete,
}) {
  const deviceType = useDeviceType();
  const [logging, setLogging] = useState(false);

  const nextChapter = (progress?.current_chapter || 0) + 1;
  const isLastChapter = nextChapter >= (book.total_chapters || 1);
  const pct = Math.round(((progress?.current_chapter || 0) / (book.total_chapters || 1)) * 100);

  const isCheckpointChapter = (chapterNum) => {
    const checkpoints = book.checkpoint_chapters;
    if (!Array.isArray(checkpoints)) return false;
    return checkpoints.includes(chapterNum);
  };

  const updateStreak = useCallback(async () => {
    if (!activeKid || !supabase) return;
    const today = new Date().toISOString().split('T')[0];
    const lastRead = activeKid.last_read_date;

    if (lastRead === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastRead === yesterday ? (activeKid.reading_streak || 0) + 1 : 1;

    await supabase
      .from('kids')
      .update({ last_read_date: today, reading_streak: newStreak })
      .eq('id', activeKid.id);
  }, [activeKid, supabase]);

  const handleFinishChapter = useCallback(async () => {
    if (logging || !progress || !supabase) return;
    setLogging(true);

    try {
      await supabase
        .from('book_progress')
        .update({
          current_chapter: nextChapter,
          status: 'reading',
        })
        .eq('id', progress.id);

      await updateStreak();

      const updatedProgress = { ...progress, current_chapter: nextChapter };

      if (isLastChapter && isCheckpointChapter(nextChapter)) {
        await refreshData();
        onCheckpoint(book, updatedProgress, true);
      } else if (isLastChapter) {
        await refreshData();
        onComplete(book, updatedProgress);
      } else if (isCheckpointChapter(nextChapter)) {
        await refreshData();
        onCheckpoint(book, updatedProgress, false);
      } else {
        showToast('Great reading! 📚', 'gold');
        await refreshData();
      }
    } catch (_err) {
      showToast('Could not save progress. Try again!', 'error');
    } finally {
      setLogging(false);
    }
  }, [logging, progress, supabase, nextChapter, isLastChapter, book, updateStreak, refreshData, showToast, onCheckpoint, onComplete]);

  const handleStartReading = useCallback(async () => {
    if (!progress || !supabase || progress.status !== 'assigned') return;
    setLogging(true);
    try {
      await supabase
        .from('book_progress')
        .update({ status: 'reading', current_chapter: 0 })
        .eq('id', progress.id);
      showToast('Let\'s start reading! 📖', 'gold');
      await refreshData();
    } catch (_err) {
      showToast('Could not start book. Try again!', 'error');
    } finally {
      setLogging(false);
    }
  }, [progress, supabase, showToast, refreshData]);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button
        className="tv-focusable flex items-center gap-2 text-slate-400 hover:text-white font-quicksand text-sm transition-colors"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        Back to Library
      </button>

      <div className="flex gap-4">
        <div className={`w-28 flex-shrink-0 aspect-[3/4] rounded-lg bg-gradient-to-br ${
          book.tier === 1 ? 'from-emerald-600 to-teal-700' :
          book.tier === 2 ? 'from-indigo-600 to-purple-700' :
          'from-amber-600 to-rose-700'
        } flex items-center justify-center`}>
          <span className="text-5xl font-fredoka text-white/80">{book.title?.[0] || '?'}</span>
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="font-fredoka text-xl text-white">{book.title}</h2>
          <p className="font-quicksand text-sm text-slate-400">{book.author}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {book.genre && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-quicksand text-slate-400">{book.genre}</span>
            )}
            <span className={`px-2 py-0.5 rounded text-[10px] font-quicksand ${
              book.tier === 1 ? 'bg-emerald-900/50 text-emerald-400' :
              book.tier === 2 ? 'bg-indigo-900/50 text-indigo-400' :
              'bg-amber-900/50 text-amber-400'
            }`}>Tier {book.tier}</span>
            {book.lexile > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-quicksand text-slate-400">{book.lexile}L</span>
            )}
            {book.page_count > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-quicksand text-slate-400">{book.page_count} pages</span>
            )}
          </div>
        </div>
      </div>

      {progress?.status === 'reading' && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-fredoka text-base text-white">
              Chapter {progress.current_chapter} of {book.total_chapters}
            </p>
            <span className="font-quicksand text-sm text-primary">{pct}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {activeKid?.reading_streak > 0 && (
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-amber-400" />
              <span className="font-quicksand text-sm text-amber-300">{activeKid.reading_streak} day streak!</span>
            </div>
          )}
        </div>
      )}

      {progress?.status === 'completed' && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 text-center space-y-2">
          <CheckCircle size={32} className="mx-auto text-emerald-400" />
          <p className="font-fredoka text-lg text-white">Book Complete!</p>
          {progress.star_rating && (
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} size={20} className={n <= progress.star_rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
              ))}
            </div>
          )}
          {progress.reflection_text && (
            <p className="font-quicksand text-sm text-slate-300 italic">"{progress.reflection_text}"</p>
          )}
        </div>
      )}

      {progress?.status === 'assigned' && (
        <button
          className="tv-focusable w-full py-4 rounded-xl bg-primary text-white font-fredoka text-lg hover:bg-primary/80 transition-colors flex items-center justify-center gap-2"
          onClick={handleStartReading}
          disabled={logging}
        >
          <BookOpen size={20} />
          Start Reading!
        </button>
      )}

      {progress?.status === 'reading' && (
        <button
          className="tv-focusable w-full py-4 rounded-xl bg-primary text-white font-fredoka text-lg hover:bg-primary/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={handleFinishChapter}
          disabled={logging}
        >
          {logging ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <BookOpen size={20} />
              {isLastChapter
                ? `I finished the last chapter!`
                : `I finished Chapter ${nextChapter}!`}
            </>
          )}
        </button>
      )}

      {!progress && (
        <div className="text-center py-4">
          <p className="font-quicksand text-sm text-slate-500">This book hasn't been assigned to you yet.</p>
          <p className="font-quicksand text-xs text-slate-600 mt-1">Ask a parent to assign it from their phone!</p>
        </div>
      )}
    </div>
  );
}
