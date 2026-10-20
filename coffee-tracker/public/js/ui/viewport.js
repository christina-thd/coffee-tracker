// Tracks the visible viewport so sheets sit above the on-screen keyboard instead of under it.

export function trackVisibleViewport() {
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
