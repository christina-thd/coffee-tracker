// Method tabs: a recipe card per coffee (its sweet spot, else last try). Beans tab: a card per bag.
import {
  bagIdsOf, formatDuration, labelOf, latestBrew, MAX_SCORE, METHODS, ratio, ROASTS, sameCoffee, suits, VERDICTS,
} from '../shared/coffee.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { daysSince, num, plural } from '../shared/format.js';
import { icon } from '../ui/icons.js';
import { bagLabel, specsHtml } from './specs.js';

/** @typedef {import('../shared/coffee.js').Bean} Bean */
/** @typedef {import('../shared/coffee.js').Brew} Brew */

export const TABS = Object.freeze(['espresso', 'pourover', 'beans']);

/** Tries shown per "Show older" page. */
export const PAGE = 10;

const EMPTY = {
  espresso: 'No coffee yet. Add one on the Beans tab.',
  pourover: 'No coffee yet. Add one on the Beans tab.',
  beans: 'No coffee yet. Tap + to add a bag.',
};

const lastUsed = (bean, brews) => latestBrew(brews, { beanId: bean.id })?.brewedAt ?? bean.createdAt;

const verdictHtml = (verdict) =>
  (verdict ? `<span class="verdict" data-verdict="${verdict}">${labelOf(VERDICTS, verdict)}</span>` : '');

function tryHtml(brew, canLog) {
  const comment = brew.comment ? `<p class="brew-comment">${escapeHtml(brew.comment)}</p>` : '';
  return `<li class="brew" data-brew="${brew.id}" data-verdict="${brew.verdict ?? 'none'}">
    <div class="brew-main">
      <p class="specs">${specsHtml(brew, { short: true })}</p>
      ${comment}
    </div>
    <div class="brew-side">${verdictHtml(brew.verdict)}
      ${canLog ? `<button type="button" class="again-button" data-again="${brew.id}" aria-label="Try again from this" title="Try again from this">${icon('repeat')}</button>` : ''}
    </div>
  </li>`;
}

/** @param {Brew} brew */
function recipeHtml(brew) {
  const grams = (value) => (value == null ? '–' : `${num(value)}g`);
  const cells = brew.method === 'espresso'
    ? [['Grind', brew.grind || '–'], ['In', grams(brew.dose)], ['Out', grams(brew.out)], ['Time', formatDuration(brew.seconds) || '–']]
    : [['Grind', brew.grind || '–'], ['Ratio', ratio(brew.dose, brew.out) || '–'], ['Time', formatDuration(brew.seconds) || '–']];
  return `<div class="recipe">${cells.map(([label, value], i) => `<div class="recipe-cell">
    <span class="recipe-value${i === 0 ? ' recipe-grind' : ''}">${escapeHtml(value)}</span><span class="recipe-label">${label}</span>
  </div>`).join('')}</div>`;
}

function statusHtml(brew) {
  if (brew.verdict === 'good') return `<span class="status" data-verdict="good">${icon('check')}sweet spot</span>`;
  const verdict = VERDICTS.find((v) => v.id === brew.verdict);
  if (!verdict) return '<span class="status">not rated</span>';
  return `<span class="status" data-verdict="${verdict.id}">${[verdict.label.toLowerCase(), verdict.hint].filter(Boolean).join(' · ')}</span>`;
}

/**
 * @param {string} method
 * @param {Bean} bean  newest bag
 * @param {Bean[]} beans
 * @param {Brew[]} brews  this method's
 * @param {number} opened  tries shown (0: closed)
 * @param {boolean} clearing
 */
function coffeeHtml(method, bean, beans, brews, opened, clearing) {
  const bags = bagIdsOf(beans, bean);
  const several = bags.size > 1;
  const tries = brews.filter((b) => bags.has(b.beanId)).sort((a, b) => b.brewedAt - a.brewedAt);
  const shown = tries.find((b) => b.verdict === 'good') ?? tries[0];
  // roasted for the other method: its tries stay visible, but nothing new is logged here
  const canLog = !bean.finished && suits(bean, method);

  if (!shown) {
    return `<li class="coffee coffee-new${bean.finished ? ' finished' : ''}" data-coffee="${bean.id}">
      <p class="bean-name">${escapeHtml(bean.name)}</p>
      ${canLog ? `<button type="button" class="card-action" data-log-coffee="${bean.id}">${icon('plus')}First ${method === 'espresso' ? 'shot' : 'brew'}</button>` : ''}
    </li>`;
  }

  const from = several ? `<p class="coffee-bag">${bagLabel(beans.find((b) => b.id === shown.beanId), bean.id)}</p>` : '';
  const clear = `<li class="clear-tries"><button type="button" class="pill danger${clearing ? ' armed' : ''}" data-clear="${bean.id}">${
    icon('trash')}<span>${clearing ? 'Tap again: delete all tries' : 'Delete all tries'}</span></button></li>`;
  const list = opened
    ? `<ul class="tries">${tries.slice(0, opened).map((b) => tryHtml(b, canLog)).join('')}${
      tries.length > opened ? `<li class="more"><button type="button" class="link" data-older="${bean.id}">Show older</button></li>` : ''}${clear}</ul>`
    : '';

  return `<li class="coffee coffee-opens${bean.finished ? ' finished' : ''}${opened ? ' open' : ''}" data-coffee="${bean.id}" data-card-tries="${bean.id}">
    <div class="coffee-head"><p class="bean-name">${escapeHtml(bean.name)}</p>${statusHtml(shown)}</div>
    ${from}
    ${recipeHtml(shown)}
    <div class="coffee-foot">
      <button type="button" class="card-link" data-tries="${bean.id}" aria-expanded="${opened > 0}">${opened ? 'Hide tries' : 'Tries'}${icon('chevron')}</button>
      ${canLog ? `<button type="button" class="card-action" data-again="${shown.id}">${icon('repeat')}Again</button>` : ''}
    </div>
    ${list}
  </li>`;
}

/** The bag a coffee's card stands for: the newest in use, else the newest. */
export function cardBagOf(beans, bean) {
  return [...beans].filter((b) => sameCoffee(b, bean))
    .sort((a, b) => Number(a.finished) - Number(b.finished) || b.createdAt - a.createdAt)[0] ?? bean;
}

/** One per coffee: in use (most recently brewed first), then finished ones made this way. */
function coffeesOf(method, beans, brews) {
  const made = new Set(brews.filter((b) => b.method === method).map((b) => b.beanId));
  const newestFirst = [...beans].sort((a, b) => Number(a.finished) - Number(b.finished) || b.createdAt - a.createdAt);
  const coffees = [];
  for (const bean of newestFirst) {
    if (coffees.some((c) => sameCoffee(c, bean))) continue;
    const bags = bagIdsOf(beans, bean);
    if ((bean.finished || !suits(bean, method)) && ![...bags].some((id) => made.has(id))) continue;
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

/** Two lines: the name and its stars, then roaster · roast · days off roast. The rest is in the bean sheet. */
function beanHtml(bean, now) {
  const sub = [
    bean.roaster,
    bean.roastedOn && !bean.finished ? `${plural(daysSince(bean.roastedOn, now), 'day')} off roast` : '',
  ].filter(Boolean).join(' · ');
  const stars = bean.rating
    ? `<span class="stars" aria-label="${bean.rating} of ${MAX_SCORE} stars">${Array.from({ length: MAX_SCORE }, (_, i) =>
      `<span class="${i < bean.rating ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`
    : '';
  const roast = bean.roast ? `<span class="bean-roast"><span class="roast-dot" data-roast="${bean.roast}"></span>${labelOf(ROASTS, bean.roast)}</span>` : '';
  // on the right: the stars, the roast under them (centred alone)
  const side = stars || roast ? `<div class="bean-side">${stars}${roast}</div>` : '';
  return `<li class="bean${bean.finished ? ' finished' : ''}" data-bean-open="${bean.id}">
    <div class="bean-main">
      <p class="bean-name">${escapeHtml(bean.name)}</p>
      ${sub ? `<p class="bean-sub">${escapeHtml(sub)}</p>` : ''}
    </div>
    ${side}
  </li>`;
}

/** `filter`: 'all', or a method: the beans that suit it. */
function beansHtml(beans, brews, now, filter) {
  const byUse = [...beans].filter((b) => filter === 'all' || suits(b, filter))
    .sort((a, b) => lastUsed(b, brews) - lastUsed(a, brews));
  const card = (b) => beanHtml(b, now);
  const finished = byUse.filter((b) => b.finished);
  return byUse.filter((b) => !b.finished).map(card).join('')
    + (finished.length ? `<li class="list-heading">Finished</li>${finished.map(card).join('')}` : '');
}

/**
 * @param {{ beans: Bean[], brews: Brew[], tab: string, opened: Record<string, number>,
 *   clearing?: string | null, beanFilter?: string }} options  keys are "method:beanId"
 */
export function renderBoard({ beans, brews, tab, opened, clearing = null, beanFilter = 'all' }) {
  const now = Date.now();
  for (const name of TABS) {
    const column = /** @type {HTMLElement} */ ($('board').querySelector(`.column[data-tab="${name}"]`));
    const list = column.querySelector('.list');
    const empty = /** @type {HTMLElement} */ (column.querySelector('.empty'));
    list.innerHTML = name === 'beans'
      ? beansHtml(beans, brews, now, beanFilter)
      : brewColumnHtml(name, beans, brews, opened, clearing);
    empty.hidden = list.children.length > 0;
    empty.textContent = name === 'beans' && beans.length
      ? `No beans for ${METHODS.find((m) => m.id === beanFilter)?.label.toLowerCase()}.`
      : EMPTY[name];
    column.classList.toggle('current', name === tab);
    const tabButton = $('tabs').querySelector(`[data-tab="${name}"]`);
    tabButton.classList.toggle('selected', name === tab);
    tabButton.setAttribute('aria-selected', String(name === tab));
  }
  $('board').dataset.tab = tab;
  $('beanFilter').hidden = beans.length < 2;
  $('beanFilter').classList.toggle('on-beans', tab === 'beans');
  for (const button of $('beanFilter').querySelectorAll('[data-bean-filter]')) {
    if (!(button instanceof HTMLElement)) continue;
    if (!button.firstChild) button.innerHTML = icon(button.dataset.beanFilter);
    const selected = button.dataset.beanFilter === beanFilter;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

/**
 * @param {{ onTab(tab: string): void, onLog(method: string, beanId: string): void, onAgain(brewId: string): void,
 *   onTries(method: string, beanId: string): void, onOlder(method: string, beanId: string): void,
 *   onClear(method: string, beanId: string): void, onBeanFilter(filter: string): void,
 *   onOpenBrew(id: string): void, onOpenBean(id: string): void }} handlers
 */
export function wireBoard(handlers) {
  $('tabs').addEventListener('click', (e) => {
    const tab = closest(e, '[data-tab]');
    if (tab) handlers.onTab(tab.dataset.tab);
  });
  $('beanFilter').addEventListener('click', (e) => {
    const button = closest(e, '[data-bean-filter]');
    // tapping the one that's on turns it off: all beans
    if (button) handlers.onBeanFilter(button.classList.contains('selected') ? 'all' : button.dataset.beanFilter);
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
    // anywhere else on a coffee's card (not in its open list) opens or closes its tries
    const card = closest(e, '[data-card-tries]');
    if (card && !closest(e, '.tries')) return handlers.onTries(method, card.dataset.cardTries);
    const bean = closest(e, '[data-bean-open]');
    if (bean) handlers.onOpenBean(bean.dataset.beanOpen);
  });
}
