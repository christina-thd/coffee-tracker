import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { ROOT_DIR } from '../src/config.js';
import { createInitialState } from '../src/coffee/state.js';
import { JsonFileStore } from '../src/store.js';

let server;
let app;
let base;
let dir;
let state;
let store;
let beanId;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-http-'));
  const config = {
    version: 'test', currency: '€', stateFile: path.join(dir, 'coffee.json'), publicDir: path.join(ROOT_DIR, 'public'),
  };
  state = createInitialState();
  store = new JsonFileStore(config.stateFile, { debounceMs: 0 });
  app = createApp({ config, state, store, logger: { error() {} } });
  server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  app.hub.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (body) => fetch(`${base}/api/actions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('pages and static files', () => {
  test('the page, modules, styles and images are served with the right types', async () => {
    for (const [url, type] of [['/', 'text/html'], ['/js/app.js', 'text/javascript'], ['/js/coffee/board.js', 'text/javascript'],
      ['/js/shared/coffee.js', 'text/javascript'], ['/css/base.css', 'text/css'], ['/img/logo.svg', 'image/svg']]) {
      const res = await fetch(base + url);
      assert.equal(res.status, 200, url);
      assert.match(res.headers.get('content-type'), new RegExp(type));
      assert.equal(res.headers.get('cache-control'), 'no-cache', url);
    }
  });

  test('every script and stylesheet the page links to exists', async () => {
    const html = await (await fetch(base)).text();
    const links = [...html.matchAll(/(?:src|href)="((?:js|css|img)\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3);
    for (const link of links) assert.equal((await fetch(`${base}/${link}`)).status, 200, link);
  });

  test('every module the page imports exists', async () => {
    const seen = new Set();
    const visit = async (file) => {
      if (seen.has(file)) return;
      seen.add(file);
      const res = await fetch(`${base}/${file}`);
      assert.equal(res.status, 200, file);
      const source = await res.text();
      for (const [, spec] of source.matchAll(/^import .* from '(\.[^']+)';$/gm)) {
        await visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
      }
    };
    await visit('js/app.js');
    assert.ok(seen.size > 5);
  });

  test('cannot read files outside public/', async () => {
    for (const url of ['/js/../../package.json', '/js/%2e%2e/%2e%2e/package.json', '/css/..%2F..%2Fsrc/app.js', '/js/%E0%A4%A']) {
      const res = await fetch(base + url);
      assert.ok([400, 404].includes(res.status), `${url} → ${res.status}`);
    }
  });

  test('unknown paths are 404', async () => {
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  });

  test('the web app manifest and its icons exist', async () => {
    const res = await fetch(`${base}/manifest.webmanifest`);
    assert.match(res.headers.get('content-type'), /application\/manifest\+json/);
    const manifest = await res.json();
    assert.equal(manifest.start_url, './');                // relative: works behind Home Assistant ingress
    for (const icon of manifest.icons) assert.equal((await fetch(`${base}/${icon.src}`)).status, 200, icon.src);
  });

  test('info has the version', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/info`)).json(), { version: 'test' });
  });
});

describe('actions API', () => {
  test('adding a bean and a brew saves them', async () => {
    ({ beanId } = await (await post({ type: 'addBean', name: 'Ethiopia Guji', price: 14.5 })).json());
    const res = await post({ type: 'addBrew', beanId, method: 'espresso', grind: '12', dose: 18, out: 36, seconds: 28, verdict: 'good' });
    assert.equal(res.status, 200);
    store.flush();
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'coffee.json'), 'utf8'));
    assert.equal(saved.beans[0].name, 'Ethiopia Guji');
    assert.equal(saved.beans[0].price, 14.5);
    assert.equal(saved.brews[0].grind, '12');
    assert.equal(saved.brews[0].verdict, 'good');
  });

  test('rejects bad input with a clear error', async () => {
    for (const [body, status] of [['{ nope', 400], [{ type: 'deleteEverything' }, 400], [{ type: 'removeBrew', brewId: 'ghost' }, 404],
      [{ type: 'addBrew', beanId, method: 'espresso', dose: 'lots' }, 400]]) {
      const res = await post(body);
      assert.equal(res.status, status);
      assert.ok((await res.json()).error);
    }
  });

  test('a body that is too large is refused', async () => {
    const res = await post({ type: 'addBean', name: 'x'.repeat(20_000) }).catch(() => null);
    assert.ok(!res || res.status === 413);
  });

  test('only POST is allowed', async () => {
    assert.equal((await fetch(`${base}/api/actions`)).status, 405);
  });
});

describe('live updates', () => {
  test('a new connection immediately receives the beans, brews and currency', async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/api/events`, { signal: controller.signal });
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    const { value } = await reader.read();
    controller.abort();
    const view = JSON.parse(new TextDecoder().decode(value).replace(/^data: /, ''));
    assert.equal(view.version, 'test');
    assert.equal(view.currency, '€');
    assert.ok(Array.isArray(view.beans));
    assert.ok(Array.isArray(view.brews));
  });

  test('open screens receive every change', async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/api/events`, { signal: controller.signal });
    const reader = res.body.getReader();
    await reader.read();                                       // the view on connect
    await post({ type: 'addBean', name: 'Live' });
    const { value } = await reader.read();
    controller.abort();
    const view = JSON.parse(new TextDecoder().decode(value).replace(/^data: /, ''));
    assert.ok(view.beans.some((b) => b.name === 'Live'));
  });
});
