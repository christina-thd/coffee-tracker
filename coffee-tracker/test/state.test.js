import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState, normalizeState, SCHEMA_VERSION, toView } from '../src/coffee/state.js';

const NOW = 1_700_000_000_000;

test('nothing saved yet, or something unreadable, is an empty tracker', () => {
  for (const raw of [null, 'text', 42, {}, { beans: 'no' }]) assert.deepEqual(normalizeState(raw, NOW), createInitialState());
});

test('a saved tracker comes back as it was', () => {
  const saved = {
    schema: SCHEMA_VERSION,
    beans: [{
      id: 'abc', name: 'Guji', roaster: 'R', origin: 'O', variety: 'V', shop: 'S', flavor: 'F', process: 'washed',
      roast: 'medium', roastFor: 'espresso', roastedOn: '2026-09-01', price: 12.5, weight: 250, notes: 'n', finished: true, createdAt: NOW - 5,
    }],
    brews: [{
      id: 'def', beanId: 'abc', method: 'pourover', grind: '24', dose: 15, out: 250, seconds: 190, temp: 94,
      verdict: 'good', comment: 'c', brewedAt: NOW - 1,
    }],
  };
  assert.deepEqual(normalizeState(structuredClone(saved), NOW), saved);
});

test('odd values are repaired, unusable entries dropped', () => {
  const state = normalizeState({
    beans: [
      { id: 'abc', name: '  Guji  ', roast: 'burnt', roastFor: 'turkish', price: -3, weight: '250', roastedOn: 'yesterday', finished: 'yes' },
      { id: 'abc', name: 'Duplicate id' },
      { name: '' },
      'not a bean',
    ],
    brews: [
      { id: 'b1', beanId: 'abc', method: 'espresso', dose: 1e6, verdict: 'meh', grind: 12 },
      { id: 'b2', beanId: 'ghost', method: 'espresso' },
      { id: 'b3', beanId: 'abc', method: 'aeropress' },
    ],
  }, NOW);
  assert.equal(state.beans.length, 1);
  const [bean] = state.beans;
  assert.equal(bean.name, 'Guji');
  assert.equal(bean.roast, null);
  assert.equal(bean.roastFor, null);
  assert.equal(bean.price, null);
  assert.equal(bean.weight, null);
  assert.equal(bean.roastedOn, null);
  assert.equal(bean.finished, false);
  assert.equal(bean.createdAt, NOW);
  assert.equal(state.brews.length, 1);
  assert.deepEqual([state.brews[0].dose, state.brews[0].verdict, state.brews[0].grind], [null, null, '']);
});

test('the view has the version, currency, beans and brews', () => {
  const state = createInitialState();
  assert.deepEqual(toView(state, { version: '1.2.3', currency: '$' }), { version: '1.2.3', currency: '$', beans: [], brews: [] });
});
