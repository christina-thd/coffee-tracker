import { $, escapeHtml } from '../shared/dom.js';
import { icon as iconHtml } from './icons.js';

let timer = null;

// a tap dismisses it
$('toast').addEventListener('click', hide);

function hide() {
  clearTimeout(timer);
  $('toast').classList.remove('show');
}

/**
 * A short message saying what was done, near the bottom of the screen, always in the same place: above the + button,
 * and above a sheet's Save button (--toast-lift in css/base.css). It has no buttons: it only tells. Tapping it
 * dismisses it. The page needs <div class="toast" id="toast">.
 * `icon` (an icons.js name, e.g. 'check') shows in front of it.
 * @param {string} message
 * @param {{ error?: boolean, icon?: string | null }} [options]
 */
export function toast(message, { error = false, icon = null } = {}) {
  const el = $('toast');
  const iconSpan = icon ? `<span class="toast-icon">${iconHtml(icon)}</span>` : '';
  el.innerHTML = `${iconSpan}<span class="toast-text">${escapeHtml(message)}</span>`;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(hide, error ? 4000 : 2600);
}

/** Shows an error from a failed request. */
export const toastError = (err) => toast(err.message, { error: true });
