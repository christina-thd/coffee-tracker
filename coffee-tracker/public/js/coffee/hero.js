import { $ } from '../shared/dom.js';

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
