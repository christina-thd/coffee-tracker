// Tracks the visible viewport so sheets sit above the on-screen keyboard instead of under it.

const FIELD_MARGIN_PX = 16;

function scrollerOf(el) {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

/**
 * A sheet shrinks when the keyboard opens but keeps its scroll position, so a field low in it would end up under its
 * bottom edge (or the Save button stuck there): scroll it back into view.
 */
function keepFieldInView() {
  const field = document.activeElement;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  const scroller = scrollerOf(field);
  if (!scroller) return;
  const box = scroller.getBoundingClientRect();
  const rect = field.getBoundingClientRect();
  const save = scroller.querySelector(':scope > button[type="submit"]');
  const bottom = Math.min(box.bottom, save ? save.getBoundingClientRect().top : Infinity) - FIELD_MARGIN_PX;
  if (rect.bottom > bottom) scroller.scrollTop += rect.bottom - bottom;
  else if (rect.top < box.top + FIELD_MARGIN_PX) scroller.scrollTop -= box.top - rect.top + FIELD_MARGIN_PX;
}

const TEXT_INPUTS = ['text', 'search', 'number', 'email', 'url', 'tel', 'password', 'date'];

const isField = (el) => el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
  || (el instanceof HTMLInputElement && TEXT_INPUTS.includes(el.type));

/** html.typing while a field is focused (css/base.css). */
function trackTyping() {
  const update = () => document.documentElement.classList.toggle('typing', isField(document.activeElement));
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => setTimeout(update));   // once the next field (if any) has focus
}

export function trackVisibleViewport() {
  trackTyping();
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement.style;

  function update() {
    root.setProperty('--viewport-top', `${viewport.offsetTop}px`);
    root.setProperty('--viewport-height', `${viewport.height}px`);
    requestAnimationFrame(keepFieldInView);         // once the sheet has its new size
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);      // iOS pans the page when the keyboard opens
  update();

  // a Home Screen app on iPhone can start with the visible part measured wrong until the page scrolls once
  if (/** @type {any} */ (navigator).standalone) {
    const settle = () => {
      const { scrollY } = window;
      window.scrollTo(0, scrollY + 1);
      window.scrollTo(0, scrollY);
      update();
    };
    window.addEventListener('load', () => requestAnimationFrame(settle), { once: true });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) requestAnimationFrame(settle);
    });
  }
}
