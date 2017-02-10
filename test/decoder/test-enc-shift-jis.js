const { testError, testOutput } = require('./halp-decoder');

testOutput({
  bytes: [ 0x50, 0x6F, 0x6F, 0x70 ],
  expected: 'Poop',
  name: 'decodes shift JIS (ascii range)',
  opts: { encoding: 'Shift_JIS' }
});

testOutput({
  bytes: [ 0xC4, 0xC4, 0xDB ],
  expected: 'ﾄﾄﾛ',
  name: 'decodes shift JIS (half-width kana)',
  opts: { encoding: 'Shift_JIS' }
});

testOutput({
  bytes: [ 0x89, 0xBF, 0x8A, 0x69 ],
  expected: '価格',
  name: 'decodes shift JIS (double byte characters)',
  opts: { encoding: 'Shift_JIS' }
});

testOutput({
  bytes: [ [ 0x50, 0x6F, 0x6F, 0x70, 0x89, 0xBF, 0x8A ], [ 0x69 ] ],
  expected: 'Poop価格',
  name: 'handles continuations across chunk boundaries in shift JIS',
  opts: { encoding: 'Shift_JIS' }
});

testError({
  bytes: [ 0x89, 0x00 ],
  match: /0x8900/i,
  name: 'emits appropriate error for bad continuation in shift JIS',
  opts: { encoding: 'Shift_JIS' }
});
