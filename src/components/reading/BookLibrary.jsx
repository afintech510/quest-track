import { useState, useMemo } from 'react';
import { BookOpen, CheckCircle, Bookmark, ArrowRight } from 'lucide-react';
import useDeviceType from '../../hooks/useDeviceType';

const TIER_LABELS = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };
const TIER_COLORS = {
  1: 'from-emerald-600 to-teal-700',
  2: 'from-indigo-600 to-purple-700',
  3: 'from-amber-600 to-rose-700',
};

function BookCover({ book }) {
  const gradient = TIER_COLORS[book.tier] || TIER_COLORS[1];
  return (
    <div className={`w-full aspect-[3/4] rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <span className="text-4xl font-fredoka text-white/80">{book.title?.[0] || '?'}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'assigned') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-quicksand">📖 Assigned!</span>;
  }
  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-quicksand"><CheckCircle size={12} /> Completed!</span>;
  }
  return null;
}

function BookCard({ book, progress, onSelect }) {
  const hasProgress = !!progress;
  const isReading = progress?.status === 'reading';

  return (
    <button
      className={`tv-focusable text-left rounded-xl p-3 transition-all ${
        hasProgress ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-800/50 hover:bg-slate-800 opacity-60'
      }`}
      onClick={() => onSelect(book, progress)}
    >
      <BookCover book={book} />
      <div className="mt-2 space-y-1">
        <p className="font-fredoka text-sm text-white truncate">{book.title}</p>
        <p className="font-quicksand text-xs text-slate-400 truncate">{book.author}</p>
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-quicksand ${
            book.tier === 1 ? 'bg-emerald-900/50 text-emerald-400' :
            book.tier === 2 ? 'bg-indigo-900/50 text-indigo-400' :
            'bg-amber-900/50 text-amber-400'
          }`}>
            Tier {book.tier}
          </span>
          {book.genre && <span className="text-[10px] font-quicksand text-slate-500">{book.genre}</span>}
        </div>
        {!hasProgress && <p className="font-quicksand text-[10px] text-slate-600">Not assigned</p>}
        {hasProgress && <StatusBadge status={progress.status} />}
        {isReading && (
          <div className="space-y-1">
            <div className="w-full bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${Math.round((progress.current_chapter / (book.total_chapters || 1)) * 100)}%` }}
              />
            </div>
            <p className="font-quicksand text-[10px] text-slate-400">
              Ch. {progress.current_chapter} / {book.total_chapters}
            </p>
          </div>
        )}
        {progress?.status === 'completed' && progress.star_rating && (
          <p className="text-amber-400 text-xs">{'⭐'.repeat(progress.star_rating)}</p>
        )}
      </div>
    </button>
  );
}

function CurrentlyReadingCard({ book, progress, onSelect }) {
  const pct = Math.round((progress.current_chapter / (book.total_chapters || 1)) * 100);

  return (
    <button
      className="tv-focusable flex gap-4 bg-slate-800 rounded-xl p-4 text-left hover:bg-slate-700 transition-all w-full"
      onClick={() => onSelect(book, progress)}
    >
      <div className="w-20 flex-shrink-0">
        <BookCover book={book} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="font-fredoka text-base text-white truncate">{book.title}</p>
        <p className="font-quicksand text-xs text-slate-400">{book.author}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-quicksand">
            <span className="text-slate-300">Chapter {progress.current_chapter} of {book.total_chapters}</span>
            <span className="text-primary">{pct}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-primary text-xs font-quicksand">
          <span>Continue reading</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </button>
  );
}

export default function BookLibrary({ books, bookProgress, activeKid, onSelectBook, readingCheckpoints }) {
  const deviceType = useDeviceType();
  const [selectedTier, setSelectedTier] = useState(null);

  const progressByBookId = useMemo(() => {
    if (!activeKid || !bookProgress) return {};
    return bookProgress
      .filter(bp => bp.kid_id === activeKid.id)
      .reduce((acc, bp) => {
        const bookId = bp.book_id;
        acc[bookId] = bp;
        return acc;
      }, {});
  }, [bookProgress, activeKid]);

  const currentlyReading = useMemo(() => {
    if (!books) return [];
    return books
      .filter(b => progressByBookId[b.id]?.status === 'reading')
      .map(b => ({ book: b, progress: progressByBookId[b.id] }));
  }, [books, progressByBookId]);

  const booksByTier = useMemo(() => {
    if (!books) return {};
    const grouped = { 1: [], 2: [], 3: [] };
    books.forEach(b => {
      const tier = b.tier || 1;
      if (!grouped[tier]) grouped[tier] = [];
      grouped[tier].push(b);
    });
    return grouped;
  }, [books]);

  const badges = useMemo(() => {
    return computeReadingBadges(bookProgress, readingCheckpoints, activeKid);
  }, [bookProgress, readingCheckpoints, activeKid]);

  const handleSelect = (book, progress) => {
    onSelectBook(book, progress);
  };

  const tiersToShow = selectedTier ? [selectedTier] : [1, 2, 3];

  return (
    <div className="space-y-6">
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map(b => (
            <span key={b.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 text-xs font-quicksand text-slate-300">
              {b.icon} {b.name}
            </span>
          ))}
        </div>
      )}

      {currentlyReading.length > 0 && (
        <div>
          <h3 className="font-fredoka text-lg text-white mb-3 flex items-center gap-2">
            <Bookmark size={18} className="text-primary" />
            Currently Reading
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentlyReading.map(({ book, progress }) => (
              <CurrentlyReadingCard
                key={book.id}
                book={book}
                progress={progress}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {currentlyReading.length === 0 && (
        <div className="text-center py-4">
          <BookOpen size={32} className="mx-auto text-slate-600 mb-2" />
          <p className="font-quicksand text-sm text-slate-500">No books in progress. Check your assigned books below!</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          className={`tv-focusable px-3 py-1.5 rounded-lg font-quicksand text-xs transition-all ${
            !selectedTier ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          onClick={() => setSelectedTier(null)}
        >
          All Tiers
        </button>
        {[1, 2, 3].map(tier => (
          <button
            key={tier}
            className={`tv-focusable px-3 py-1.5 rounded-lg font-quicksand text-xs transition-all ${
              selectedTier === tier ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            onClick={() => setSelectedTier(tier)}
          >
            Tier {tier} — {TIER_LABELS[tier]}
          </button>
        ))}
      </div>

      {tiersToShow.map(tier => {
        const tierBooks = booksByTier[tier] || [];
        if (tierBooks.length === 0) return null;
        return (
          <div key={tier}>
            <h3 className="font-fredoka text-base text-white mb-3">
              Tier {tier} — {TIER_LABELS[tier]}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tierBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  progress={progressByBookId[book.id]}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function computeReadingBadges(bookProgress, readingCheckpoints, kid) {
  const badges = [];
  if (!bookProgress || !kid) return badges;

  const kidProgress = bookProgress.filter(bp => bp.kid_id === kid.id);
  const completed = kidProgress.filter(bp => bp.status === 'completed');
  const kidCheckpoints = readingCheckpoints?.filter(rc => {
    return kidProgress.some(bp => bp.id === rc.book_progress_id);
  }) || [];

  if (kidCheckpoints.length > 0) {
    badges.push({ id: 'first_chapter', name: 'First Chapter', icon: '📖' });
  }
  if (completed.length >= 1) {
    badges.push({ id: 'bookworm', name: 'Bookworm', icon: '📚' });
  }
  if (completed.length >= 5) {
    badges.push({ id: 'reading_champion', name: 'Reading Champion', icon: '🏆' });
  }
  if (kid.reading_streak >= 7) {
    badges.push({ id: 'week_streak', name: 'Week Streak', icon: '🔥' });
  }
  const reflections = completed.filter(bp => bp.reflection_text);
  if (reflections.length >= 3) {
    badges.push({ id: 'critic', name: 'Critic', icon: '⭐' });
  }

  return badges;
}
