import { EARLY_BIRD_START_HOUR, EARLY_BIRD_END_HOUR } from './constants';

export function getCurrentETHour() {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
  );
}

export function getCurrentETDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function isEarlyBirdWindow() {
  const hour = getCurrentETHour();
  return hour >= EARLY_BIRD_START_HOUR && hour < EARLY_BIRD_END_HOUR;
}
