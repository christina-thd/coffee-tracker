// Line icons (24×24, drawn with the current text color; css/base.css styles svg.icon).

const PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  offline: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.6M19 12.9a10 10 0 0 0-2.2-1.6M2 9.3a15 15 0 0 1 4.3-2.8M22 9.3A15 15 0 0 0 10.5 5.1"/><path d="M12 20h.01"/>',
  // a coffee bean
  bean: '<ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(35 12 12)"/><path d="M8.2 17.6c2.6-2 1.4-5.4 3.8-7.2s3.6-3.2 3.8-4.6"/>',
  // a small cup: espresso
  espresso: '<path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2 2 0 0 1 0 4H16M4 21h14M9 3.5c0 1 1 1.5 1 2.5M12.5 3.5c0 1 1 1.5 1 2.5"/>',
  // a dripper over a carafe: pour over
  pourover: '<path d="M5 4h14l-4.5 8h-5z"/><path d="M12 12v2M8 15h8l1 6H7z"/>',
  // the grinder's setting: a burr, the part that grinds
  grind: '<path d="M12 3l1.6 2.2 2.6-.8.4 2.7 2.6.9-.9 2.6L20 12l-1.7 2.4.9 2.6-2.6.9-.4 2.7-2.6-.8L12 21l-1.6-2.2-2.6.8-.4-2.7-2.6-.9.9-2.6L4 12l1.7-2.4-.9-2.6 2.6-.9.4-2.7 2.6.8z"/><circle cx="12" cy="12" r="3"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  // try again
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7"/>',
  archive:'<path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4"/>',
};

/** An icon as HTML, e.g. icon('plus'). */
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}

/**
 * Puts each tab's icon in front of it (the tabs and the brew sheet's method picker). Runs once at start: the markup is
 * in index.html.
 * @param {ParentNode} root
 */
export function addTabIcons(root) {
  for (const el of root.querySelectorAll('[data-tab], [data-method]')) {
    if (!(el instanceof HTMLElement) || el.matches('.column')) continue;
    const name = el.dataset.tab === 'beans' ? 'bean' : (el.dataset.tab ?? el.dataset.method);
    el.insertAdjacentHTML('afterbegin', icon(name));
  }
}
