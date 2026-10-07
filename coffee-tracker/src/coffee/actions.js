import {
  idsOf, isDate, LIMITS, MAX_BEANS, MAX_BREWS, MAX_GRIND, MAX_NAME, MAX_NOTE, MAX_TEXT, METHODS, PROCESSES, ROAST_FOR,
  ROASTS, VERDICTS,
} from '../../public/js/shared/coffee.js';
import { BEAN_TEXT_FIELDS, cleanText, emptyBean, emptyBrew, findBean, findBrew } from './state.js';

/** A rejected action. `status` is the HTTP status the API answers with. */
export class ActionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ActionError';
    this.status = status;
  }
}

// ----- input helpers -----

function getBean(state, beanId) {
  const bean = findBean(state, beanId);
  if (!bean) throw new ActionError(`No bean ${beanId}`, 404);
  return bean;
}

function getBrew(state, brewId) {
  const brew = findBrew(state, brewId);
  if (!brew) throw new ActionError(`No brew ${brewId}`, 404);
  return brew;
}

function text(value, max, name, multiline = false) {
  if (value !== null && typeof value !== 'string') throw new ActionError(`${name} must be text`);
  return cleanText(value, max, { multiline });
}

/** An optional number (null or '' clears it) from 0 to its limit (LIMITS). */
function number(value, name) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > LIMITS[name]) {
    throw new ActionError(`${name} must be a number from 0 to ${LIMITS[name]}`);
  }
  return Math.round(value * 100) / 100;
}

/** An optional choice from one of the lists in shared/coffee.js (null or '' clears it). */
function choice(value, list, name) {
  if (value == null || value === '') return null;
  const allowed = idsOf(list);
  if (!allowed.includes(value)) throw new ActionError(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

/**
 * What each field of a bean or brew accepts: a check that returns the clean value or throws.
 * @type {Record<string, (value: any, state?: any) => any>}
 */
const BEAN_FIELDS = {
  name: (value) => {
    const name = text(value, MAX_NAME, 'name');
    if (!name) throw new ActionError('name is required');
    return name;
  },
  ...Object.fromEntries(BEAN_TEXT_FIELDS.map((field) => [field, (value) => text(value, MAX_TEXT, field)])),
  process: (value) => choice(value, PROCESSES, 'process'),
  roast: (value) => choice(value, ROASTS, 'roast'),
  roastFor: (value) => choice(value, ROAST_FOR, 'roastFor'),
  roastedOn: (value) => {
    if (value == null || value === '') return null;
    if (!isDate(value)) throw new ActionError('roastedOn must be a date (YYYY-MM-DD)');
    return value;
  },
  price: (value) => number(value, 'price'),
  weight: (value) => number(value, 'weight'),
  notes: (value) => text(value, MAX_NOTE, 'notes', true),
  finished: (value) => {
    if (typeof value !== 'boolean') throw new ActionError('finished must be true or false');
    return value;
  },
};

const BREW_FIELDS = {
  beanId: (value, state) => getBean(state, value).id,
  method: (value) => {
    if (value == null) throw new ActionError('method is required');
    return choice(value, METHODS, 'method');
  },
  grind: (value) => text(value, MAX_GRIND, 'grind'),
  dose: (value) => number(value, 'dose'),
  out: (value) => number(value, 'out'),
  seconds: (value) => number(value, 'seconds'),
  temp: (value) => number(value, 'temp'),
  verdict: (value) => choice(value, VERDICTS, 'verdict'),
  comment: (value) => text(value, MAX_NOTE, 'comment', true),
};

/**
 * Sets the fields given in `input` (the others stay as they are). Every field is checked before any is set, so a
 * rejected action changes nothing.
 */
function setFields(target, input, fields, state) {
  const changes = {};
  for (const [field, check] of Object.entries(fields)) {
    if (input[field] !== undefined) changes[field] = check(input[field], state);
  }
  return Object.assign(target, changes);
}

// ----- actions -----
// Each handler changes `state` in place and may return a result for the caller. `now` is the time of the action.

const handlers = {
  /** Adds a bean: a name, and any of the other fields (see Bean in shared/coffee.js). */
  addBean(state, input, now) {
    if (state.beans.length >= MAX_BEANS) throw new ActionError(`At most ${MAX_BEANS} beans: delete some finished ones first`);
    if (input.name === undefined) throw new ActionError('name is required');
    const bean = setFields(emptyBean(now), input, BEAN_FIELDS);
    state.beans.push(bean);
    return { beanId: bean.id };
  },

  /** Changes the fields given; e.g. { finished: true } when the bag is empty. */
  editBean(state, { beanId, ...input }) {
    setFields(getBean(state, beanId), input, BEAN_FIELDS);
  },

  /** Removes a bean and every brew made with it. */
  removeBean(state, { beanId }) {
    getBean(state, beanId);
    const before = state.brews.length;
    state.beans = state.beans.filter((b) => b.id !== beanId);
    state.brews = state.brews.filter((b) => b.beanId !== beanId);
    return { removedBrews: before - state.brews.length };
  },

  /**
   * Logs a brew of a bean: the method, and any of the other fields (see Brew in shared/coffee.js).
   * `brewedAt` is now, unless one is given (an undone delete puts a brew back as it was).
   */
  addBrew(state, input, now) {
    if (state.brews.length >= MAX_BREWS) throw new ActionError(`At most ${MAX_BREWS} brews`);
    if (input.beanId === undefined) throw new ActionError('beanId is required');
    const brew = setFields(emptyBrew(now), { ...input, method: input.method ?? null }, BREW_FIELDS, state);
    if (input.brewedAt != null) {
      if (!Number.isInteger(input.brewedAt) || input.brewedAt <= 0 || input.brewedAt > now) {
        throw new ActionError('brewedAt must be a time, not in the future');
      }
      brew.brewedAt = input.brewedAt;
    }
    state.brews.push(brew);
    return { brewId: brew.id };
  },

  /** Changes the fields given (the bean and method too: a brew logged on the wrong one). */
  editBrew(state, { brewId, ...input }) {
    setFields(getBrew(state, brewId), input, BREW_FIELDS, state);
  },

  removeBrew(state, { brewId }) {
    getBrew(state, brewId);
    state.brews = state.brews.filter((b) => b.id !== brewId);
  },

  /** Removes every brew of `method` made with any of `beanIds` (a coffee's bags); the beans stay. */
  clearBrews(state, { beanIds, method }) {
    if (!Array.isArray(beanIds) || !beanIds.length || beanIds.length > MAX_BEANS) {
      throw new ActionError('beanIds must be a list of beans');
    }
    for (const beanId of beanIds) getBean(state, beanId);
    if (method == null) throw new ActionError('method is required');
    choice(method, METHODS, 'method');
    const bags = new Set(beanIds);
    const before = state.brews.length;
    state.brews = state.brews.filter((b) => !(b.method === method && bags.has(b.beanId)));
    return { removed: before - state.brews.length };
  },
};

export const ACTION_TYPES = Object.freeze(Object.keys(handlers));

/**
 * Applies one action to the state (mutating it) and returns the handler's result.
 * Throws ActionError for anything invalid; the state is left unchanged in that case.
 */
export function applyAction(state, action, now = Date.now()) {
  if (!action || typeof action !== 'object') throw new ActionError('Action must be a JSON object');
  if (!Object.hasOwn(handlers, action.type)) throw new ActionError(`Unknown action: ${action.type}`);
  return handlers[action.type](state, action, now) ?? { ok: true };
}
