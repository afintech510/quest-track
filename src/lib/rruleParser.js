import { RRule } from 'rrule';

export function expandEvents(events, viewStart, viewEnd) {
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
  return expanded;
}
