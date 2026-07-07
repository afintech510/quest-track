import { useState, useMemo } from 'react';
import useDeviceType from '../../hooks/useDeviceType';
import { expandEvents } from '../../lib/rruleParser';
import EventCard from './EventCard';
import SomedayBucket from './SomedayBucket';
import EmptyCalendar from '../onboarding/EmptyCalendar';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

function getWeekBounds(date) {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function getDayLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d - today) / (1000 * 60 * 60 * 24);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function CalendarView({ calendarEvents, kids }) {
  const deviceType = useDeviceType();
  const [currentDate, setCurrentDate] = useState(new Date());

  const somedayEvents = useMemo(
    () => (calendarEvents || []).filter(e => e.is_someday),
    [calendarEvents]
  );

  const datedEvents = useMemo(
    () => (calendarEvents || []).filter(e => !e.is_someday),
    [calendarEvents]
  );

  if (!calendarEvents || calendarEvents.length === 0) {
    return <EmptyCalendar />;
  }

  if (deviceType === 'tv') {
    return <TVCalendar events={datedEvents} somedayEvents={somedayEvents} kids={kids} currentDate={currentDate} setCurrentDate={setCurrentDate} />;
  }

  return <MobileCalendar events={datedEvents} somedayEvents={somedayEvents} kids={kids} currentDate={currentDate} setCurrentDate={setCurrentDate} />;
}

function TVCalendar({ events, somedayEvents, kids, currentDate, setCurrentDate }) {
  const { start, end } = getWeekBounds(currentDate);

  const expanded = useMemo(
    () => expandEvents(events, start, end),
    [events, start, end]
  );

  const dayGroups = useMemo(() => {
    const groups = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      groups[d.toDateString()] = [];
    }
    for (const event of expanded) {
      const dayKey = new Date(event.start_time).toDateString();
      if (groups[dayKey]) {
        groups[dayKey].push(event);
      }
    }
    return groups;
  }, [expanded, start, end]);

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const jumpToToday = () => setCurrentDate(new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="tv-focusable p-2 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={prevWeek}>
          <ChevronLeft size={18} className="text-slate-300" />
        </button>
        <span className="font-fredoka text-white">{formatWeekLabel(start, end)}</span>
        <button className="tv-focusable p-2 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={nextWeek}>
          <ChevronRight size={18} className="text-slate-300" />
        </button>
      </div>

      <button
        className="tv-focusable mb-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-quicksand text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 mx-auto"
        onClick={jumpToToday}
      >
        <CalendarDays size={12} /> Today
      </button>

      <div className="space-y-4">
        {Object.entries(dayGroups).map(([dayStr, dayEvents]) => (
          <div key={dayStr}>
            <p className="font-fredoka text-xs text-slate-400 uppercase tracking-wider mb-2">
              {getDayLabel(new Date(dayStr))}
            </p>
            {dayEvents.length > 0 ? (
              <div className="space-y-2">
                {dayEvents.map((event, i) => (
                  <EventCard key={`${event.id}-${i}`} event={event} kids={kids} />
                ))}
              </div>
            ) : (
              <p className="font-quicksand text-xs text-slate-600 italic">No events</p>
            )}
          </div>
        ))}
      </div>

      <SomedayBucket events={somedayEvents} kids={kids} />
    </div>
  );
}

function MobileCalendar({ events, somedayEvents, kids, currentDate, setCurrentDate }) {
  const { start, end } = getMonthBounds(currentDate);

  const expanded = useMemo(
    () => expandEvents(events, start, end),
    [events, start, end]
  );

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const event of expanded) {
      const key = new Date(event.start_time).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [expanded]);

  const [selectedDay, setSelectedDay] = useState(null);

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(start).getDay();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const todayStr = new Date().toDateString();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));
  }

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay.toDateString()] || []) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={prevMonth}>
          <ChevronLeft size={18} className="text-slate-300" />
        </button>
        <span className="font-fredoka text-white">{monthLabel}</span>
        <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={nextMonth}>
          <ChevronRight size={18} className="text-slate-300" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center font-quicksand text-xs text-slate-500 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const dayStr = date.toDateString();
          const dayEvents = eventsByDay[dayStr] || [];
          const isToday = dayStr === todayStr;
          const isSelected = selectedDay && dayStr === selectedDay.toDateString();

          return (
            <button
              key={i}
              className={`aspect-square rounded-lg text-center relative flex flex-col items-center justify-center ${
                isSelected ? 'bg-primary/20 border border-primary' :
                isToday ? 'bg-slate-700' : 'hover:bg-slate-800'
              }`}
              onClick={() => setSelectedDay(date)}
            >
              <span className={`font-quicksand text-xs ${isToday ? 'text-primary font-bold' : 'text-slate-300'}`}>
                {date.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((e, j) => {
                    const kid = e.kid_id ? kids.find(k => k.id === e.kid_id) : null;
                    const dotColor = kid
                      ? kid.name === 'Quinn' ? 'bg-amber-400' : 'bg-purple-400'
                      : 'bg-emerald-400';
                    return <span key={j} className={`w-1 h-1 rounded-full ${dotColor}`} />;
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mb-4">
          <p className="font-fredoka text-sm text-slate-400 mb-2">
            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {selectedEvents.length > 0 ? (
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <EventCard key={`${event.id}-${i}`} event={event} kids={kids} />
              ))}
            </div>
          ) : (
            <p className="font-quicksand text-xs text-slate-500 italic">No events this day</p>
          )}
        </div>
      )}

      <SomedayBucket events={somedayEvents} kids={kids} />
    </div>
  );
}
