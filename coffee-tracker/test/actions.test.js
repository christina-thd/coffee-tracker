import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ActionError, ACTION_TYPES, applyAction } from '../src/coffee/actions.js';
import { createInitialState } from '../src/coffee/state.js';

const NOW = 1_700_000_000_000;

function setup() {
  const state = createInitialState();
  const { beanId } = applyAction(state, { type: 'addBean', name: 'Ethiopia Guji' }, NOW);
  return { state, beanId };
}

const rejects = (state, action, status = 400) => {
  const before = JSON.stringify(state);
  assert.throws(() => applyAction(state, action, NOW), (err) => err instanceof ActionError && err.status === status);
  assert.equal(JSON.stringify(state), before, 'a rejected action changes nothing');
};

describe('beans', () => {
  test('a new bean has its name, the fields given, and nothing else filled in', () => {
    const state = createInitialState();
    const { beanId } = applyAction(state, {
      type: 'addBean', name: '  Ethiopia   Guji ', roaster: 'Coffee Island', origin: 'Ethiopia', process: 'natural',
      roast: 'light', roastFor: 'pourover', roastedOn: '2026-09-28', shop: 'The shop', price: 14.5, weight: 250,
      flavor: 'Blueberry', notes: 'Line one\r\nLine two',
    }, NOW);
    assert.deepEqual(state.beans[0], {
      id: beanId, name: 'Ethiopia Guji', roaster: 'Coffee Island', origin: 'Ethiopia', variety: '', shop: 'The shop',
      flavor: 'Blueberry', process: 'natural', roast: 'light', roastFor: 'pourover', roastedOn: '2026-09-28', price: 14.5,
      weight: 250, notes: 'Line one\nLine two', finished: false, createdAt: NOW,
    });
  });

  test('a name is required', () => {
    const state = createInitialState();
    rejects(state, { type: 'addBean' });
    rejects(state, { type: 'addBean', name: '   ' });
  });

  test('bad values are rejected', () => {
    const { state, beanId } = setup();
    rejects(state, { type: 'editBean', beanId, roast: 'burnt' });
    rejects(state, { type: 'editBean', beanId, roastFor: 'turkish' });
    rejects(state, { type: 'editBean', beanId, roastFor: 'omni' });
    rejects(state, { type: 'editBean', beanId, process: 'fermented in a sock' });
    rejects(state, { type: 'editBean', beanId, price: -1 });
    rejects(state, { type: 'editBean', beanId, price: '14' });
    rejects(state, { type: 'editBean', beanId, weight: 1e9 });
    rejects(state, { type: 'editBean', beanId, roastedOn: '2026-02-31' });
    rejects(state, { type: 'editBean', beanId, finished: 'yes' });
    rejects(state, { type: 'editBean', beanId, name: 'Fine', roaster: 42 });   // nothing is set, not even the name
    rejects(state, { type: 'editBean', beanId: 'ghost', name: 'x' }, 404);
  });

  test('editing changes only the fields given; null or "" clears an optional one', () => {
    const { state, beanId } = setup();
    applyAction(state, { type: 'editBean', beanId, price: 12, roast: 'dark' });
    applyAction(state, { type: 'editBean', beanId, price: null, roaster: 'Someone' });
    applyAction(state, { type: 'editBean', beanId, roast: '' });
    const bean = state.beans[0];
    assert.equal(bean.name, 'Ethiopia Guji');
    assert.equal(bean.price, null);
    assert.equal(bean.roast, null);
    assert.equal(bean.roaster, 'Someone');
  });

  test('a finished bag is kept, and can be back in use', () => {
    const { state, beanId } = setup();
    applyAction(state, { type: 'editBean', beanId, finished: true });
    assert.equal(state.beans[0].finished, true);
    applyAction(state, { type: 'editBean', beanId, finished: false });
    assert.equal(state.beans[0].finished, false);
  });

  test('removing a bean removes its brews, and only its', () => {
    const { state, beanId } = setup();
    const { beanId: other } = applyAction(state, { type: 'addBean', name: 'Brazil' }, NOW);
    applyAction(state, { type: 'addBrew', beanId, method: 'espresso' }, NOW);
    applyAction(state, { type: 'addBrew', beanId, method: 'pourover' }, NOW);
    applyAction(state, { type: 'addBrew', beanId: other, method: 'espresso' }, NOW);
    assert.deepEqual(applyAction(state, { type: 'removeBean', beanId }), { removedBrews: 2 });
    assert.deepEqual(state.beans.map((b) => b.id), [other]);
    assert.deepEqual(state.brews.map((b) => b.beanId), [other]);
  });
});

describe('brews', () => {
  test('a brew has its bean, method and numbers', () => {
    const { state, beanId } = setup();
    const { brewId } = applyAction(state, {
      type: 'addBrew', beanId, method: 'espresso', grind: ' 12 ', dose: 18, out: 36.456, seconds: 28, temp: 93,
      verdict: 'sour', comment: 'Thin',
    }, NOW);
    assert.deepEqual(state.brews[0], {
      id: brewId, beanId, method: 'espresso', grind: '12', dose: 18, out: 36.46, seconds: 28, temp: 93,
      verdict: 'sour', comment: 'Thin', brewedAt: NOW,
    });
  });

  test('only the bean and method are required', () => {
    const { state, beanId } = setup();
    applyAction(state, { type: 'addBrew', beanId, method: 'pourover' }, NOW);
    const brew = state.brews[0];
    assert.equal(brew.grind, '');
    assert.equal(brew.dose, null);
    assert.equal(brew.verdict, null);
    rejects(state, { type: 'addBrew', beanId });
    rejects(state, { type: 'addBrew', method: 'espresso' });
    rejects(state, { type: 'addBrew', beanId: 'ghost', method: 'espresso' }, 404);
    rejects(state, { type: 'addBrew', beanId, method: 'french press' });
  });

  test('numbers must be in range, verdicts known', () => {
    const { state, beanId } = setup();
    rejects(state, { type: 'addBrew', beanId, method: 'espresso', dose: 500 });
    rejects(state, { type: 'addBrew', beanId, method: 'espresso', seconds: Infinity });
    rejects(state, { type: 'addBrew', beanId, method: 'espresso', temp: 101 });
    rejects(state, { type: 'addBrew', beanId, method: 'espresso', verdict: 'meh' });
  });

  test('brewedAt can put an undone delete back as it was, but not in the future', () => {
    const { state, beanId } = setup();
    applyAction(state, { type: 'addBrew', beanId, method: 'espresso', brewedAt: NOW - 1000 }, NOW);
    assert.equal(state.brews[0].brewedAt, NOW - 1000);
    rejects(state, { type: 'addBrew', beanId, method: 'espresso', brewedAt: NOW + 1000 });
  });

  test('editing changes the fields given, the bean and method too', () => {
    const { state, beanId } = setup();
    const { beanId: other } = applyAction(state, { type: 'addBean', name: 'Brazil' }, NOW);
    const { brewId } = applyAction(state, { type: 'addBrew', beanId, method: 'espresso', grind: '12', dose: 18 }, NOW);
    applyAction(state, { type: 'editBrew', brewId, beanId: other, method: 'pourover', verdict: 'good', dose: null });
    assert.deepEqual(
      { beanId: state.brews[0].beanId, method: state.brews[0].method, grind: state.brews[0].grind, dose: state.brews[0].dose, verdict: state.brews[0].verdict },
      { beanId: other, method: 'pourover', grind: '12', dose: null, verdict: 'good' },
    );
    rejects(state, { type: 'editBrew', brewId, method: null });
    rejects(state, { type: 'editBrew', brewId, beanId: 'ghost' }, 404);
  });

  test('removing a brew', () => {
    const { state, beanId } = setup();
    const { brewId } = applyAction(state, { type: 'addBrew', beanId, method: 'espresso' }, NOW);
    applyAction(state, { type: 'removeBrew', brewId });
    assert.equal(state.brews.length, 0);
    rejects(state, { type: 'removeBrew', brewId }, 404);
  });
});

test('clearing a coffee\'s tries of one method, with all its bags; the beans and other tries stay', () => {
  const { state, beanId } = setup();
  const { beanId: bag2 } = applyAction(state, { type: 'addBean', name: 'Ethiopia Guji' }, NOW);
  const { beanId: other } = applyAction(state, { type: 'addBean', name: 'Kenya' }, NOW);
  for (const [bean, method] of [[beanId, 'espresso'], [bag2, 'espresso'], [beanId, 'pourover'], [other, 'espresso']]) {
    applyAction(state, { type: 'addBrew', beanId: bean, method }, NOW);
  }
  assert.deepEqual(applyAction(state, { type: 'clearBrews', beanIds: [beanId, bag2], method: 'espresso' }), { removed: 2 });
  assert.deepEqual(state.brews.map((b) => [b.beanId, b.method]), [[beanId, 'pourover'], [other, 'espresso']]);
  assert.equal(state.beans.length, 3);
  rejects(state, { type: 'clearBrews', beanIds: [], method: 'espresso' });
  rejects(state, { type: 'clearBrews', beanIds: [beanId], method: 'aeropress' });
  rejects(state, { type: 'clearBrews', beanIds: [beanId] });
  rejects(state, { type: 'clearBrews', beanIds: ['ghost'], method: 'espresso' }, 404);
});

test('unknown actions and non-objects are rejected', () => {
  const state = createInitialState();
  rejects(state, { type: 'dropTheBeans' });
  rejects(state, null);
  assert.ok(ACTION_TYPES.includes('addBrew'));
});
