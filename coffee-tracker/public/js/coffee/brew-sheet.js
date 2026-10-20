// New brews start from the last one of that coffee and method, so finding the sweet spot is changing one number.
import { sendAction } from '../shared/api.js';
import {
  bagIdsOf, labelOf, latestBrew, methodOf, parseNumber, ratio, sameCoffee, suits, VERDICTS,
} from '../shared/coffee.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { agoText, dateTime, num } from '../shared/format.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { bagLabel, specsHtml } from './specs.js';

/** @typedef {import('../shared/coffee.js').Bean} Bean */
/** @typedef {import('../shared/coffee.js').Brew} Brew */

const input = (id) => /** @type {HTMLInputElement} */ ($(id));

function numberIn(field, name) {
  const value = parseNumber(field.value);
  if (Number.isNaN(value)) throw new Error(`${name} must be a number`);
  return value;
}

/**
 * @param {{ getBeans(): Bean[], getBrews(): Brew[], onDeleted(brew: Brew): void }} options
 */
export function createBrewSheet({ getBeans, getBrews, onDeleted }) {
  const grind = input('brewGrind');
  const minutes = input('brewMinutes');
  const seconds = input('brewSeconds');
  const dose = input('brewDose');
  const out = input('brewOut');
  const temp = input('brewTemp');
  const bean = /** @type {HTMLSelectElement} */ ($('brewBean'));
  const comment = /** @type {HTMLTextAreaElement} */ ($('brewComment'));
  const remove = $('brewDelete');
  let brewId = null;                               // null: a new brew
  let method = 'espresso';
  let verdict = null;
  let touched = false;                             // typed settings survive a coffee/method change
  let armed = false;
  let busy = false;
  let picked = null;                               // the coffee chosen: back again when the method allows it
  let shownAs = '';                                // the form as it was opened: anything else is unsaved

  const formState = () => JSON.stringify([bean.value, method, grind.value, minutes.value, seconds.value, dose.value,
    out.value, temp.value, verdict, comment.value]);

  const sheet = createSheet($('brewLayer'), {
    isDirty: () => Boolean(shownAs) && formState() !== shownAs,
    onClose: () => {
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
      brewId = null;
      shownAs = '';
    },
  });

  const getBrew = () => getBrews().find((b) => b.id === brewId);

  /** Beans in use that suit the method, plus the selected one (finished, or an existing brew's). */
  function renderBeans(selected) {
    const offered = (b) => (b.id === selected && (brewId || suits(b, method))) || (!b.finished && suits(b, method));
    const options = getBeans().filter(offered);
    bean.innerHTML = options.length
      ? options.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}${b.roaster ? ` · ${escapeHtml(b.roaster)}` : ''}</option>`).join('')
      : `<option value="">No coffee for ${methodOf(method).label.toLowerCase()} yet</option>`;
    if (options.some((b) => b.id === selected)) bean.value = selected;
  }

  function getSeconds() {
    const m = method === 'espresso' ? null : numberIn(minutes, 'Minutes');
    const s = numberIn(seconds, 'Seconds');
    return m == null && s == null ? null : (m ?? 0) * 60 + (s ?? 0);
  }

  function setSeconds(total) {
    if (total == null) {
      minutes.value = '';
      seconds.value = '';
    } else if (method === 'espresso') {
      minutes.value = '';
      seconds.value = num(total);
    } else {
      minutes.value = String(Math.floor(total / 60));
      seconds.value = num(total % 60);
    }
  }

  function renderMethod() {
    const m = methodOf(method);
    for (const button of $('brewMethod').querySelectorAll('[data-method]')) {
      const selected = button instanceof HTMLElement && button.dataset.method === method;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    $('brewGrindLabel').textContent = m.grinder;
    $('brewTimeLabel').textContent = m.time;
    $('brewOutLabel').textContent = m.out;
    $('brewOutUnit').textContent = method === 'espresso' ? 'g' : 'ml';   // saved in grams; 1g water = 1ml
    const espresso = method === 'espresso';
    minutes.hidden = espresso;
    $('brewColon').hidden = espresso;
    seconds.placeholder = espresso ? 'seconds' : 'sec';
  }

  function renderVerdict() {
    for (const button of $('brewVerdict').querySelectorAll('[data-verdict]')) {
      const selected = button instanceof HTMLElement && button.dataset.verdict === verdict;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    const hint = VERDICTS.find((v) => v.id === verdict)?.hint;
    $('brewHint').hidden = !hint;
    $('brewHint').textContent = hint ? `${labelOf(VERDICTS, verdict)}: next time, ${hint}.` : '';
  }

  function renderRatio() {
    let text = '';
    try {
      text = ratio(numberIn(dose, 'Dose'), numberIn(out, 'Yield'));
    } catch {
      // not numbers (yet): no ratio
    }
    $('brewRatio').textContent = text || '–';
  }

  /** Falls back to an earlier bag of the same coffee. */
  function lastOfBean() {
    const own = latestBrew(getBrews(), { beanId: bean.value, method });
    if (own) return own;
    return latestBrew(brewsOfBags(), { method });
  }

  function brewsOfBags() {
    const current = getBeans().find((b) => b.id === bean.value);
    if (!current) return [];
    const bags = bagIdsOf(getBeans(), current);
    return getBrews().filter((b) => b.method === method && bags.has(b.beanId));
  }

  const lastGood = () => latestBrew(brewsOfBags(), { verdict: 'good' });

  function renderLast() {
    const last = brewId ? null : lastOfBean();
    $('brewLast').hidden = !last;
    if (!last) return;
    const tasted = last.verdict ? ` <span class="verdict" data-verdict="${last.verdict}">${labelOf(VERDICTS, last.verdict)}</span>` : '';
    const hint = VERDICTS.find((v) => v.id === last.verdict)?.hint;
    const from = last.beanId === bean.value ? 'Last time' : 'Last bag';
    const good = last.verdict === 'good' ? null : lastGood();
    const goodHtml = good ? `<span class="last-good">
        <span class="last-label">Last good, ${agoText(good.brewedAt)}${good.beanId === bean.value ? '' : ` (${bagLabel(getBeans().find((b) => b.id === good.beanId))})`}</span>
        <span class="last-good-row"><span class="specs">${specsHtml(good)}</span>
          <button type="button" class="use-good" data-use="${good.id}">Use</button></span>
      </span>` : '';
    $('brewLast').innerHTML = `<span class="last-label">${from}, ${agoText(last.brewedAt)}</span>
      <span class="specs">${specsHtml(last)}${tasted}</span>${hint ? `<span class="last-hint">${icon('grind')}Try to ${hint}</span>` : ''}${goodHtml}`;
  }

  $('brewLast').addEventListener('click', (e) => {
    const button = closest(e, '[data-use]');
    const good = button && getBrews().find((b) => b.id === button.dataset.use);
    if (!good) return;
    grind.value = good.grind;
    if (good.dose != null) dose.value = num(good.dose);
    if (good.out != null) out.value = num(good.out);
    if (good.temp != null) temp.value = num(good.temp);
    touched = true;
    renderRatio();
    toast('Good settings filled in', { icon: 'check' });
  });

  /**
   * Copies `from`, else this coffee's last try, else this method's last (minus grind/time: another coffee's).
   * @param {Brew | null} [from]
   */
  function prefill(from = null) {
    const last = from ?? lastOfBean();
    const any = last ?? latestBrew(getBrews(), { method });
    grind.value = last?.grind ?? '';
    grind.placeholder = any?.grind ? `e.g. ${any.grind}` : '';
    dose.value = any?.dose != null ? num(any.dose) : '';
    out.value = any?.out != null ? num(any.out) : '';
    temp.value = any?.temp != null ? num(any.temp) : '';
    setSeconds(last?.seconds ?? null);
    seconds.placeholder = method === 'espresso' ? 'seconds' : 'sec';
    renderRatio();
  }

  /**
   * Returns false when there's no coffee to brew.
   * @param {{ method: string, beanId?: string | null, from?: Brew | null }} options
   */
  function startNew({ method: startMethod, beanId: wanted = null, from = null }) {
    // a finished bag that was bought again: use the bag in use
    const given = getBeans().find((b) => b.id === wanted);
    const inUse = given?.finished ? getBeans().filter((b) => !b.finished && sameCoffee(b, given)).at(-1) : null;
    const beanId = inUse?.id ?? wanted;
    const nextMethod = methodOf(startMethod).id;
    const active = getBeans().filter((b) => (!b.finished || b.id === beanId) && suits(b, nextMethod));
    if (!active.length) return false;
    brewId = null;
    method = nextMethod;
    const lastBean = latestBrew(getBrews(), { method })?.beanId;
    const pick = [beanId, lastBean].find((id) => active.some((b) => b.id === id)) ?? active.at(-1).id;
    picked = pick;
    renderBeans(pick);
    verdict = null;
    touched = Boolean(from);
    comment.value = '';
    prefill(from);
    return true;
  }

  function disarm() {
    armed = false;
    remove.classList.remove('armed');
    remove.innerHTML = `${icon('trash')}<span>Delete</span>`;
  }

  $('brewMethod').addEventListener('click', (e) => {
    const button = closest(e, '[data-method]');
    if (!button || button.dataset.method === method) return;
    let total = null;
    try {
      total = getSeconds();
    } catch {
      // not a number: dropped
    }
    method = button.dataset.method;
    renderMethod();
    renderBeans(picked);
    setSeconds(total);
    if (!brewId && !touched) prefill();
    renderLast();
  });

  bean.addEventListener('change', () => {
    picked = bean.value;
    if (!brewId && !touched) prefill();
    renderLast();
  });

  $('brewVerdict').addEventListener('click', (e) => {
    const button = closest(e, '[data-verdict]');
    if (!button) return;
    verdict = button.dataset.verdict === verdict ? null : button.dataset.verdict;
    renderVerdict();
  });

  for (const field of [grind, minutes, seconds, dose, out, temp]) {
    field.addEventListener('input', () => {
      touched = true;
      renderRatio();
    });
    field.addEventListener('focus', () => field.select());
  }

  $('brewAgain').innerHTML = `${icon('repeat')}<span>Try again from this</span>`;
  $('brewAgain').addEventListener('click', () => {
    const brew = getBrew();
    if (!brew || !startNew({ method: brew.method, beanId: brew.beanId, from: brew })) return;
    show();
    /** @type {HTMLElement} */ ($('brewForm')).scrollTop = 0;
  });

  $('brewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    let brew;
    try {
      if (!bean.value) throw new Error('Pick a coffee');
      brew = {
        beanId: bean.value,
        method,
        grind: grind.value.trim(),
        dose: numberIn(dose, 'Dose'),
        out: numberIn(out, methodOf(method).out),
        seconds: getSeconds(),
        temp: numberIn(temp, 'Temperature'),
        verdict,
        comment: comment.value.trim(),
      };
    } catch (err) {
      return toastError(err);
    }
    busy = true;
    const editing = brewId;
    try {
      if (editing) await sendAction({ type: 'editBrew', brewId: editing, ...brew });
      else await sendAction({ type: 'addBrew', ...brew });
      sheet.close({ force: true });
      toast(!editing && brew.verdict === 'good' ? 'Saved: sweet spot' : 'Saved', { icon: 'check' });
    } catch (err) {
      toastError(err);
    } finally {
      busy = false;
    }
  });

  remove.addEventListener('click', () => {
    const brew = getBrew();
    if (!brew) return;
    if (!armed) {
      armed = true;
      remove.classList.add('armed');
      remove.innerHTML = `${icon('trash')}<span>Tap again to delete</span>`;
      return;
    }
    sheet.close({ force: true });
    sendAction({ type: 'removeBrew', brewId: brew.id })
      .then(() => onDeleted(brew))
      .catch(toastError);
  });

  function show() {
    disarm();
    renderMethod();
    renderVerdict();
    renderRatio();
    renderLast();
    $('brewTitle').textContent = brewId ? methodOf(method).label : `${methodOf(method).label}: new try`;
    $('brewSave').textContent = brewId ? 'Save' : 'Log it';
    $('brewExtra').hidden = !brewId;
    sheet.open();
    shownAs = formState();
  }

  const api = {
    /**
     * Returns false when there's no coffee yet.
     * @param {{ method: string, beanId?: string | null, from?: Brew | null }} options
     */
    open(options) {
      if (!startNew(options)) return false;
      show();
      return true;
    },

    edit(id) {
      const brew = getBrews().find((b) => b.id === id);
      if (!brew) return;
      brewId = brew.id;
      method = brew.method;
      picked = brew.beanId;
      renderBeans(brew.beanId);
      grind.value = brew.grind;
      grind.placeholder = '';
      dose.value = brew.dose != null ? num(brew.dose) : '';
      out.value = brew.out != null ? num(brew.out) : '';
      temp.value = brew.temp != null ? num(brew.temp) : '';
      setSeconds(brew.seconds);
      verdict = brew.verdict;
      comment.value = brew.comment;
      $('brewDate').textContent = `Brewed ${dateTime(brew.brewedAt)}`;
      show();
    },

    refresh() {
      if (!sheet.isOpen) return;
      if (brewId && !getBrew()) {
        brewId = null;
        sheet.close({ force: true });
        toast('That brew was deleted');
        return;
      }
      renderBeans(bean.value);
      if (!getBeans().length) sheet.close({ force: true });
    },
  };
  return api;
}
