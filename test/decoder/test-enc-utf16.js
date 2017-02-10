const { testError, testOutput } = require('./halp-decoder');

testOutput({
  bytes: [ 0x50, 0x00, 0x6F, 0x00, 0x6F, 0x00, 0x70, 0x00, 0xFA, 0xFD ],
  expected: 'Poopﷺ',
  name: 'decode utf16le (one byte codepoints)',
  opts: { encoding: 'utf16le' }
});

testOutput({
  bytes: [ 0x00, 0x50, 0x00, 0x6F, 0x00, 0x6F, 0x00, 0x70, 0xFD, 0xFA ],
  expected: 'Poopﷺ',
  name: 'decode utf16be (one byte codepoints)',
  opts: { encoding: 'utf16be' }
});

testOutput({
  bytes: [ 0x3C, 0xD8, 0x25, 0xDC, 0x3C, 0xD8, 0x1A, 0xDC ],
  expected: '🀥🀚',
  name: 'decode utf16le (two byte codepoints)',
  opts: { encoding: 'utf16le' }
});

testOutput({
  bytes: [ 0xD8, 0x3C, 0xDC, 0x25, 0xD8, 0x3C, 0xDC, 0x1A ],
  expected: '🀥🀚',
  name: 'decode utf16be (two byte codepoints)',
  opts: { encoding: 'utf16be' }
});

testOutput({
  bytes: [ 0xFE, 0xFF, 0x50, 0x00, 0x6F, 0x00, 0x6F, 0x00, 0x70, 0x00 ],
  expected: 'Poop',
  name: 'decode utf16 (LE with BOM)',
  opts: { encoding: 'utf16' }
});

testOutput({
  bytes: [ 0xFF, 0xFE, 0x00, 0x50, 0x00, 0x6F, 0x00, 0x6F, 0x00, 0x70 ],
  expected: 'Poop',
  name: 'decode utf16 (BE with BOM)',
  opts: { encoding: 'utf16' }
});

testOutput({
  bytes: [ 0xFE, 0xFF, 0x50, 0x00, 0x6F, 0x00, 0x6F, 0x00, 0x70, 0x00 ],
  expected: 'Poop',
  name: 'decode utf16 (LE with BOM, autosniffed)'
});

testOutput({
  bytes: [ 0xFF, 0xFE, 0x00, 0x50, 0x00, 0x6F, 0x00, 0x6F, 0x00, 0x70 ],
  expected: 'Poop',
  name: 'decode utf16 (BE with BOM, autosniffed)'
});

testOutput({
  bytes: [
    [ 0xFF, 0xFE, 0x00, 0x50, 0xD8 ],
    [ 0x3C, 0xDC ],
    [ 0x25, 0xD8, 0x3C ],
    [ 0xDC, 0x1A ]
  ],
  expected: 'P🀥🀚',
  name: 'handle utf16 continuations across buffer chunks'
});

testError({
  bytes: [ 0x1A, 0xDC, 0x3C, 0xD8 ],
  match: /0xDC1A/i,
  name: 'utf16 shits bed on bad initial surrogate',
  opts: { encoding: 'utf16le' }
});

testError({
  bytes: [ 0x3C, 0xD8, 0x3C, 0xD8 ],
  match: /0xD83C/i,
  name: 'utf16 shits bed on bad continuation surrogate',
  opts: { encoding: 'utf16le' }
});

testError({
  bytes: [ 0xFF, 0xFE, 0xD8, 0x3C, 0xDC, 0x25, 0xD8, 0x3C, 0xDC, 0x1A ],
  match: /0xD83C/i,
  name: 'ucs2 shits bed on any surrogate',
  opts: { encoding: 'ucs2' }
});
