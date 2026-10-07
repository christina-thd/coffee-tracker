// Above the tabs: the logo and a greeting that follows the time of day.
import { $ } from '../shared/dom.js';

/** "Good morning", by the time of day. */
function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return 'Late-night coffee?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function renderHero() {
  $('greeting').textContent = greeting();
}
