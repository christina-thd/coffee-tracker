// Shared by the server (validation) and the page (labels, hints).

/**
 * @typedef {'espresso' | 'pourover'} Method
 * @typedef {'good' | 'sour' | 'bitter' | 'off'} Verdict
 * @typedef {{ id: string, name: string, roaster: string, origin: string, variety: string, process: string | null,
 *   roast: string | null, roastFor: string | null, roastedOn: string | null, shop: string, price: number | null,
 *   weight: number | null, flavor: string, body: number | null, acidity: number | null, sweetness: number | null,
 *   aftertaste: number | null, notes: string, finished: boolean, createdAt: number }} Bean
 * @typedef {{ id: string, beanId: string, method: Method, grind: string, dose: number | null, out: number | null,
 *   seconds: number | null, temp: number | null, verdict: Verdict | null, comment: string, brewedAt: number }} Brew
 */

export const METHODS = Object.freeze([
  { id: 'espresso', label: 'Espresso', grinder: 'Automatic grinder', out: 'Yield', time: 'Shot time' },
  { id: 'pourover', label: 'Pour over', grinder: 'Manual grinder', out: 'Water', time: 'Brew time' },
]);

export const ROASTS = Object.freeze([
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'medium-dark', label: 'Med-dark' },
  { id: 'dark', label: 'Dark' },
]);

/** A bean's taste, each scored 1 to 5 (or not). */
export const TASTE = Object.freeze([
  { id: 'body', label: 'Body', low: 'Light', high: 'Full' },
  { id: 'acidity', label: 'Acidity', low: 'Low', high: 'Bright' },
  { id: 'sweetness', label: 'Sweetness', low: 'Low', high: 'High' },
  { id: 'aftertaste', label: 'Aftertaste', low: 'Short', high: 'Long' },
]);
export const MAX_SCORE = 5;
export const isScore = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_SCORE;

export const ROAST_FOR = Object.freeze([
  { id: 'espresso', label: 'Espresso', card: 'Espresso roast' },
  { id: 'pourover', label: 'Pour over', card: 'Pour over roast' },
  { id: 'other', label: 'Other', card: 'Other roast' },
]);

/**
 * A bean roasted for one method isn't offered for the other; "other" or unset suits both.
 * @param {Bean} bean
 * @param {string} method
 */
export const suits = (bean, method) => !bean.roastFor || bean.roastFor === 'other' || bean.roastFor === method;

export const PROCESSES = Object.freeze([
  { id: 'washed', label: 'Washed' },
  { id: 'natural', label: 'Natural' },
  { id: 'honey', label: 'Honey' },
  { id: 'anaerobic', label: 'Anaerobic' },
  { id: 'other', label: 'Other' },
]);

export const VERDICTS = Object.freeze([
  { id: 'good', label: 'Good', hint: '' },
  { id: 'sour', label: 'Sour', hint: 'grind finer' },
  { id: 'bitter', label: 'Bitter', hint: 'grind coarser' },
  { id: 'off', label: 'Off', hint: '' },
]);

/** @param {readonly { id: string }[]} list */
export const idsOf = (list) => list.map((x) => x.id);

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? '';

export const METHOD_IDS = Object.freeze(idsOf(METHODS));
/** @param {string} id */
export const methodOf = (id) => METHODS.find((m) => m.id === id) ?? METHODS[0];

export const MAX_NAME = 60;
export const MAX_TEXT = 80;
export const MAX_GRIND = 20;
export const MAX_NOTE = 2000;
export const MAX_BEANS = 500;
export const MAX_BREWS = 20000;

/** Maximum for each number (all are optional and 0 or more). */
export const LIMITS = Object.freeze({ price: 10000, weight: 10000, dose: 200, out: 2000, seconds: 3600, temp: 100 });

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);   // rejects 2026-02-31
}

/**
 * Accepts "18,5" too; null when empty, NaN when not a number.
 * @param {string} text
 */
export function parseNumber(text) {
  const value = String(text ?? '').trim().replace(',', '.');
  if (!value) return null;
  return /^\d*\.?\d+$|^\d+\.$/.test(value) ? Number(value) : NaN;
}

/** "28s", or "3:05" from a minute. */
export function formatDuration(seconds) {
  if (seconds == null) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "1:16.5"; '' without both numbers. */
export function ratio(dose, out) {
  if (!dose || !out) return '';
  return `1:${Math.round((out / dose) * 10) / 10}`;
}

/**
 * @param {Brew[]} brews
 * @param {{ beanId?: string, method?: string, verdict?: string }} match
 */
export function latestBrew(brews, { beanId, method, verdict }) {
  let latest;
  for (const brew of brews) {
    if (beanId && brew.beanId !== beanId) continue;
    if (method && brew.method !== method) continue;
    if (verdict && brew.verdict !== verdict) continue;
    if (!latest || brew.brewedAt > latest.brewedAt) latest = brew;
  }
  return latest;
}

/**
 * Same name and roaster, ignoring case (another bag of it).
 * @param {Bean} a
 * @param {Bean} b
 */
export const sameCoffee = (a, b) =>
  a.name.toLowerCase() === b.name.toLowerCase() && a.roaster.toLowerCase() === b.roaster.toLowerCase();

/**
 * @param {Bean[]} beans
 * @param {Bean} bean
 */
export const bagIdsOf = (beans, bean) => new Set(beans.filter((b) => b.id === bean.id || sameCoffee(b, bean)).map((b) => b.id));

/**
 * Good brews grouped by grind, dose and yield, newest first.
 * @param {Brew[]} brews
 * @param {{ beanIds: Set<string>, method: string }} match
 * @returns {{ brew: Brew, count: number }[]}
 */
export function goodSettings(brews, { beanIds, method }) {
  const found = new Map();
  for (const brew of brews) {
    if (brew.verdict !== 'good' || brew.method !== method || !beanIds.has(brew.beanId)) continue;
    const key = [brew.grind.toLowerCase(), brew.dose, brew.out].join('|');
    const seen = found.get(key);
    if (!seen) found.set(key, { brew, count: 1 });
    else {
      seen.count++;
      if (brew.brewedAt > seen.brew.brewedAt) seen.brew = brew;
    }
  }
  return [...found.values()].sort((a, b) => b.brew.brewedAt - a.brew.brewedAt);
}

/**
 * Cost of a `dose`-gram brew; null without price and weight.
 * @param {Bean} bean
 * @param {number | null} dose
 */
export function costOf(bean, dose) {
  if (bean.price == null || !bean.weight || !dose) return null;
  return (bean.price / bean.weight) * dose;
}
