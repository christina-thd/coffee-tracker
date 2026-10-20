// Tracks the visible viewport so sheets sit above the on-screen keyboard instead of under it.

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
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);      // iOS pans the page when the keyboard opens
  update();
}
