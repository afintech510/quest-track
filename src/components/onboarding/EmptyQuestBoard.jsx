import { Swords } from 'lucide-react';

export default function EmptyQuestBoard() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Swords size={64} className="text-slate-600 mb-4" />
      <p className="font-fredoka text-xl text-slate-400 mb-2">No quests yet!</p>
      <p className="font-quicksand text-sm text-slate-500 max-w-xs">
        A parent can add chores from their phone.
      </p>
    </div>
  );
}
