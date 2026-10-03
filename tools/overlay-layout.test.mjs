// The two defects this file owns were both invisible to source-only tests.
//
// 1. `#record-readout` carries `hidden` and the script writes it, but a later
//    `display: block` in styles.css outranks the user agent's `[hidden] { display: none }`.
//    The attribute read as `true` in every journey while a stray plate sat over the caption
//    on screen for the whole session.
// 2. The caption and the shaft log were both absolutely positioned at hand-picked offsets.
//    A two-line caption reached into the readout exactly when the readout had something to
//    say, and no unit test could see it because nothing was wrong with either element.
//
// So this reads the real stylesheet and the real document and asserts the structural rules
// that keep both fixed, rather than trusting that a rule someone wrote is still there.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Every rule block, as `{ selectors, body }`, with the trailing `@media` wrappers flattened
// so a rule nested in a breakpoint is checked exactly like a top-level one. Comments are
// stripped first so a commented-out rule cannot satisfy a rule we think is live.
function rules(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('@'));
    if (selectors.length) found.push({ selectors, body: match[2] });
  }
  return found;
}

const declarations = rules(css);

// Property values for every rule that names a selector, in source order. Returns raw
// strings, because a regex that tries to decide "is this `absolute`" while matching the
// property name will happily match `position: ` and stop before the value.
function valuesOf(selector, property) {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'g');
  const found = [];
  for (const rule of declarations.filter((r) => r.selectors.includes(selector)))
    for (const match of rule.body.matchAll(pattern))
      found.push(match[1].trim());
  return found;
}

const displayOf = (selector) => valuesOf(selector, 'display');
const positionOf = (selector) => valuesOf(selector, 'position');

// The ids index.html ships as `hidden`. These are the elements the script is entitled to
// reveal and conceal, so the stylesheet must never override the attribute that conceals
// them.
const hiddenIds = [...html.matchAll(/id="([\w-]+)"[^>]*\shidden/g)].map((m) => m[1]);

test('the document actually ships elements the script reveals and conceals', () => {
  assert.ok(
    hiddenIds.length >= 4,
    `only found ${hiddenIds.length} hidden elements in index.html`,
  );
  for (const id of ['memory', 'help', 'settings', 'record-readout'])
    assert.ok(hiddenIds.includes(id), `${id} is expected to ship hidden`);
});

test('no rule outranks the hidden attribute on an element the script conceals', () => {
  for (const id of hiddenIds) {
    // A rule on the id itself is more specific than the user agent's `[hidden]` rule, so
    // if the stylesheet sets any display value there it owes the document a matching
    // `[hidden]` reset - and the reset has to win.
    const displays = displayOf(`#${id}`).filter((v) => v !== 'none');
    if (!displays.length) continue;
    assert.ok(
      displayOf(`#${id}[hidden]`).includes('none'),
      `#${id} sets display: ${displays.join('/')} and has no #[hidden] { display: none } rule`,
    );
  }
});

test('the shaft instrument is laid out by its column, not by an offset a caption can reach', () => {
  // `position: absolute` plus a hardcoded `bottom` is what let the caption and the readout
  // collide. The instrument now sits in `#field-notes` and grows upward from one gap.
  assert.ok(
    html.includes('id="field-notes"'),
    'the caption column that replaced the two magic offsets is gone from index.html',
  );
  for (const r of declarations.filter((r) =>
    r.selectors.includes('#record-readout'),
  ))
    assert.ok(
      !/position\s*:\s*absolute/.test(r.body),
      'the shaft readout is absolutely positioned again; it can overlap the caption',
    );
  const column = declarations.filter((r) => r.selectors.includes('#field-notes'));
  assert.ok(column.length >= 1, 'the caption column has no rule');
  const anchors = column.map((r) => r.body).join(';');
  assert.match(anchors, /position\s*:\s*absolute/, 'the column is not positioned');
  assert.match(anchors, /display\s*:\s*flex/, 'the column does not stack its children');
  // The column has to be pinned on both horizontal sides and on the bottom, or one of its
  // children can still reach outside it. A breakpoint may retune those anchors; a
  // breakpoint may not unset them, so no rule naming the column may reposition it.
  for (const side of ['left', 'right', 'bottom'])
    assert.match(anchors, new RegExp(`${side}\\s*:`), `the column has no ${side} anchor`);
  const positions = positionOf('#field-notes');
  assert.ok(positions.length >= 1, 'the column declares no position');
  for (const value of positions)
    assert.equal(
      value,
      'absolute',
      'the caption column was taken back out of absolute placement',
    );
});

test('the caption keeps its own width and is not positioned against a second offset', () => {
  const status = declarations.filter((r) => r.selectors.includes('#status'));
  assert.ok(status.length >= 1, '#status has no rule');
  for (const r of status)
    assert.ok(
      !/position\s*:\s*absolute/.test(r.body),
      '#status is absolutely positioned again instead of living in the caption column',
    );
});
