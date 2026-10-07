import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parsePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * Environment variables (the Home Assistant add-on sets them in run.sh):
 *   PORT        port to listen on (default 3300)
 *   HOST        interface to bind (default all)
 *   STATE_FILE  where beans and brews are saved (default ./data/coffee.json)
 *   CURRENCY    the symbol prices are shown with (default €)
 */
export function loadConfig(env = process.env) {
  const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));

  return Object.freeze({
    version: pkg.version,
    port: parsePort(env.PORT) ?? 3300,
    host: env.HOST || '0.0.0.0',
    stateFile: env.STATE_FILE || path.join(ROOT_DIR, 'data', 'coffee.json'),
    publicDir: path.join(ROOT_DIR, 'public'),
    currency: env.CURRENCY?.trim().slice(0, 5) || '€',
  });
}
