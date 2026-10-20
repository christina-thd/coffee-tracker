import { $, escapeHtml } from '../shared/dom.js';
import { icon as iconHtml } from './icons.js';

let timer = null;

$('toast').addEventListener('click', hide);

function hide() {
  clearTimeout(timer);
  $('toast').classList.remove('show');
}

/**
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

export const toastError = (err) => toast(err.message, { error: true });
