// The three tabs. Espresso and Pour over: a recipe card per coffee (every bag of it together): its sweet spot (else its
// last try) as labelled values, how it came out, and its tries on request. The app is opened to find a coffee's sweet
// spot and to look the settings up again, not to count cups: so no counts, no diary. Beans: a card per bag.
// Phones show one tab at a time; wide screens show all three side by side (css/coffee.css).
import {
  bagIdsOf, formatDuration, labelOf, latestBrew, METHODS, PROCESSES, ratio, ROAST_FOR, ROASTS, sameCoffee, VERDICTS,
} from '../shared/coffee.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { clock, dayMonth, daysSince, money, num, plural } from '../shared/format.js';
import { icon } from '../ui/icons.js';
import { bagLabel, specsHtml } from './specs.js';

/** @typedef {import('../shared/coffee.js').Bean} Bean */
/** @typedef {import('../shared/coffee.js').Brew} Brew */

export const TABS = Object.freeze(['espresso', 'pourover', 'beans']);

/** Tries shown when a coffee's tries are opened, and added by each "Show older". */
export const PAGE = 10;

const EMPTY = {
  espresso: 'No coffee yet. Add one on the Beans tab.',
  pourover: 'No coffee yet. Add one on the Beans tab.',
  beans: 'No coffee yet. Tap + to add a bag.',
};

/** When a bean was last brewed (or added): the beans you're using come first. */
const lastUsed = (bean, brews) => latestBrew(brews, { beanId: bean.id })?.brewedAt ?? bean.createdAt;

const verdictHtml = (verdict) =>
  (verdict ? `<span class="verdict" data-verdict="${verdict}">${labelOf(VERDICTS, verdict)}</span>` : '');

/** One try, in a coffee's opened list: newest first, with its day and time. */
function tryHtml(brew, bean, several) {
  const bag = several ? ` · ${bagLabel(bean)}` : '';
  const comment = brew.comment ? `<p class="brew-comment">${escapeHtml(brew.comment)}</p>` : '';
  return `<li class="brew" data-brew="${brew.id}" data-verdict="${brew.verdict ?? 'none'}">
    <div class="brew-main">
      <p class="specs">${specsHtml(brew, { short: true })}</p>
      ${comment}
      <p class="brew-when">${dayMonth(brew.brewedAt)}, ${clock(brew.brewedAt)}${bag}</p>
    </div>
    <div class="brew-side">${verdictHtml(brew.verdict)}
      <button type="button" class="again-button" data-again="${brew.id}" aria-label="Try again from this" title="Try again from this">${icon('repeat')}</button>
    </div>
  </li>`;
}

/**
 * A brew as a recipe: labelled values in a row. Espresso: grind, in, out, time. Pour over: grind, ratio, time.
 * @param {Brew} brew
 */
function recipeHtml(brew) {
  const grams = (value) => (value == null ? '–' : `${num(value)}g`);
  const cells = brew.method === 'espresso'
    ? [['Grind', brew.grind || '–'], ['In', grams(brew.dose)], ['Out', grams(brew.out)], ['Time', formatDuration(brew.seconds) || '–']]
    : [['Grind', brew.grind || '–'], ['Ratio', ratio(brew.dose, brew.out) || '–'], ['Time', formatDuration(brew.seconds) || '–']];
  return `<div class="recipe">${cells.map(([label, value], i) => `<div class="recipe-cell">
    <span class="recipe-value${i === 0 ? ' recipe-grind' : ''}">${escapeHtml(value)}</span><span class="recipe-label">${label}</span>
  </div>`).join('')}</div>`;
}

/** How the recipe shown came out: "✓ sweet spot", or the try's taste and which way to grind ("sour · grind finer"). */
function statusHtml(brew) {
  if (brew.verdict === 'good') return `<span class="status" data-verdict="good">${icon('check')}sweet spot</span>`;
  const verdict = VERDICTS.find((v) => v.id === brew.verdict);
  if (!verdict) return '<span class="status">not rated</span>';
  return `<span class="status" data-verdict="${verdict.id}">${[verdict.label.toLowerCase(), verdict.hint].filter(Boolean).join(' · ')}</span>`;
}

/**
 * A coffee's card on a method's tab, a recipe card: its name and how it's going, the recipe (its sweet spot, else its
 * last try), then its tries (opened in place) and Again (a new try copied from the recipe shown).
 * @param {string} method
 * @param {Bean} bean  its newest bag (the one in use, if any)
 * @param {Bean[]} beans
 * @param {Brew[]} brews  this method's
 * @param {number} opened  tries shown (0: closed)
 * @param {boolean} clearing  "Delete all tries" was tapped once: the next tap deletes
 */
function coffeeHtml(method, bean, beans, brews, opened, clearing) {
  const bags = bagIdsOf(beans, bean);
  const several = bags.size > 1;
  const tries = brews.filter((b) => bags.has(b.beanId)).sort((a, b) => b.brewedAt - a.brewedAt);
  const shown = tries.find((b) => b.verdict === 'good') ?? tries[0];   // what works, else where you are

  if (!shown) {
    // not made this way yet: just its name, and the first one
    return `<li class="coffee coffee-new${bean.finished ? ' finished' : ''}" data-coffee="${bean.id}">
      <p class="bean-name">${escapeHtml(bean.name)}</p>
      ${bean.finished ? '' : `<button type="button" class="card-action" data-log-coffee="${bean.id}">${icon('plus')}First ${method === 'espresso' ? 'shot' : 'brew'}</button>`}
    </li>`;
  }

  // a coffee bought more than once: which bag the recipe is from
  const from = several ? `<p class="coffee-bag">${bagLabel(beans.find((b) => b.id === shown.beanId), bean.id)}</p>` : '';
  const clear = `<li class="clear-tries"><button type="button" class="pill danger${clearing ? ' armed' : ''}" data-clear="${bean.id}">${
    icon('trash')}<span>${clearing ? 'Tap again: delete all tries' : 'Delete all tries'}</span></button></li>`;
  const list = opened
    ? `<ul class="tries">${tries.slice(0, opened).map((b) => tryHtml(b, beans.find((x) => x.id === b.beanId), several)).join('')}${
      tries.length > opened ? `<li class="more"><button type="button" class="link" data-older="${bean.id}">Show older</button></li>` : ''}${clear}</ul>`
    : '';

  return `<li class="coffee${bean.finished ? ' finished' : ''}" data-coffee="${bean.id}">
    <div class="coffee-head"><p class="bean-name">${escapeHtml(bean.name)}</p>${statusHtml(shown)}</div>
    ${from}
    ${recipeHtml(shown)}
    <div class="coffee-foot">
      <button type="button" class="card-link" data-tries="${bean.id}" aria-expanded="${opened > 0}">${opened ? 'Hide tries' : 'Tries'}${icon('chevron')}</button>
      ${bean.finished ? '' : `<button type="button" class="card-action" data-again="${shown.id}">${icon('repeat')}Again</button>`}
    </div>
    ${list}
  </li>`;
}

/** The bag a coffee's card stands for (its id is the card's): the newest in use, else the newest. */
export function cardBagOf(beans, bean) {
  return [...beans].filter((b) => sameCoffee(b, bean))
    .sort((a, b) => Number(a.finished) - Number(b.finished) || b.createdAt - a.createdAt)[0] ?? bean;
}

/**
 * The coffees on a method's tab: one per coffee (its newest bag, the one in use if any). In use first, the most
 * recently brewed this way first, then ones not made this way yet; then finished ones made this way, to look their
 * settings up.
 */
function coffeesOf(method, beans, brews) {
  const made = new Set(brews.filter((b) => b.method === method).map((b) => b.beanId));
  const newestFirst = [...beans].sort((a, b) => Number(a.finished) - Number(b.finished) || b.createdAt - a.createdAt);
  const coffees = [];
  for (const bean of newestFirst) {
    if (coffees.some((c) => sameCoffee(c, bean))) continue;
    const bags = bagIdsOf(beans, bean);
    if (bean.finished && ![...bags].some((id) => made.has(id))) continue;   // finished, never made this way
    coffees.push(bean);
  }
  const used = (bean) => latestBrew(brews.filter((b) => b.method === method && bagIdsOf(beans, bean).has(b.beanId)), {})?.brewedAt ?? 0;
  return coffees.sort((a, b) => Number(a.finished) - Number(b.finished) || used(b) - used(a));
}

function brewColumnHtml(method, beans, brews, opened, clearing) {
  const mine = brews.filter((b) => b.method === method);
  const coffees = coffeesOf(method, beans, brews);
  const card = (bean) => coffeeHtml(method, bean, beans, mine, opened[`${method}:${bean.id}`] ?? 0,
    clearing === `${method}:${bean.id}`);
  const inUse = coffees.filter((b) => !b.finished);
  const finished = coffees.filter((b) => b.finished);
  return inUse.map(card).join('') + (finished.length ? `<li class="list-heading">Finished</li>${finished.map(card).join('')}` : '');
}

/** What a bean's card says under its name: price, bag, days off roast. */
function beanMeta(bean, currency, now) {
  const meta = [];
  if (bean.price != null) meta.push(money(bean.price, currency) + (bean.weight ? ` / ${num(bean.weight)}g` : ''));
  else if (bean.weight) meta.push(`${num(bean.weight)}g`);
  if (bean.roastedOn && !bean.finished) meta.push(`${plural(daysSince(bean.roastedOn, now), 'day')} off roast`);
  return meta.join(' · ');
}

function beanHtml(bean, beans, brews, currency, now) {
  const sub = [bean.roaster, bean.origin, labelOf(PROCESSES, bean.process)].filter(Boolean).join(' · ');
  const roast = bean.roast ? `<span class="roast" data-roast="${bean.roast}">${labelOf(ROASTS, bean.roast)}</span>` : '';
  const roastFor = ROAST_FOR.find((r) => r.id === bean.roastFor);
  const forHtml = roastFor ? `<span class="roast-for">${roastFor.card}</span>` : '';
  // the grind it's dialed in at per method, with any bag of this coffee: where to start next time
  const bags = bagIdsOf(beans, bean);
  const ofBags = brews.filter((b) => bags.has(b.beanId));
  const dial = METHODS.map((m) => {
    const good = latestBrew(ofBags, { method: m.id, verdict: 'good' });
    return good?.grind ? `<span class="dial-chip" title="Sweet spot: ${m.label.toLowerCase()}">${icon(m.id)}${escapeHtml(good.grind)}</span>` : '';
  }).join('');
  const meta = beanMeta(bean, currency, now);
  return `<li class="bean${bean.finished ? ' finished' : ''}" data-bean-open="${bean.id}">
    <div class="bean-head"><p class="bean-name">${escapeHtml(bean.name)}</p>${forHtml}${roast}</div>
    ${sub ? `<p class="bean-sub">${escapeHtml(sub)}</p>` : ''}
    ${bean.flavor ? `<p class="bean-flavor">${escapeHtml(bean.flavor)}</p>` : ''}
    ${meta || dial ? `<div class="bean-foot"><p class="bean-meta">${meta}</p>${dial}</div>` : ''}
  </li>`;
}

function beansHtml(beans, brews, currency, now) {
  const byUse = [...beans].sort((a, b) => lastUsed(b, brews) - lastUsed(a, brews));
  const card = (b) => beanHtml(b, beans, brews, currency, now);
  const finished = byUse.filter((b) => b.finished);
  return byUse.filter((b) => !b.finished).map(card).join('')
    + (finished.length ? `<li class="list-heading">Finished</li>${finished.map(card).join('')}` : '');
}

/**
 * Fills the three columns and the tabs.
 * @param {{ beans: Bean[], brews: Brew[], currency: string, tab: string, opened: Record<string, number>,
 *   clearing?: string | null }} options
 *   opened: per "method:beanId", how many of that coffee's tries are shown (none: closed)
 *   clearing: the "method:beanId" whose "Delete all tries" was tapped once (null: none)
 */
export function renderBoard({ beans, brews, currency, tab, opened, clearing = null }) {
  const now = Date.now();
  for (const name of TABS) {
    const column = /** @type {HTMLElement} */ ($('board').querySelector(`.column[data-tab="${name}"]`));
    const list = column.querySelector('.list');
    const empty = /** @type {HTMLElement} */ (column.querySelector('.empty'));
    list.innerHTML = name === 'beans' ? beansHtml(beans, brews, currency, now) : brewColumnHtml(name, beans, brews, opened, clearing);
    empty.hidden = list.children.length > 0;
    empty.textContent = EMPTY[name];
    column.classList.toggle('current', name === tab);
    const tabButton = $('tabs').querySelector(`[data-tab="${name}"]`);
    tabButton.classList.toggle('selected', name === tab);
    tabButton.setAttribute('aria-selected', String(name === tab));
  }
  $('board').dataset.tab = tab;
}

/**
 * One listener for the tabs and one for the whole board. Coffee cards are on a method's column: `method` is its tab.
 * @param {{ onTab(tab: string): void, onLog(method: string, beanId: string): void, onAgain(brewId: string): void,
 *   onTries(method: string, beanId: string): void, onOlder(method: string, beanId: string): void,
 *   onClear(method: string, beanId: string): void,
 *   onOpenBrew(id: string): void, onOpenBean(id: string): void }} handlers
 *   onLog: a new try of a coffee (from its last); onAgain: a new try copied from that one
 */
export function wireBoard(handlers) {
  $('tabs').addEventListener('click', (e) => {
    const tab = closest(e, '[data-tab]');
    if (tab) handlers.onTab(tab.dataset.tab);
  });
  $('board').addEventListener('click', (e) => {
    const method = closest(e, '.column')?.dataset.tab;
    const log = closest(e, '[data-log-coffee]');
    if (log) return handlers.onLog(method, log.dataset.logCoffee);
    const again = closest(e, '[data-again]');
    if (again) return handlers.onAgain(again.dataset.again);
    const tries = closest(e, '[data-tries]');
    if (tries) return handlers.onTries(method, tries.dataset.tries);
    const older = closest(e, '[data-older]');
    if (older) return handlers.onOlder(method, older.dataset.older);
    const clear = closest(e, '[data-clear]');
    if (clear) return handlers.onClear(method, clear.dataset.clear);
    const brew = closest(e, '[data-brew]');
    if (brew) return handlers.onOpenBrew(brew.dataset.brew);
    const bean = closest(e, '[data-bean-open]');
    if (bean) handlers.onOpenBean(bean.dataset.beanOpen);
  });
}
