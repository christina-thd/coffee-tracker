// What the coffee tracker is made of, shared by the server (validation) and the page (labels, hints).

/**
 * @typedef {'espresso' | 'pourover'} Method
 * @typedef {'good' | 'sour' | 'bitter' | 'off'} Verdict
 * @typedef {{ id: string, name: string, roaster: string, origin: string, variety: string, process: string | null,
 *   roast: string | null, roastFor: string | null, roastedOn: string | null, shop: string, price: number | null,
 *   weight: number | null, flavor: string, notes: string, finished: boolean, createdAt: number }} Bean
 *   a bag of coffee: what it is, where it came from and what it cost. roastFor: what the roaster roasted it for
 *   (ROAST_FOR); roastedOn: 'YYYY-MM-DD'; price: for the bag;
 *   weight: of the bag in grams; flavor: tasting notes from the bag; finished: the bag is empty (kept for its history)
 * @typedef {{ id: string, beanId: string, method: Method, grind: string, dose: number | null, out: number | null,
 *   seconds: number | null, temp: number | null, verdict: Verdict | null, comment: string, brewedAt: number }} Brew
 *   one espresso or pour over. grind: the grinder's setting as it reads ("12", "2.4", "24 clicks"); dose: coffee in
 *   grams; out: espresso in the cup, or water poured, in grams; seconds: how long it took; temp: water in °C
 */

/** How the coffee is made. Espresso is ground on the automatic grinder, pour over on the manual one. */
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

/** What a coffee was roasted for. `card`: on its card. */
export const ROAST_FOR = Object.freeze([
  { id: 'espresso', label: 'Espresso', card: 'Espresso roast' },
  { id: 'pourover', label: 'Pour over', card: 'Pour over roast' },
  { id: 'other', label: 'Other', card: 'Other roast' },
]);

export const PROCESSES = Object.freeze([
  { id: 'washed', label: 'Washed' },
  { id: 'natural', label: 'Natural' },
  { id: 'honey', label: 'Honey' },
  { id: 'anaerobic', label: 'Anaerobic' },
  { id: 'other', label: 'Other' },
]);

/** How a brew came out. Sour and bitter say which way to move the grinder next time. */
export const VERDICTS = Object.freeze([
  { id: 'good', label: 'Good', hint: '' },
  { id: 'sour', label: 'Sour', hint: 'grind finer' },
  { id: 'bitter', label: 'Bitter', hint: 'grind coarser' },
  { id: 'off', label: 'Off', hint: '' },
]);

/** @param {readonly { id: string }[]} list */
export const idsOf = (list) => list.map((x) => x.id);

/** The label of `id` in one of the lists above ('' for none). */
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

/** The highest value of each number. All are 0 or more, and all may be left empty. */
export const LIMITS = Object.freeze({ price: 10000, weight: 10000, dose: 200, out: 2000, seconds: 3600, temp: 100 });

/** A calendar date, 'YYYY-MM-DD' (what <input type="date"> gives). */
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);   // not 2026-02-31
}

/**
 * A number as typed on a phone: "18", "18.5" or "18,5". null when empty, NaN when it isn't a number.
 * @param {string} text
 */
export function parseNumber(text) {
  const value = String(text ?? '').trim().replace(',', '.');
  if (!value) return null;
  return /^\d*\.?\d+$|^\d+\.$/.test(value) ? Number(value) : NaN;
}

/** "28s" for a shot, "3:05" for anything a minute or longer. */
export function formatDuration(seconds) {
  if (seconds == null) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Brew ratio, "1:2" or "1:16.5" (one decimal at most); '' without both numbers. */
export function ratio(dose, out) {
  if (!dose || !out) return '';
  return `1:${Math.round((out / dose) * 10) / 10}`;
}

/**
 * The newest brew matching all that's given (bean, method, verdict), or undefined.
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
 * The same coffee, maybe another bag of it (bought again): the same name and roaster, ignoring case.
 * @param {Bean} a
 * @param {Bean} b
 */
export const sameCoffee = (a, b) =>
  a.name.toLowerCase() === b.name.toLowerCase() && a.roaster.toLowerCase() === b.roaster.toLowerCase();

/**
 * The ids of every bag of the same coffee as `bean` (itself included).
 * @param {Bean[]} beans
 * @param {Bean} bean
 */
export const bagIdsOf = (beans, bean) => new Set(beans.filter((b) => b.id === bean.id || sameCoffee(b, bean)).map((b) => b.id));

/**
 * The settings that came out good with some bags, newest first: one entry per grind, dose and yield (the same ones
 * logged again count up), with the latest brew of them.
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
 * What a bag costs per gram, and so per brew of `dose` grams; null without a price and weight.
 * @param {Bean} bean
 * @param {number | null} dose
 */
export function costOf(bean, dose) {
  if (bean.price == null || !bean.weight || !dose) return null;
  return (bean.price / bean.weight) * dose;
}
