import { CalendarDays } from 'lucide-react';

export default function EmptyCalendar() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarDays size={64} className="text-slate-600 mb-4" />
      <p className="font-fredoka text-xl text-slate-400 mb-2">Nothing on the calendar this week!</p>
      <p className="font-quicksand text-sm text-slate-500 max-w-xs">
        Events will show up here when a parent adds them.
      </p>
    </div>
  );
}
