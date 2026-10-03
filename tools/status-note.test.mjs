import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STATUS_FLASH_MAX_SECONDS,
  STATUS_FLASH_SECONDS,
  flashStatus,
  settleStatus,
} from '../src/status-note.js';

const line = (text = '') => ({ textContent: text });

test('a flash says its piece and then hands the line back', () => {
  const element = line('Follow the shore.');
  let flash = flashStatus(element, 'Render scale 85%.');
  assert.equal(element.textContent, 'Render scale 85%.');
  // Still speaking one frame before its time is up.
  flash = settleStatus(element, flash, STATUS_FLASH_SECONDS - 1 / 60);
  assert.ok(flash, 'flash ended early');
  assert.equal(element.textContent, 'Render scale 85%.');
  // And silent once it is not.
  flash = settleStatus(element, flash, 1 / 6);
  assert.equal(flash, null);
  assert.equal(element.textContent, 'Follow the shore.');
});

test('a flash does not eat a message someone else wrote while it stood in', () => {
  const element = line('Explore at your own pace.');
  let flash = flashStatus(element, 'Render scale 85%.');
  // Something with more right to the line - a repair, a rest, a refusal - speaks next.
  element.textContent = 'Five quiet minutes.';
  flash = settleStatus(element, flash, STATUS_FLASH_SECONDS + 1);
  assert.equal(flash, null);
  assert.equal(element.textContent, 'Five quiet minutes.');
});

test('repeated flinches keep the original line, not the previous notice', () => {
  // This is the defect the browser run exposed: adaptation flinches 100 -> 85 -> 70 on a
  // slow machine, and nesting made the caption restore a stale scale number forever.
  const element = line('Follow the shore. The stone doorway leads to the Listening Basin.');
  let flash = flashStatus(element, 'Render scale 85%.');
  flash = settleStatus(element, flash, 1);
  flash = flashStatus(element, 'Render scale 70%.', flash);
  flash = settleStatus(element, flash, 1);
  flash = flashStatus(element, 'Render scale 55%.', flash);
  assert.equal(element.textContent, 'Render scale 55%.');
  flash = settleStatus(element, flash, STATUS_FLASH_SECONDS + 1);
  assert.equal(flash, null);
  assert.equal(
    element.textContent,
    'Follow the shore. The stone doorway leads to the Listening Basin.',
  );
});

test('a later flinch cannot reclaim a line that a newer message superseded', () => {
  const element = line('Follow the shore.');
  let flash = flashStatus(element, 'Render scale 85%.');
  element.textContent = 'Five quiet minutes.';
  const sameFlash = flashStatus(element, 'Render scale 70%.', flash);
  assert.equal(sameFlash, flash, 'a superseded flash should remain only as its expiry token');
  assert.equal(element.textContent, 'Five quiet minutes.');
  flash = settleStatus(element, sameFlash, STATUS_FLASH_SECONDS + 1);
  assert.equal(flash, null);
  assert.equal(element.textContent, 'Five quiet minutes.');
});

test('a flash is bounded, so a hitched tab still returns the caption', () => {
  const element = line('a');
  const flash = flashStatus(element, 'b', null, 10_000);
  assert.ok(flash.remaining <= STATUS_FLASH_MAX_SECONDS);
  assert.ok(flash.remaining > 0);
  const short = flashStatus(element, 'c', null, -5);
  assert.ok(short.remaining > 0, 'a negative request must still be a visible notice');
});

test('settle is a no-op with no flash, and tolerates a bad dt', () => {
  const element = line('kept');
  assert.equal(settleStatus(element, null, 1), null);
  const flash = flashStatus(element, 'notice');
  const still = settleStatus(element, flash, Number.NaN);
  assert.equal(still, flash, 'a non-finite step must not consume the notice');
  assert.equal(element.textContent, 'notice');
});
