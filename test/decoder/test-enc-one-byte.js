const { testError, testOutput } = require('./halp-decoder');

testOutput({
  bytes: [ 0x50, 0x6F, 0x6F, 0x70 ],
  expected: 'Poop',
  name: 'decode ascii',
  opts: { encoding: 'ASCII' }
});

testOutput({
  bytes: [ 0xBB, 0xC3, 0xD0, 0xE0, 0xB7, 0xC8, 0xE4, 0xB7, 0xC2 ],
  expected: 'ประเทศไทย',
  name: 'decode using ISO 8859 codepages (e.g., thai)',
  opts: { encoding: 'ISO-8859-11' }
});

testOutput({
  bytes: [ 0xD1, 0xF2, 0xF0, 0xE0, 0xE2, 0xE8, 0xED, 0xF1, 0xEA, 0xE8, 0xE9 ],
  expected: 'Стравинский',
  name: 'decode using 125x codepages (e.g., cyrillic)',
  opts: { encoding: 'cp-1251' }
});

testOutput({
  bytes: [ 0x77, 0x61, 0x74 ],
  expected: 'wat',
  name: 'behaves correctly when given fewer than four bytes',
  opts: { encoding: 'ASCII' }
});

testError({
  bytes: [ 0x50, 0x6F, 0x6F, 0xFF ],
  match: /0xFF/i,
  name: 'emits appropriate error when encountering undefined byte',
  opts: { encoding: 'ASCII' }
});
