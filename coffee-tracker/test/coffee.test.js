// The helpers shared by the server and the page (public/js/shared/coffee.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bagIdsOf, costOf, formatDuration, goodSettings, isDate, latestBrew, parseNumber, ratio, sameCoffee,
} from '../public/js/shared/coffee.js';

test('numbers as typed on a phone', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('  '), null);
  assert.equal(parseNumber('18'), 18);
  assert.equal(parseNumber('18.5'), 18.5);
  assert.equal(parseNumber('18,5'), 18.5);
  assert.equal(parseNumber('.5'), 0.5);
  assert.ok(Number.isNaN(parseNumber('18g')));
  assert.ok(Number.isNaN(parseNumber('-1')));
  assert.ok(Number.isNaN(parseNumber('1.2.3')));
});

test('durations: seconds for a shot, minutes for a pour over', () => {
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(28), '28s');
  assert.equal(formatDuration(60), '1:00');
  assert.equal(formatDuration(185), '3:05');
});

test('ratios', () => {
  assert.equal(ratio(18, 36), '1:2');
  assert.equal(ratio(18, 40), '1:2.2');
  assert.equal(ratio(15, 250), '1:16.7');
  assert.equal(ratio(null, 36), '');
  assert.equal(ratio(0, 36), '');
});

test('dates', () => {
  assert.ok(isDate('2026-10-08'));
  assert.ok(isDate('2024-02-29'));
  assert.ok(!isDate('2026-02-29'));
  assert.ok(!isDate('2026-13-01'));
  assert.ok(!isDate('8/10/2026'));
  assert.ok(!isDate(20261008));
});

test('the latest brew matching a bean, method and verdict', () => {
  const brews = /** @type {any[]} */ ([
    { id: 'a', beanId: 'x', method: 'espresso', verdict: 'good', brewedAt: 1 },
    { id: 'b', beanId: 'x', method: 'espresso', verdict: 'sour', brewedAt: 3 },
    { id: 'c', beanId: 'y', method: 'espresso', verdict: 'good', brewedAt: 4 },
    { id: 'd', beanId: 'x', method: 'pourover', verdict: 'good', brewedAt: 5 },
  ]);
  assert.equal(latestBrew(brews, { beanId: 'x', method: 'espresso' }).id, 'b');
  assert.equal(latestBrew(brews, { beanId: 'x', method: 'espresso', verdict: 'good' }).id, 'a');
  assert.equal(latestBrew(brews, { method: 'espresso' }).id, 'c');
  assert.equal(latestBrew(brews, { beanId: 'z' }), undefined);
});

test('another bag of the same coffee: same name and roaster, ignoring case', () => {
  const bean = /** @type {any} */ ({ name: 'Ethiopia Guji', roaster: 'Coffee Island' });
  assert.ok(sameCoffee(bean, { ...bean, name: 'ethiopia guji' }));
  assert.ok(!sameCoffee(bean, { ...bean, roaster: 'Someone else' }));
  assert.ok(!sameCoffee(bean, { ...bean, name: 'Kenya' }));
});

test('good settings of some bags: one per grind, dose and yield, counted, newest first', () => {
  const brew = (id, beanId, grind, verdict, brewedAt, method = 'espresso') =>
    ({ id, beanId, method, grind, dose: 18, out: 36, verdict, brewedAt });
  const brews = /** @type {any[]} */ ([
    brew('a', 'bag1', '10', 'good', 1),
    brew('b', 'bag2', '10', 'good', 5),
    brew('c', 'bag2', '11', 'good', 3),
    brew('d', 'bag2', '12', 'sour', 6),
    brew('e', 'other', '9', 'good', 7),
    brew('f', 'bag2', '24', 'good', 8, 'pourover'),
  ]);
  const found = goodSettings(brews, { beanIds: new Set(['bag1', 'bag2']), method: 'espresso' });
  assert.deepEqual(found.map((g) => [g.brew.id, g.count]), [['b', 2], ['c', 1]]);
});

test('every bag of a coffee', () => {
  const beans = /** @type {any[]} */ ([
    { id: '1', name: 'Guji', roaster: 'R' }, { id: '2', name: 'guji', roaster: 'r' }, { id: '3', name: 'Kenya', roaster: 'R' },
  ]);
  assert.deepEqual([...bagIdsOf(beans, beans[1])], ['1', '2']);
});

test('what a cup costs', () => {
  const bean = /** @type {any} */ ({ price: 15, weight: 250 });
  assert.equal(costOf(bean, 18), 1.08);
  assert.equal(costOf({ ...bean, weight: null }, 18), null);
  assert.equal(costOf({ ...bean, price: null }, 18), null);
  assert.equal(costOf(bean, null), null);
});
