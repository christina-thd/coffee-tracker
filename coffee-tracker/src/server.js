#!/usr/bin/env node
// Bean There: your coffee beans, and every espresso and pour over you brew with them.
import http from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { normalizeState } from './coffee/state.js';
import { JsonFileStore } from './store.js';

const config = loadConfig();
const store = new JsonFileStore(config.stateFile);
const state = normalizeState(store.load());

const app = createApp({ config, state, store });
const server = http.createServer(app.handle);

server.listen(config.port, config.host, () => {
  console.log(`Bean There ${config.version}`);
  console.log(`  Open:     http://localhost:${config.port}/`);
  console.log(`  Coffee:   ${config.stateFile} (${state.beans.length} beans, ${state.brews.length} brews)`);
});

// Save anything pending and close connections before exiting (Ctrl+C, add-on stop).
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  store.flush();
  app.hub.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
