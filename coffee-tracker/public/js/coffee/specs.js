import { formatDuration, ratio } from '../shared/coffee.js';
import { escapeHtml } from '../shared/dom.js';
import { dayMonth, num, shortDate } from '../shared/format.js';
import { icon } from '../ui/icons.js';

/**
 * "this bag", "bag roasted 12 Sep" or "bag added 3 Aug".
 * @param {import('../shared/coffee.js').Bean | undefined} bag
 * @param {string | null} [currentId]
 */
export function bagLabel(bag, currentId = null) {
  if (!bag) return '';
  if (bag.id === currentId) return 'this bag';
  return bag.roastedOn ? `bag roasted ${shortDate(bag.roastedOn)}` : `bag added ${dayMonth(bag.createdAt)}`;
}

/**
 * A brew's settings on one line; `short` omits the temperature.
 * @param {import('../shared/coffee.js').Brew} brew
 * @param {{ short?: boolean }} [options]
 */
export function specsHtml(brew, { short = false } = {}) {
  const espresso = brew.method === 'espresso';
  const parts = [];
  if (brew.grind) parts.push(`<span class="spec spec-grind" title="Grind setting">${icon('grind')}${escapeHtml(brew.grind)}</span>`);
  if (espresso && (brew.dose != null || brew.out != null)) {
    const grams = (value) => (value == null ? '?' : `${num(value)}g`);
    parts.push(`<span class="spec spec-grams" title="Coffee in → espresso out">${grams(brew.dose)} → ${grams(brew.out)}</span>`);
  }
  const brewRatio = espresso ? '' : ratio(brew.dose, brew.out);
  if (brewRatio) parts.push(`<span class="spec spec-grams" title="Coffee : water">${brewRatio}</span>`);
  if (brew.seconds != null) parts.push(`<span class="spec spec-time">${formatDuration(brew.seconds)}</span>`);
  if (espresso && !short && brew.temp != null) parts.push(`<span class="spec spec-faint">${num(brew.temp)}°</span>`);
  return parts.length ? parts.join('') : '<span class="spec spec-faint">No settings</span>';
}
