const { testError, testOutput } = require('./halp-decoder');

testOutput({
  bytes: [ 0x50, 0x6F, 0x6F, 0x70 ],
  expected: 'Poop',
  name: 'decode utf8 (one byte codepoints)',
  opts: { encoding: 'utf8' }
});

testOutput({
  bytes: [ 0xEF, 0xBB, 0xBF, 0x50, 0x6F, 0x6F, 0x70 ],
  expected: 'Poop',
  name: 'detects & strips utf8 ‘BOM’',
  opts: { encoding: 'utf8' }
});

testOutput({
  bytes: [ 0xC6, 0xA4, 0xC3, 0xB5, 0xD1, 0xB3, 0xCF, 0x81 ],
  expected: 'Ƥõѳρ',
  name: 'decode utf8 (two byte codepoints)',
  opts: { encoding: 'utf8' }
});

testOutput({
  bytes: [ 0xE1, 0x8F, 0xA2, 0xE1, 0x85, 0x98, 0xE1, 0xB4, 0x98 ],
  expected: 'Ꮲᅘᴘ',
  name: 'decode utf8 (three byte codepoints)',
  opts: { encoding: 'utf8' }
});

testOutput({
  bytes: [ 0xF0, 0x9F, 0x92, 0xA9, 0xF0, 0x9F, 0x92, 0xA9 ],
  expected: '💩💩',
  name: 'decode utf8 (four byte codepoints)',
  opts: { encoding: 'utf8' }
});

testOutput({
  bytes: [
    [ 0x50, 0x6F, 0x6F, 0x70, 0xC6 ],
    [ 0xA4, 0xC3, 0xB5, 0xD1, 0xB3, 0xCF, 0x81, 0xE1 ],
    [ 0x8F, 0xA2, 0xE1, 0x85, 0x98, 0xE1, 0xB4 ],
    [ 0x98, 0xF0, 0x9F, 0x92 ],
    [ 0xA9, 0xF0 ],
    [ 0x9F, 0x92, 0xA9 ]
  ],
  expected: 'PoopƤõѳρᏢᅘᴘ💩💩',
  name: 'handles continuations across buffer chunks in utf8',
  opts: { encoding: 'utf8' }
});

testError({
  bytes: [ 0xC6, 0x20 ],
  match: /0x20/i,
  name: 'barfs on bad utf8 continuation (non-continue byte)',
  opts: { encoding: 'utf8' }
});

testError({
  bytes: [ 0xC0, 0xAF ],
  match: /0xC0AF/i,
  name: 'barfs on bad utf8 continuation (derpy continuation byte 1)',
  opts: { encoding: 'utf8' }
});

testError({
  bytes: [ 0xE0, 0x80, 0xAF ],
  match: /0xE080AF/i,
  name: 'barfs on bad utf8 continuation (derpy continuation byte 2)',
  opts: { encoding: 'utf8' }
});

testError({
  bytes: [ 0xF0, 0x80, 0x80, 0xAF ],
  match: /0xF08080AF/i,
  name: 'barfs on bad utf8 continuation (derpy continuation byte 3)',
  opts: { encoding: 'utf8' }
});

testError({
  bytes: [ 0xFF ],
  match: /0xFF/i,
  name: 'barfs on illegal single utf8 byte',
  opts: { encoding: 'utf8' }
});
