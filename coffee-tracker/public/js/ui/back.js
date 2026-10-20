// The phone's back button closes the last opened sheet instead of leaving the page.

const handlers = [];

window.addEventListener('popstate', () => handlers.pop()?.());

export function pushBack(onBack) {
  handlers.push(onBack);
  history.pushState({ depth: handlers.length }, '');
}

export function goBack() {
  history.back();
}
