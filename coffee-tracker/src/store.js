import fs from 'node:fs';
import path from 'node:path';

// Debounced, atomic (temp + rename) writes; an unparseable file is moved aside, not lost.
export class JsonFileStore {
  #file;
  #debounceMs;
  #logger;
  #pending = null;
  #timer = null;

  /**
   * @param {string} file
   * @param {{ debounceMs?: number, logger?: Pick<Console, 'warn'> }} [options]
   */
  constructor(file, { debounceMs = 300, logger = console } = {}) {
    this.#file = file;
    this.#debounceMs = debounceMs;
    this.#logger = logger;
  }

  load() {
    let text;
    try {
      text = fs.readFileSync(this.#file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      const aside = `${this.#file}.corrupt-${Date.now()}`;
      fs.renameSync(this.#file, aside);
      this.#logger.warn(`Could not read ${this.#file}; moved it to ${aside} and starting fresh.`);
      return null;
    }
  }

  save(document) {
    this.#pending = document;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.flush(), this.#debounceMs);
    this.#timer.unref?.();
  }

  flush() {
    clearTimeout(this.#timer);
    if (!this.#pending) return;
    const document = this.#pending;
    this.#pending = null;
    fs.mkdirSync(path.dirname(this.#file), { recursive: true });
    const temp = `${this.#file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(document));
    fs.renameSync(temp, this.#file);
  }
}
