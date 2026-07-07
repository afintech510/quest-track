import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import useDeviceType from '../../hooks/useDeviceType';

export default function BookReflection({ book, progress, supabase, showToast, refreshData, onDone }) {
  const deviceType = useDeviceType();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);

  if (deviceType === 'tv') {
    return null;
  }

  const handleSubmit = async () => {
    if (!progress || !supabase || saving) return;
    setSaving(true);

    try {
      const updates = {};
      if (rating > 0) updates.star_rating = rating;
      if (reflection.trim()) updates.reflection_text = reflection.trim();

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('book_progress')
          .update(updates)
          .eq('id', progress.id);
        showToast('Review saved! Thanks for sharing! ⭐', 'gold');
        await refreshData();
      }
    } catch (_err) {
      showToast('Could not save review. Try again!', 'error');
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 text-center">
      <div>
        <p className="font-fredoka text-xl text-white mb-1">How was the book?</p>
        <p className="font-quicksand text-sm text-slate-400">{book.title}</p>
      </div>

      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className="tv-focusable p-1 transition-transform hover:scale-110"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
          >
            <Star
              size={36}
              className={n <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
            />
          </button>
        ))}
      </div>

      <div>
        <textarea
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white font-quicksand text-sm placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
          rows={4}
          placeholder="What did you think of this book?"
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          maxLength={500}
        />
        <p className="text-right font-quicksand text-xs text-slate-600 mt-1">{reflection.length}/500</p>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          className="tv-focusable px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-quicksand text-sm hover:bg-slate-700 transition-colors"
          onClick={onDone}
        >
          Skip
        </button>
        <button
          className="tv-focusable flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-quicksand text-sm hover:bg-primary/80 transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={saving || (rating === 0 && !reflection.trim())}
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send size={14} />
              Submit Review
            </>
          )}
        </button>
      </div>
    </div>
  );
}
