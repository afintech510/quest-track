import { RRule } from 'rrule';

const cache = new Map();

function getCacheKey(events, viewStart, viewEnd) {
  return `${events.map(e => e.id + (e.rrule || '')).join('|')}::${viewStart.getTime()}::${viewEnd.getTime()}`;
}

export function expandEvents(events, viewStart, viewEnd) {
  const key = getCacheKey(events, viewStart, viewEnd);
  if (cache.has(key)) return cache.get(key);

  const expanded = [];
  for (const event of events) {
    if (event.rrule) {
      try {
        const rule = RRule.fromString(event.rrule);
        const instances = rule.between(viewStart, viewEnd, true);
        instances.forEach(date => {
          expanded.push({ ...event, start_time: date.toISOString(), isRecurring: true });
        });
      } catch {
        expanded.push(event);
      }
    } else if (!event.is_someday) {
      const eventDate = new Date(event.start_time);
      if (eventDate >= viewStart && eventDate <= viewEnd) {
        expanded.push(event);
      }
    }
  }

  cache.set(key, expanded);
  if (cache.size > 50) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  return expanded;
}
