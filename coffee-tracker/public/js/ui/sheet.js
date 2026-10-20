// Stackable bottom sheets: [data-close] closes on tap, dragging [data-drag] down closes too.
import { closest } from '../shared/dom.js';
import { goBack, pushBack } from './back.js';

const DRAG_START_PX = 8;            // so taps still work
const CLOSE_DISTANCE_PX = 110;
const CLOSE_SPEED = 0.6;            // px per ms

let open = 0;
const stack = [];

function enableDragToClose(panel, close) {
  let drag = null;
  let justDragged = false;

  panel.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !closest(e, '[data-drag]')) return;
    drag = { id: e.pointerId, startY: e.clientY, startTime: e.timeStamp, moved: false, dy: 0 };
  });

  panel.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = Math.max(0, e.clientY - drag.startY);
    if (!drag.moved) {
      if (dy < DRAG_START_PX) return;
      drag.moved = true;
      try {
        panel.setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone
      }
      panel.classList.add('dragging');
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.();   // hide the keyboard
    }
    drag.dy = dy;
    panel.style.transform = `translateY(${dy}px)`;
  });

  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, dy, startTime } = drag;
    drag = null;
    if (!moved) return;
    justDragged = true;                              // the click that follows isn't a tap
    panel.classList.remove('dragging');
    const speed = dy / Math.max(1, e.timeStamp - startTime);
    if (dy > CLOSE_DISTANCE_PX || speed > CLOSE_SPEED) {
      panel.style.transform = 'translateY(100%)';
      close();
    } else {
      panel.style.transform = '';
    }
  }
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);

  panel.addEventListener('click', (e) => {
    if (!justDragged) return;
    justDragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

/**
 * @param {HTMLElement} layer
 * @param {{ onClose?: () => void }} [options]
 */
export function createSheet(layer, { onClose } = {}) {
  const panel = /** @type {HTMLElement} */ (layer.querySelector('.sheet'));
  let isOpen = false;
  let closing = false;              // going back is async: don't go back twice

  function hide() {
    isOpen = false;
    closing = false;
    stack.splice(stack.indexOf(sheet), 1);
    if (--open === 0) document.body.classList.remove('locked');
    layer.classList.remove('open');
    const done = () => {
      if (isOpen) return;
      layer.hidden = true;
      panel.style.transform = '';
    };
    panel.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400);                          // if transitionend never fires
    onClose?.();
  }

  const sheet = {
    get isOpen() {
      return isOpen;
    },

    open() {
      if (isOpen) return;
      isOpen = true;
      open++;
      stack.push(sheet);
      pushBack(hide);
      document.body.classList.add('locked');
      panel.style.transform = '';
      layer.hidden = false;
      void panel.offsetHeight;                      // force reflow so it slides in
      layer.classList.add('open');
    },

    /** Closes through history, so open()'s entry goes away too. */
    close() {
      if (!isOpen || closing) return;
      closing = true;
      goBack();
    },
  };

  layer.addEventListener('click', (e) => {
    if (closest(e, '[data-close]')) sheet.close();
  });
  enableDragToClose(panel, () => sheet.close());

  return sheet;
}

export function closeTopSheet() {
  stack.at(-1)?.close();
}
