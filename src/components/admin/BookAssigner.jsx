import { useState, useMemo } from 'react';
import { BookOpen, Plus, Sparkles } from 'lucide-react';
import useDeviceType from '../../hooks/useDeviceType';

export default function BookAssigner({ books, bookProgress, kids, activeKid, supabase, showToast, refreshData }) {
  const deviceType = useDeviceType();
  const [filterTier, setFilterTier] = useState(null);
  const [filterGenre, setFilterGenre] = useState(null);
  const [assigning, setAssigning] = useState(null);

  if (deviceType === 'tv') return null;

  const selectedKid = activeKid;
  if (!selectedKid) return null;

  const kidProgress = useMemo(() => {
    return (bookProgress || []).filter(bp => bp.kid_id === selectedKid.id);
  }, [bookProgress, selectedKid]);

  const assignedBookIds = useMemo(() => {
    return new Set(kidProgress.map(bp => bp.book_id));
  }, [kidProgress]);

  const currentlyReading = kidProgress.filter(bp => bp.status === 'reading');
  const completed = kidProgress.filter(bp => bp.status === 'completed');
  const assigned = kidProgress.filter(bp => bp.status === 'assigned');

  const genres = useMemo(() => {
    if (!books) return [];
    const genreSet = new Set(books.map(b => b.genre).filter(Boolean));
    return [...genreSet].sort();
  }, [books]);

  const unassignedBooks = useMemo(() => {
    if (!books) return [];
    return books.filter(b => {
      if (assignedBookIds.has(b.id)) return false;
      if (filterTier && b.tier !== filterTier) return false;
      if (filterGenre && b.genre !== filterGenre) return false;
      return true;
    });
  }, [books, assignedBookIds, filterTier, filterGenre]);

  const suggestions = useMemo(() => {
    if (completed.length === 0 || !books) return [];
    const lastCompleted = completed[completed.length - 1];
    const lastBook = books.find(b => b.id === lastCompleted.book_id);
    if (!lastBook) return [];

    const candidates = books.filter(b =>
      !assignedBookIds.has(b.id) &&
      (b.tier === lastBook.tier || b.tier === lastBook.tier + 1)
    );

    const sameGenre = candidates.filter(b => b.genre === lastBook.genre);
    const diffGenre = candidates.filter(b => b.genre !== lastBook.genre);
    return [...sameGenre, ...diffGenre].slice(0, 3);
  }, [completed, books, assignedBookIds]);

  const handleAssign = async (bookId) => {
    if (assigning || !supabase) return;
    setAssigning(bookId);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/assign-book`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kid_id: selectedKid.id,
          book_id: bookId,
        }),
      });

      const data = await response.json();

      if (data.status === 'already_assigned') {
        showToast('This book is already assigned!', 'info');
      } else if (data.status === 'success') {
        const book = books.find(b => b.id === bookId);
        showToast(`📚 ${book?.title || 'Book'} assigned to ${selectedKid.name}!`, 'gold');
        await refreshData();
      } else if (data.error) {
        showToast(data.error, 'error');
      }
    } catch (_err) {
      showToast('Could not assign book. Try again!', 'error');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="font-fredoka text-lg text-white flex items-center gap-2">
        <BookOpen size={20} className="text-primary" />
        Book Assignments — {selectedKid.name}
      </h3>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="font-fredoka text-2xl text-primary">{currentlyReading.length}</p>
          <p className="font-quicksand text-xs text-slate-400">Reading</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="font-fredoka text-2xl text-emerald-400">{completed.length}</p>
          <p className="font-quicksand text-xs text-slate-400">Completed</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="font-fredoka text-2xl text-amber-400">{assigned.length}</p>
          <p className="font-quicksand text-xs text-slate-400">Assigned</p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div>
          <h4 className="font-fredoka text-sm text-white mb-2 flex items-center gap-1">
            <Sparkles size={14} className="text-amber-400" />
            Suggested Next Books
          </h4>
          <div className="space-y-2">
            {suggestions.map(book => (
              <div key={book.id} className="flex items-center justify-between bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-quicksand text-sm text-white truncate">{book.title}</p>
                  <p className="font-quicksand text-xs text-slate-400">{book.author} · Tier {book.tier}</p>
                </div>
                <button
                  className="tv-focusable flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-quicksand hover:bg-primary/80 transition-colors disabled:opacity-50"
                  onClick={() => handleAssign(book.id)}
                  disabled={assigning === book.id}
                >
                  {assigning === book.id ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="font-fredoka text-sm text-white mb-2">Unassigned Books</h4>
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            className={`px-2 py-1 rounded-lg text-xs font-quicksand transition-all ${!filterTier ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400'}`}
            onClick={() => setFilterTier(null)}
          >
            All Tiers
          </button>
          {[1, 2, 3].map(t => (
            <button
              key={t}
              className={`px-2 py-1 rounded-lg text-xs font-quicksand transition-all ${filterTier === t ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400'}`}
              onClick={() => setFilterTier(t)}
            >
              Tier {t}
            </button>
          ))}
          {genres.map(g => (
            <button
              key={g}
              className={`px-2 py-1 rounded-lg text-xs font-quicksand transition-all ${filterGenre === g ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400'}`}
              onClick={() => setFilterGenre(filterGenre === g ? null : g)}
            >
              {g}
            </button>
          ))}
        </div>

        {unassignedBooks.length === 0 ? (
          <p className="font-quicksand text-sm text-slate-500 text-center py-4">
            {assignedBookIds.size === books?.length ? 'All books are assigned!' : 'No books match your filters.'}
          </p>
        ) : (
          <div className="space-y-2">
            {unassignedBooks.map(book => (
              <div key={book.id} className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-quicksand text-sm text-white truncate">{book.title}</p>
                  <p className="font-quicksand text-xs text-slate-400">
                    {book.author} · Tier {book.tier} · {book.genre || 'General'} · {book.total_chapters} chapters
                  </p>
                </div>
                <button
                  className="tv-focusable flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-quicksand hover:bg-primary/80 transition-colors disabled:opacity-50"
                  onClick={() => handleAssign(book.id)}
                  disabled={assigning === book.id}
                >
                  {assigning === book.id ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Assign
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
