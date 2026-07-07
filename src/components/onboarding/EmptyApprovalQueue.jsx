import { CheckCircle } from 'lucide-react';

export default function EmptyApprovalQueue() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckCircle size={64} className="text-emerald-600 mb-4" />
      <p className="font-fredoka text-xl text-slate-400 mb-2">All caught up!</p>
      <p className="font-quicksand text-sm text-slate-500 max-w-xs">
        No chores to review right now.
      </p>
    </div>
  );
}
