#!/usr/bin/env node
// Bean There: your coffee beans, and every espresso and pour over you brew with them.
import http from 'node:http';
import https from 'node:https';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { normalizeState } from './coffee/state.js';
import { JsonFileStore } from './store.js';
import { readTls, watchTls } from './tls.js';

const config = loadConfig();
const store = new JsonFileStore(config.stateFile);
const state = normalizeState(store.load());

const app = createApp({ config, state, store });
const servers = [http.createServer(app.handle)];

servers[0].listen(config.port, config.host, () => {
  console.log(`Bean There ${config.version}`);
  console.log(`  Open:     http://localhost:${config.port}/`);
  console.log(`  Coffee:   ${config.stateFile} (${state.beans.length} beans, ${state.brews.length} brews)`);
});

// Optional https, so Android can install the app. http keeps working either way.
if (config.httpsPort && config.tlsCert && config.tlsKey) {
  try {
    const secure = https.createServer(readTls(config), app.handle);
    secure.on('error', (err) => console.warn(`https not available: ${err.message}`));
    secure.listen(config.httpsPort, config.host, () => console.log(`  Secure:   https on port ${config.httpsPort}`));
    watchTls(secure, config);
    servers.push(secure);
  } catch (err) {
    console.warn(`https not available: ${err.message}`);
  }
}

// Save anything pending and close connections before exiting (Ctrl+C, add-on stop).
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  store.flush();
  app.hub.close();
  let open = servers.length;
  for (const server of servers) server.close(() => { if (--open === 0) process.exit(0); });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
