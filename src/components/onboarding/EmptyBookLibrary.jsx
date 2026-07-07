import { BookOpen } from 'lucide-react';

export default function EmptyBookLibrary() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BookOpen size={64} className="text-slate-600 mb-4" />
      <p className="font-fredoka text-xl text-slate-400 mb-2">No books assigned yet!</p>
      <p className="font-quicksand text-sm text-slate-500 max-w-xs">
        Ask a parent to pick your first book.
      </p>
    </div>
  );
}
