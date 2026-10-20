// Paths are relative so the app works behind Home Assistant ingress.

async function readJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function sendAction(action) {
  const res = await fetch('api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  return readJson(res);
}

/**
 * Reloads the page if the server version changes, so old code never runs against a new server.
 * @param {(view: any) => void} onView
 * @param {(connected: boolean) => void} [onConnection]
 */
export function subscribe(onView, onConnection = (_connected) => {}) {
  let version = null;
  const events = new EventSource('api/events');
  events.onopen = () => onConnection(true);
  events.onerror = () => onConnection(false);
  events.onmessage = (event) => {
    const view = JSON.parse(event.data);
    if (version && view.version !== version) {
      location.reload();
      return;
    }
    version = view.version;
    onView(view);
  };
  return events;
}
