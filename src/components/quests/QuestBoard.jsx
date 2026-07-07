import { useMemo, useEffect } from 'react';
import { useToast } from '../layout/Toast';
import ChoreCard from './ChoreCard';
import EmptyQuestBoard from '../onboarding/EmptyQuestBoard';
import { Swords, Shield, Crown } from 'lucide-react';

const SECTIONS = [
  { key: 'daily', label: 'Daily Quests', icon: Swords, frequency: 'daily' },
  { key: 'weekly', label: 'Weekly Raids', icon: Shield, frequency: 'weekly' },
  { key: 'monthly', label: 'Monthly Epics', icon: Crown, frequency: 'once' },
];

export default function QuestBoard({ choreEvents, activeKid, completeChore, supabase }) {
  const { showToast } = useToast();

  const choreData = useMemo(() => {
    if (!activeKid || !choreEvents.length) return { chores: {}, events: {} };

    const kidEvents = choreEvents.filter(e => e.kid_id === activeKid.id);
    const chores = {};
    const events = {};

    for (const event of kidEvents) {
      const def = event.chore_definitions;
      if (!def || def.deleted_at || !def.is_active) continue;

      if (!chores[def.id]) {
        chores[def.id] = def;
      }
      const freq = def.frequency;
      if (!events[freq]) events[freq] = {};
      const existing = events[freq][def.id];
      if (!existing || new Date(event.created_at) > new Date(existing.created_at)) {
        events[freq][def.id] = event;
      }
    }

    return { chores, events };
  }, [choreEvents, activeKid]);

  useEffect(() => {
    if (!activeKid || !choreEvents.length) return;
    const kidEvents = choreEvents.filter(
      e => e.kid_id === activeKid.id &&
      e.status === 'rejected' &&
      e.reviewed_at
    );
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const event of kidEvents) {
      if (new Date(event.reviewed_at).getTime() > dayAgo) {
        const title = event.chore_definitions?.title || 'A chore';
        showToast(`${title} wasn't approved — ask a parent why!`, 'error');
      }
    }
  }, [activeKid?.id]);

  const hasAnyChores = Object.keys(choreData.chores).length > 0;
  if (!hasAnyChores) return <EmptyQuestBoard />;

  return (
    <div className="space-y-6">
      {SECTIONS.map(section => {
        const freq = section.frequency;
        const sectionEvents = choreData.events[freq] || {};
        const choreIds = Object.keys(sectionEvents);
        if (choreIds.length === 0) return null;

        const Icon = section.icon;
        const isMonthly = freq === 'once';

        return (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={18} className={isMonthly ? 'text-amber-400' : 'text-slate-400'} />
              <h2 className={`font-fredoka text-lg ${isMonthly ? 'text-amber-400' : 'text-white'}`}>
                {section.label}
              </h2>
            </div>
            <div className="grid gap-2">
              {choreIds.map(choreId => {
                const event = sectionEvents[choreId];
                const chore = choreData.chores[choreId];
                if (!chore) return null;
                return (
                  <ChoreCard
                    key={event.id}
                    chore={chore}
                    event={event}
                    onComplete={completeChore}
                    isMonthly={isMonthly}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
