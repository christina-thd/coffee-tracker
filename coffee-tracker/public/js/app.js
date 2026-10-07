// Entry point: keeps the latest beans and brews from the server and hands them to the views: the greeting, the tabs
// (espresso, pour over, beans) and the sheets. The server is the only source of truth; views never
// change anything locally, they send actions.
import { createBeanSheet } from './coffee/bean-sheet.js';
import { cardBagOf, PAGE, renderBoard, TABS, wireBoard } from './coffee/board.js';
import { createBrewSheet } from './coffee/brew-sheet.js';
import { renderHero } from './coffee/hero.js';
import { bagIdsOf, methodOf } from './shared/coffee.js';
import { sendAction, subscribe } from './shared/api.js';
import { $ } from './shared/dom.js';
import { storage } from './shared/storage.js';
import { addTabIcons, icon } from './ui/icons.js';
import { closeTopSheet } from './ui/sheet.js';
import { toast, toastError } from './ui/toast.js';
import { trackVisibleViewport } from './ui/viewport.js';

/** @type {import('./shared/coffee.js').Bean[]} */
let beans = [];
/** @type {import('./shared/coffee.js').Brew[]} */
let brews = [];
let currency = '€';
let loaded = false;
// what you were looking at, remembered on this device
let tab = TABS.includes(storage.get('coffee.tab')) ? storage.get('coffee.tab') : 'espresso';
let opened = {};                                 // per "method:beanId" (a coffee's card), how many tries show

const brewSheet = createBrewSheet({
  getBeans: () => beans,
  getBrews: () => brews,
  onDeleted: () => toast('Deleted', { icon: 'trash' }),
});
const beanSheet = createBeanSheet({
  getBeans: () => beans,
  getBrews: () => brews,
  getCurrency: () => currency,
  onLog: (method, beanId) => openBrew(method, beanId),
  // "See all tries" in a bean: that method's tab, with this coffee's tries open (the sheet closes first: one step back)
  onHistory: (method, beanId) => {
    beanSheet.close();
    const bean = beans.find((b) => b.id === beanId);
    if (!bean) return;
    const cardId = cardBagOf(beans, bean).id;
    opened = { ...opened, [`${method}:${cardId}`]: PAGE };
    setTab(method);
    requestAnimationFrame(() => document.querySelector(`.column[data-tab="${method}"] [data-coffee="${cardId}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  },
});

function setTab(name) {
  tab = name;
  storage.set('coffee.tab', name);
  render();
  window.scrollTo(0, 0);
}

/** A coffee's tries: open (its newest PAGE) or closed again. */
function toggleTries(method, beanId) {
  const key = `${method}:${beanId}`;
  const { [key]: shown, ...rest } = opened;
  opened = shown ? rest : { ...opened, [key]: PAGE };
  render();
}

// "Delete all tries": the first tap asks (for a few seconds), a second one deletes every try of that coffee made that
// way, with every bag of it
let clearing = null;                             // "method:beanId" asking, or null
let clearTimer = null;
function clearTries(method, beanId) {
  const key = `${method}:${beanId}`;
  clearTimeout(clearTimer);
  if (clearing !== key) {
    clearing = key;
    clearTimer = setTimeout(() => {
      clearing = null;
      render();
    }, 3000);
    return render();
  }
  clearing = null;
  const bean = beans.find((b) => b.id === beanId);
  if (!bean) return render();
  opened = { ...opened };                        // nothing left to show: closed
  delete opened[key];
  sendAction({ type: 'clearBrews', beanIds: [...bagIdsOf(beans, bean)], method })
    .then(() => toast('All tries deleted', { icon: 'trash' }))
    .catch(toastError);
  render();
}

/** "Show older" in a coffee's tries. */
function showOlder(method, beanId) {
  const key = `${method}:${beanId}`;
  opened = { ...opened, [key]: (opened[key] ?? 0) + PAGE };
  render();
}

function render() {
  if (!loaded) return;
  const any = beans.length > 0;
  $('welcome').hidden = any;
  for (const id of ['hero', 'tabs', 'board', 'addButton']) $(id).hidden = !any;
  renderHero();
  renderBoard({ beans, brews, currency, tab, opened, clearing });
  const label = tab === 'beans' ? 'Add a coffee' : `Log ${methodOf(tab).label.toLowerCase()}`;
  $('addButton').setAttribute('aria-label', label);
  $('addButton').title = label;
}

/** A new brew of `method`; with no coffee to brew yet, adding one comes first. */
function openBrew(method, beanId = null) {
  if (brewSheet.open({ method, beanId })) return;
  toast('Add a coffee first');
  beanSheet.open();
}

/** The + button: a coffee on the Beans tab, else a brew of the tab's method (of the coffee brewed last). */
function openAdd() {
  if (tab === 'beans') return beanSheet.open();
  openBrew(tab);
}

// ----- start -----

trackVisibleViewport();
addTabIcons(document);
$('firstBean').innerHTML = `${icon('plus')}<span>Add your first coffee</span>`;
$('firstBean').addEventListener('click', () => beanSheet.open());
$('addButton').innerHTML = icon('plus');
$('addButton').addEventListener('click', openAdd);

wireBoard({
  onTab: setTab,
  onLog: (method, beanId) => openBrew(method, beanId),
  onAgain: (brewId) => {
    const brew = brews.find((b) => b.id === brewId);
    if (brew) brewSheet.open({ method: brew.method, beanId: brew.beanId, from: brew });
  },
  onTries: toggleTries,
  onOlder: showOlder,
  onClear: clearTries,
  onOpenBrew: (id) => brewSheet.edit(id),
  onOpenBean: (id) => beanSheet.open(id),
});

// On a PC: Escape closes the open sheet (like the back button); "n" or "+" opens the + button's sheet
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (e.repeat) return;                          // held down: one sheet, not everything behind it
    return closeTopSheet();
  }
  if (e.key !== 'n' && e.key !== '+') return;
  if (e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains('locked')) return;
  if (/** @type {Element} */ (e.target).closest('input, textarea, select')) return;
  if ($('addButton').hidden) return;
  e.preventDefault();
  openAdd();
});

// "Good morning", "2d ago" and "3 days off roast" stay right while the page is open
setInterval(render, 60_000);

subscribe((view) => {
  beans = view.beans;
  brews = view.brews;
  currency = view.currency;
  loaded = true;
  render();
  brewSheet.refresh();
  beanSheet.refresh();
}, showConnection);

// The live connection drops now and then (phone screen off, switching apps, Wi-Fi): it reconnects by itself, so
// "Offline" only shows when it's been down a few seconds.
let offlineTimer = null;
function showConnection(connected) {
  clearTimeout(offlineTimer);
  if (connected) return document.body.classList.remove('offline');
  offlineTimer = setTimeout(() => document.body.classList.add('offline'), 4000);
}
$('offline').innerHTML = `${icon('offline')}<span>Offline</span>`;
