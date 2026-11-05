'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseHex,
  toHex,
  ratio,
  formatRatio,
  bestPossible,
  nearestPassing,
  suggestions,
} = require('../contrast.js');

const c = (hex) => parseHex(hex);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.005, `${actual} is not close to ${expected}`);

test('parseHex accepts 3 and 6 digits, with or without #, in any case', () => {
  assert.deepEqual(parseHex('#ffffff'), [255, 255, 255]);
  assert.deepEqual(parseHex('FFF'), [255, 255, 255]);
  assert.deepEqual(parseHex('#1a2B3c'), [26, 43, 60]);
  assert.deepEqual(parseHex('  #abc  '), [170, 187, 204]);
});

test('parseHex rejects everything else', () => {
  for (const bad of ['', '#', '#12', '#1234', '#12345', '#1234567', '#12345678', 'ggg', '##fff', 'red']) {
    assert.equal(parseHex(bad), null, bad);
  }
});

test('toHex is the uppercase, zero-padded inverse of parseHex', () => {
  assert.equal(toHex([0, 10, 255]), '#000AFF');
});

test('ratio matches known WCAG values', () => {
  close(ratio(c('#000'), c('#fff')), 21);
  close(ratio(c('#fff'), c('#fff')), 1);
  close(ratio(c('#777'), c('#fff')), 4.48);
  close(ratio(c('#767676'), c('#fff')), 4.54);
  close(ratio(c('#595959'), c('#fff')), 7);
  close(ratio(c('#f00'), c('#fff')), 4);
});

test('ratio is symmetric', () => {
  assert.equal(ratio(c('#123456'), c('#fedcba')), ratio(c('#fedcba'), c('#123456')));
});

test('formatRatio truncates so a failing value never reads as passing', () => {
  assert.equal(formatRatio(4.499), '4.49');
  assert.equal(formatRatio(6.9999), '6.99');
  assert.equal(formatRatio(2.999), '2.99');
  assert.equal(formatRatio(4.5), '4.50');
  assert.equal(formatRatio(ratio(c('#000'), c('#fff'))), '21.00');
  assert.equal(formatRatio(ratio(c('#fff'), c('#fff'))), '1.00');
});

test('nearestPassing returns a colour that really passes', () => {
  const pairs = [
    ['#E8590C', '#FFFFFF'],
    ['#FFFF00', '#FFFFFF'],
    ['#777777', '#808080'],
    ['#123456', '#000000'],
    ['#00FF00', '#FF0000'],
    ['#FFFFFF', '#FFFFFF'],
    ['#000000', '#000000'],
  ];
  for (const [fg, bg] of pairs) {
    for (const min of [3, 4.5, 7]) {
      const found = nearestPassing(c(fg), c(bg), min);
      if (found) assert.ok(ratio(found, c(bg)) >= min, `${fg} on ${bg} at ${min}`);
      else assert.ok(bestPossible(c(bg)).ratio < min, `${fg} on ${bg} at ${min} gave up early`);
    }
  }
});

test('nearestPassing leaves an already-passing foreground alone', () => {
  assert.deepEqual(nearestPassing(c('#000'), c('#fff'), 7), c('#000'));
});

test('nearestPassing lands right at the threshold, not far past it', () => {
  const found = nearestPassing(c('#E8590C'), c('#FFFFFF'), 4.5);
  assert.ok(ratio(found, c('#FFFFFF')) < 4.6, toHex(found));
});

test('nearestPassing keeps a grey foreground grey', () => {
  assert.equal(toHex(nearestPassing(c('#999999'), c('#FFFFFF'), 4.5)), '#767676');
  assert.equal(toHex(nearestPassing(c('#CCCCCC'), c('#FFFFFF'), 7)), '#595959');
});

test('nearestPassing goes to whichever side of the background is closer', () => {
  const darkOnDark = nearestPassing(c('#333333'), c('#222222'), 4.5);
  assert.ok(ratio(darkOnDark, c('#000')) > ratio(c('#222222'), c('#000')));
  const lightOnLight = nearestPassing(c('#EEEEEE'), c('#FFFFFF'), 4.5);
  assert.ok(ratio(lightOnLight, c('#000')) < ratio(c('#FFFFFF'), c('#000')));
});

test('suggestions cover only the thresholds that fail', () => {
  assert.deepEqual(suggestions(c('#000'), c('#fff')), []);
  // #767676 on white is 4.54:1, so only 7:1 is missing.
  assert.deepEqual(suggestions(c('#767676'), c('#fff')).map((s) => s.min), [7]);
  assert.deepEqual(suggestions(c('#fff'), c('#fff')).map((s) => s.min), [3, 4.5, 7]);
});

test('every suggestion passes its threshold', () => {
  const list = suggestions(c('#E8590C'), c('#FFFFFF'));
  for (const s of list) assert.ok(s.ratio >= s.min);
});

test('an unreachable threshold reports the best achievable colour instead', () => {
  // Mid grey: neither black nor white reaches 7:1.
  const [unreachable] = suggestions(c('#777777'), c('#777777')).filter((s) => s.min === 7);
  assert.equal(unreachable.color, null);
  assert.ok(unreachable.best.ratio < 7);
  assert.deepEqual(unreachable.best.color, c('#000'));
});

test('4.5:1 is reachable on every background', () => {
  for (let v = 0; v <= 255; v += 1) {
    assert.ok(bestPossible([v, v, v]).ratio >= 4.5, `grey ${v}`);
  }
});
