import { sendAction } from '../shared/api.js';
import {
  bagIdsOf, costOf, goodSettings, latestBrew, METHODS, parseNumber, PROCESSES, MAX_SCORE, ROAST_FOR, ROASTS, suits, TASTE,
} from '../shared/coffee.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { agoText, money, plural } from '../shared/format.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { bagLabel, specsHtml } from './specs.js';

/** @typedef {import('../shared/coffee.js').Bean} Bean */
/** @typedef {import('../shared/coffee.js').Brew} Brew */

const input = (id) => /** @type {HTMLInputElement} */ ($(id));

/** Good settings shown per method before "See all". */
const SHOWN_GOOD = 3;

/** Bean field -> input id. */
const TEXT_FIELDS = Object.freeze({
  name: 'beanName', roaster: 'beanRoaster', origin: 'beanOrigin', variety: 'beanVariety', shop: 'beanShop', flavor: 'beanFlavor',
});

/**
 * @param {{ getBeans(): Bean[], getBrews(): Brew[], getCurrency(): string,
 *   onLog(method: string, beanId: string): void, onHistory(method: string, beanId: string): void }} options
 */
export function createBeanSheet({ getBeans, getBrews, getCurrency, onLog, onHistory }) {
  const process = /** @type {HTMLSelectElement} */ ($('beanProcess'));
  const roastedOn = input('beanRoastedOn');
  const price = input('beanPrice');
  const weight = input('beanWeight');
  const notes = /** @type {HTMLTextAreaElement} */ ($('beanNotes'));
  const finished = $('beanFinished');
  const again = $('beanAgain');
  const remove = $('beanDelete');
  let beanId = null;                               // null: a new bean
  let roast = null;
  let roastFor = null;
  let taste = {};                                  // body, acidity, sweetness, aftertaste: 1 to 5, or null
  let armed = false;
  let busy = false;
  const expanded = new Set();                      // methods showing all good settings
  let shownAs = '';                                // the form as it was filled: anything else is unsaved

  const formState = () => JSON.stringify([...Object.values(TEXT_FIELDS).map((id) => input(id).value), process.value, roast,
    roastFor, roastedOn.value, price.value, weight.value, notes.value, taste]);

  const sheet = createSheet($('beanLayer'), {
    isDirty: () => Boolean(shownAs) && formState() !== shownAs,
    onClose: () => {
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
      beanId = null;
      shownAs = '';
    },
  });

  const getBean = () => getBeans().find((b) => b.id === beanId);

  process.innerHTML = `<option value="">–</option>${PROCESSES.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}`;
  $('beanRoast').innerHTML = ROASTS.map((r) => `<button type="button" role="radio" data-roast="${r.id}">${r.label}</button>`).join('');
  $('beanRoastFor').innerHTML = ROAST_FOR.map((r) => `<button type="button" role="radio" data-roast-for="${r.id}">${r.label}</button>`).join('');
  for (const button of $('beanSummary').querySelectorAll('[data-log]')) {
    const method = METHODS.find((m) => m.id === /** @type {HTMLElement} */ (button).dataset.log);
    button.innerHTML = `${icon(method.id)}<span>Log ${method.label.toLowerCase()}</span>`;
  }

  function renderRoast() {
    for (const button of $('beanRoast').querySelectorAll('[data-roast]')) {
      const selected = button instanceof HTMLElement && button.dataset.roast === roast;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    for (const button of $('beanRoastFor').querySelectorAll('[data-roast-for]')) {
      const selected = button instanceof HTMLElement && button.dataset.roastFor === roastFor;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
  }

  /** Per method: good settings across all bags, cost per cup, and a link to all tries. */
  function renderSummary() {
    const bean = getBean();
    $('beanSummary').hidden = !bean;
    if (!bean) return;
    for (const button of $('beanSummary').querySelectorAll('[data-log]')) {
      if (button instanceof HTMLElement) button.hidden = !suits(bean, button.dataset.log);
    }
    const beans = getBeans();
    const bags = bagIdsOf(beans, bean);
    const several = bags.size > 1;
    const rows = METHODS.map((m) => {
      const brews = getBrews().filter((b) => b.method === m.id && bags.has(b.beanId));
      if (!brews.length) return '';
      const good = goodSettings(brews, { beanIds: bags, method: m.id });
      const last = latestBrew(brews, {});
      const cost = costOf(bean, (good[0]?.brew ?? last).dose);
      const head = `<p class="dial-method">${icon(m.id)}${m.label}${cost != null
        ? `<span class="dial-cost">≈ ${money(Math.round(cost * 100) / 100, getCurrency())} a cup</span>` : ''}</p>`;
      let body;
      if (good.length) {
        const shown = expanded.has(m.id) ? good : good.slice(0, SHOWN_GOOD);
        body = `<p class="dial-label">Came out good</p><ul class="good-list">${shown.map(({ brew, count }) => {
          const note = [count > 1 ? `${count}× good` : '', several ? bagLabel(beans.find((b) => b.id === brew.beanId), bean.id) : '',
            agoText(brew.brewedAt)].filter(Boolean).join(' · ');
          return `<li><p class="specs">${specsHtml(brew)}</p><p class="dial-note">${escapeHtml(note)}</p></li>`;
        }).join('')}</ul>`;
        if (good.length > SHOWN_GOOD) {
          body += `<button type="button" class="link" data-more-good="${m.id}">${expanded.has(m.id) ? 'Show fewer' : 'See all'}</button>`;
        }
      } else {
        body = `<p class="dial-label">Not there yet. Last try:</p><p class="specs">${specsHtml(last)}</p>`;
      }
      const all = `<button type="button" class="link" data-history="${m.id}">See all tries${several ? ' of every bag' : ''} ›</button>`;
      return `<div class="dial-row">${head}${body}${all}</div>`;
    }).join('');
    $('beanDial').innerHTML = rows || '<p class="dial-note">Not brewed yet. Log the first one:</p>';
  }

  $('beanDial').addEventListener('click', (e) => {
    const more = closest(e, '[data-more-good]');
    if (more) {
      const method = more.dataset.moreGood;
      if (!expanded.delete(method)) expanded.add(method);
      return renderSummary();
    }
    const history = closest(e, '[data-history]');
    if (history && beanId) onHistory(history.dataset.history, beanId);
  });

  function renderExtra() {
    const bean = getBean();
    $('beanExtra').hidden = !bean;
    if (!bean) return;
    again.hidden = !bean.finished;
    again.innerHTML = `${icon('plus')}<span>Bought again</span>`;
    finished.innerHTML = bean.finished ? `${icon('bean')}<span>Back in use</span>` : `${icon('archive')}<span>Bag finished</span>`;
    const count = getBrews().filter((b) => b.beanId === bean.id).length;
    remove.classList.toggle('armed', armed);
    remove.innerHTML = `${icon('trash')}<span>${armed ? `Tap again: delete it${count ? ` and its ${plural(count, 'brew')}` : ''}` : 'Delete'}</span>`;
  }

  function collect() {
    const fields = Object.fromEntries(Object.entries(TEXT_FIELDS).map(([field, id]) => [field, input(id).value.trim()]));
    if (!fields.name) throw new Error('Give it a name');
    const numberIn = (field, name) => {
      const value = parseNumber(field.value);
      if (Number.isNaN(value)) throw new Error(`${name} must be a number`);
      return value;
    };
    return {
      ...fields,
      process: process.value || null,
      roast,
      roastFor,
      ...Object.fromEntries(TASTE.map((t) => [t.id, taste[t.id] ?? null])),
      roastedOn: roastedOn.value || null,
      price: numberIn(price, 'Price'),
      weight: numberIn(weight, 'Bag'),
      notes: notes.value.trim(),
    };
  }

  $('beanRoast').addEventListener('click', (e) => {
    const button = closest(e, '[data-roast]');
    if (!button) return;
    roast = button.dataset.roast === roast ? null : button.dataset.roast;
    renderRoast();
  });

  $('beanRoastFor').addEventListener('click', (e) => {
    const button = closest(e, '[data-roast-for]');
    if (!button) return;
    roastFor = button.dataset.roastFor === roastFor ? null : button.dataset.roastFor;
    renderRoast();
  });

  $('beanTaste').innerHTML = TASTE.map((t) => `<div class="taste-row" data-taste="${t.id}">
    <span class="taste-label">${t.label}</span>
    <span class="taste-end">${t.low}</span>
    <div class="taste-dots" role="radiogroup" aria-label="${t.label}">${Array.from({ length: MAX_SCORE }, (_, i) =>
    `<button type="button" role="radio" data-score="${i + 1}" aria-label="${t.label}: ${i + 1} of ${MAX_SCORE}"></button>`).join('')}</div>
    <span class="taste-end">${t.high}</span>
  </div>`).join('');

  function renderTaste() {
    for (const row of $('beanTaste').querySelectorAll('[data-taste]')) {
      const score = taste[/** @type {HTMLElement} */ (row).dataset.taste];
      for (const dot of row.querySelectorAll('[data-score]')) {
        const n = Number(/** @type {HTMLElement} */ (dot).dataset.score);
        dot.classList.toggle('on', score != null && n <= score);
        dot.setAttribute('aria-checked', String(n === score));
      }
    }
  }

  $('beanTaste').addEventListener('click', (e) => {
    const dot = closest(e, '[data-score]');
    const row = dot && closest(e, '[data-taste]');
    if (!row) return;
    const score = Number(dot.dataset.score);
    taste = { ...taste, [row.dataset.taste]: taste[row.dataset.taste] === score ? null : score };   // tap again: not set
    renderTaste();
  });

  $('beanSummary').addEventListener('click', (e) => {
    const button = closest(e, '[data-log]');
    if (button && beanId) onLog(button.dataset.log, beanId);
  });

  $('beanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    let fields;
    try {
      fields = collect();
    } catch (err) {
      if (!input('beanName').value.trim()) input('beanName').focus();
      return toastError(err);
    }
    busy = true;
    const editing = beanId;
    try {
      if (editing) await sendAction({ type: 'editBean', beanId: editing, ...fields });
      else await sendAction({ type: 'addBean', ...fields });
      sheet.close({ force: true });
      toast(editing ? 'Saved' : `Added ${fields.name}`, { icon: 'check' });
    } catch (err) {
      toastError(err);
    } finally {
      busy = false;
    }
  });

  finished.addEventListener('click', () => {
    const bean = getBean();
    if (!bean) return;
    const done = !bean.finished;
    // stays open so "Bought again" is right there
    sendAction({ type: 'editBean', beanId: bean.id, finished: done })
      .then(() => toast(done ? `${bean.name}: bag finished` : `${bean.name} is back in use`, { icon: 'check' }))
      .catch(toastError);
  });

  remove.addEventListener('click', () => {
    const bean = getBean();
    if (!bean) return;
    if (!armed) {
      armed = true;
      return renderExtra();
    }
    sheet.close({ force: true });
    sendAction({ type: 'removeBean', beanId: bean.id })
      .then(() => toast(`Deleted ${bean.name}`, { icon: 'trash' }))
      .catch(toastError);
  });

  /**
   * @param {Bean | null} existing
   * @param {Bean | null} [from]
   */
  function fill(existing, from = null) {
    const bean = existing ?? from;
    beanId = existing?.id ?? null;
    armed = false;
    expanded.clear();
    for (const [field, inputId] of Object.entries(TEXT_FIELDS)) input(inputId).value = bean?.[field] ?? '';
    process.value = bean?.process ?? '';
    roast = bean?.roast ?? null;
    roastFor = bean?.roastFor ?? null;
    taste = Object.fromEntries(TASTE.map((t) => [t.id, bean?.[t.id] ?? null]));
    renderTaste();
    roastedOn.value = existing?.roastedOn ?? '';  // a new bag has its own roast date
    price.value = bean?.price != null ? String(bean.price) : '';
    weight.value = bean?.weight != null ? String(bean.weight) : '';
    notes.value = bean?.notes ?? '';
    $('beanCurrency').textContent = getCurrency();
    $('beanTitle').textContent = existing ? existing.name : from ? 'Bought again' : 'New coffee';
    $('beanSave').textContent = existing ? 'Save' : from ? 'Add the new bag' : 'Add coffee';
    $('beanHint').hidden = !from;
    $('beanHint').textContent = from
      ? 'Same coffee, new bag: fill in its roast date, and check the price and where you bought it.'
      : '';
    renderRoast();
    renderSummary();
    renderExtra();
    shownAs = formState();
  }

  // reuse this sheet for the new bag, so back still closes it
  again.addEventListener('click', () => {
    const bean = getBean();
    if (!bean) return;
    fill(null, bean);
    /** @type {HTMLElement} */ ($('beanForm')).scrollTop = 0;
  });

  return {
    open(id = null) {
      const bean = id ? getBeans().find((b) => b.id === id) : null;
      fill(bean ?? null);
      sheet.open();
      if (!bean) setTimeout(() => input('beanName').focus(), 320);   // after the slide-in, so the page doesn't jump
    },

    close() {
      sheet.close();
    },

    refresh() {
      if (!sheet.isOpen || !beanId) return;
      if (!getBean()) {
        beanId = null;
        sheet.close({ force: true });
        return;
      }
      renderSummary();
      renderExtra();
    },
  };
}
