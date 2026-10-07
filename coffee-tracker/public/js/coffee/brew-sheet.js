// A brew: logging a new one, or changing or deleting one. A new brew starts from the last one of that coffee and
// method (grind, dose, yield, temperature), so dialing in is changing one number and saying how it tasted. Saved with
// the button; closing without it keeps nothing.
import { sendAction } from '../shared/api.js';
import { bagIdsOf, labelOf, latestBrew, methodOf, parseNumber, ratio, sameCoffee, VERDICTS } from '../shared/coffee.js';
import { $, closest, escapeHtml } from '../shared/dom.js';
import { agoText, dateTime, num } from '../shared/format.js';
import { icon } from '../ui/icons.js';
import { createSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { bagLabel, specsHtml } from './specs.js';

/** @typedef {import('../shared/coffee.js').Bean} Bean */
/** @typedef {import('../shared/coffee.js').Brew} Brew */

const input = (id) => /** @type {HTMLInputElement} */ ($(id));

/** A number field's value, or an error naming the field. */
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
  let touched = false;                             // a setting was typed: changing coffee or method keeps it
  let armed = false;                               // Delete tapped once: the next tap deletes
  let busy = false;

  const sheet = createSheet($('brewLayer'), {
    onClose: () => {
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
      brewId = null;
    },
  });

  const getBrew = () => getBrews().find((b) => b.id === brewId);

  /** The coffees to pick from: those in use, and the one picked (it may be finished). */
  function renderBeans(selected) {
    const options = getBeans().filter((b) => !b.finished || b.id === selected);
    bean.innerHTML = options.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}${b.roaster ? ` · ${escapeHtml(b.roaster)}` : ''}</option>`).join('');
    if (options.some((b) => b.id === selected)) bean.value = selected;
  }

  // ----- time: seconds for a shot, minutes and seconds for a pour over -----

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

  // ----- what's shown -----

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
    $('brewOutUnit').textContent = method === 'espresso' ? 'g' : 'ml';   // water: saved in grams, which is ml
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

  /**
   * The last brew of this coffee and method, to start from (new brews only); for a bag bought again with no brews
   * yet, the last brew of an earlier bag of it.
   */
  function lastOfBean() {
    const own = latestBrew(getBrews(), { beanId: bean.value, method });
    if (own) return own;
    return latestBrew(brewsOfBags(), { method });
  }

  /** This method's brews with any bag of the picked coffee. */
  function brewsOfBags() {
    const current = getBeans().find((b) => b.id === bean.value);
    if (!current) return [];
    const bags = bagIdsOf(getBeans(), current);
    return getBrews().filter((b) => b.method === method && bags.has(b.beanId));
  }

  /** The last brew that came out good with any bag of this coffee: shown, to go back to, when the last one wasn't. */
  const lastGood = () => latestBrew(brewsOfBags(), { verdict: 'good' });

  function renderLast() {
    const last = brewId ? null : lastOfBean();
    $('brewLast').hidden = !last;
    if (!last) return;
    const tasted = last.verdict ? ` <span class="verdict" data-verdict="${last.verdict}">${labelOf(VERDICTS, last.verdict)}</span>` : '';
    const hint = VERDICTS.find((v) => v.id === last.verdict)?.hint;
    const from = last.beanId === bean.value ? 'Last time' : 'Last bag';   // a bag bought again: its earlier bag's
    const good = last.verdict === 'good' ? null : lastGood();
    const goodHtml = good ? `<span class="last-good">
        <span class="last-label">Last good, ${agoText(good.brewedAt)}${good.beanId === bean.value ? '' : ` (${bagLabel(getBeans().find((b) => b.id === good.beanId))})`}</span>
        <span class="last-good-row"><span class="specs">${specsHtml(good)}</span>
          <button type="button" class="use-good" data-use="${good.id}">Use</button></span>
      </span>` : '';
    $('brewLast').innerHTML = `<span class="last-label">${from}, ${agoText(last.brewedAt)}</span>
      <span class="specs">${specsHtml(last)}${tasted}</span>${hint ? `<span class="last-hint">${icon('grind')}Try to ${hint}</span>` : ''}${goodHtml}`;
  }

  // "Use": the last good brew's settings, to start from
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
   * A new try's settings, all of them (time too), so trying again is changing what's different: copied from `from`
   * (a try picked to start from), else the last try of this coffee and method, else the last of this method (but not
   * its grind or time: another coffee's).
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
   * Fills the sheet for a new try (it isn't shown yet). Returns false when there's no coffee to brew.
   * @param {{ method: string, beanId?: string | null, from?: Brew | null }} options
   */
  function startNew({ method: startMethod, beanId: wanted = null, from = null }) {
    // a finished bag of a coffee bought again: the bag in use instead
    const given = getBeans().find((b) => b.id === wanted);
    const inUse = given?.finished ? getBeans().filter((b) => !b.finished && sameCoffee(b, given)).at(-1) : null;
    const beanId = inUse?.id ?? wanted;
    const active = getBeans().filter((b) => !b.finished || b.id === beanId);
    if (!active.length) return false;
    brewId = null;
    method = methodOf(startMethod).id;
    const lastBean = latestBrew(getBrews(), { method })?.beanId;
    const pick = [beanId, lastBean].find((id) => active.some((b) => b.id === id)) ?? active.at(-1).id;
    renderBeans(pick);
    verdict = null;
    touched = Boolean(from);                       // copied from a try: changing coffee or method keeps it
    comment.value = '';
    prefill(from);
    return true;
  }

  function disarm() {
    armed = false;
    remove.classList.remove('armed');
    remove.innerHTML = `${icon('trash')}<span>Delete</span>`;
  }

  // ----- events -----

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
    setSeconds(total);
    if (!brewId && !touched) prefill();
    renderLast();
  });

  bean.addEventListener('change', () => {
    if (!brewId && !touched) prefill();
    renderLast();
  });

  $('brewVerdict').addEventListener('click', (e) => {
    const button = closest(e, '[data-verdict]');
    if (!button) return;
    verdict = button.dataset.verdict === verdict ? null : button.dataset.verdict;   // tap again: not rated
    renderVerdict();
  });

  for (const field of [grind, minutes, seconds, dose, out, temp]) {
    field.addEventListener('input', () => {
      touched = true;
      renderRatio();
    });
    // the copied value is selected: typing replaces it, no deleting first
    field.addEventListener('focus', () => field.select());
  }

  // an existing try: a new one, starting from it
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
      sheet.close();
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
    sheet.close();
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
    sheet.open();                                  // already open (Try again from this): stays
  }

  const api = {
    /**
     * Opens for a new try of `method`, of `beanId` (else the coffee last used this way, else the newest), with every
     * setting copied from `from` (else from the last try of that coffee). Returns false when there's no coffee yet.
     * @param {{ method: string, beanId?: string | null, from?: Brew | null }} options
     */
    open(options) {
      if (!startNew(options)) return false;
      show();
      return true;
    },

    /** Opens an existing brew. */
    edit(id) {
      const brew = getBrews().find((b) => b.id === id);
      if (!brew) return;
      brewId = brew.id;
      method = brew.method;
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

    /** After a change: the coffees may differ, or the brew may be gone (deleted on another screen). */
    refresh() {
      if (!sheet.isOpen) return;
      if (brewId && !getBrew()) {
        brewId = null;
        sheet.close();
        toast('That brew was deleted');
        return;
      }
      renderBeans(bean.value);
      if (!bean.value) sheet.close();              // its coffee was deleted, and there's no other
    },
  };
  return api;
}
