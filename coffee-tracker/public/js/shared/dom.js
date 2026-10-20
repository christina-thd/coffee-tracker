/**
 * @param {string} id
 * @returns {HTMLElement}
 */
export const $ = (id) => document.getElementById(id);

/**
 * @param {Event} event
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
export const closest = (event, selector) => /** @type {Element} */ (event.target).closest(selector);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
