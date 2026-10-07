import { randomBytes } from 'node:crypto';
import {
  idsOf, isDate, LIMITS, MAX_BEANS, MAX_BREWS, MAX_GRIND, MAX_NAME, MAX_NOTE, MAX_TEXT, METHOD_IDS, PROCESSES, ROAST_FOR,
  ROASTS, VERDICTS,
} from '../../public/js/shared/coffee.js';

/**
 * What's saved to disk (JSON): { schema, beans, brews }.
 *   beans  Bean[] (public/js/shared/coffee.js), in the order they were added
 *   brews  Brew[], each made with one bean
 */
export const SCHEMA_VERSION = 1;

/** A bean's one-line text fields (the name and notes have their own limits). */
export const BEAN_TEXT_FIELDS = Object.freeze(['roaster', 'origin', 'variety', 'shop', 'flavor']);

const ID = /^[a-f0-9]{1,32}$/;
const isId = (value) => typeof value === 'string' && ID.test(value);

export const newId = () => randomBytes(6).toString('hex');

export function createInitialState() {
  return { schema: SCHEMA_VERSION, beans: [], brews: [] };
}

export const findBean = (state, beanId) => state.beans.find((b) => b.id === beanId);
export const findBrew = (state, brewId) => state.brews.find((b) => b.id === brewId);

/** Text trimmed to `max` characters; '' for anything that isn't text. Line breaks are kept only when `multiline`. */
export function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  const text = multiline ? value.replace(/\r\n?/g, '\n') : value.replace(/\s+/g, ' ');
  return text.trim().slice(0, max).trim();
}

/** A number from 0 to `max`, to two decimals; null for anything else. */
export function cleanNumber(value, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
    ? Math.round(value * 100) / 100
    : null;
}

const pick = (value, list) => (idsOf(list).includes(value) ? value : null);
const toTime = (value, fallback) => (Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback);

/** A bean with nothing filled in yet (actions fill it in). */
export function emptyBean(now) {
  return {
    id: newId(),
    name: '',
    ...Object.fromEntries(BEAN_TEXT_FIELDS.map((field) => [field, ''])),
    process: null,
    roast: null,
    roastFor: null,
    roastedOn: null,
    price: null,
    weight: null,
    notes: '',
    finished: false,
    createdAt: now,
  };
}

/** A brew with nothing filled in yet. */
export function emptyBrew(now) {
  return {
    id: newId(),
    beanId: '',
    method: METHOD_IDS[0],
    grind: '',
    dose: null,
    out: null,
    seconds: null,
    temp: null,
    verdict: null,
    comment: '',
    brewedAt: now,
  };
}

function normalizeBean(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, MAX_NAME);
  if (!name) return null;
  return {
    id: isId(raw.id) ? raw.id : newId(),
    name,
    ...Object.fromEntries(BEAN_TEXT_FIELDS.map((field) => [field, cleanText(raw[field], MAX_TEXT)])),
    process: pick(raw.process, PROCESSES),
    roast: pick(raw.roast, ROASTS),
    roastFor: pick(raw.roastFor, ROAST_FOR),         // saved before there was one: null
    roastedOn: isDate(raw.roastedOn) ? raw.roastedOn : null,
    price: cleanNumber(raw.price, LIMITS.price),
    weight: cleanNumber(raw.weight, LIMITS.weight),
    notes: cleanText(raw.notes, MAX_NOTE, { multiline: true }),
    finished: raw.finished === true,
    createdAt: toTime(raw.createdAt, now),
  };
}

function normalizeBrew(raw, now, beanIds) {
  if (!raw || typeof raw !== 'object' || !beanIds.has(raw.beanId) || !METHOD_IDS.includes(raw.method)) return null;
  return {
    id: isId(raw.id) ? raw.id : newId(),
    beanId: raw.beanId,
    method: raw.method,
    grind: cleanText(raw.grind, MAX_GRIND),
    dose: cleanNumber(raw.dose, LIMITS.dose),
    out: cleanNumber(raw.out, LIMITS.out),
    seconds: cleanNumber(raw.seconds, LIMITS.seconds),
    temp: cleanNumber(raw.temp, LIMITS.temp),
    verdict: pick(raw.verdict, VERDICTS),
    comment: cleanText(raw.comment, MAX_NOTE, { multiline: true }),
    brewedAt: toTime(raw.brewedAt, now),
  };
}

/** The list without entries whose id came earlier (the first one is kept). */
function unique(list) {
  const seen = new Set();
  return list.filter((x) => !seen.has(x.id) && Boolean(seen.add(x.id)));
}

/** Turns whatever was read from disk into a valid current-schema state (unusable entries are dropped). */
export function normalizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.beans)) return createInitialState();
  const beans = unique(raw.beans.map((b) => normalizeBean(b, now)).filter(Boolean)).slice(0, MAX_BEANS);
  const beanIds = new Set(beans.map((b) => b.id));
  const brews = unique((Array.isArray(raw.brews) ? raw.brews : []).map((b) => normalizeBrew(b, now, beanIds)).filter(Boolean));
  return { schema: SCHEMA_VERSION, beans, brews: brews.slice(0, MAX_BREWS) };
}

/**
 * What every screen receives.
 * @param {{ version: string, currency: string }} config
 */
export function toView(state, config) {
  return { version: config.version, currency: config.currency, beans: state.beans, brews: state.brews };
}
