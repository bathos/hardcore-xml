const tap     = require('tap');
const Decoder = require('../../.').Decoder;

const { testError, testOutput } = require('./halp-decoder');

testOutput({
  bytes: [ 0x50, 0x6F, 0x6F, 0x70, 0xF0, 0x9F, 0x92, 0xA9 ],
  expected: 'Poop💩',
  name: 'decoder assumes utf8 in abscence of contrary signals'
});

testOutput({
  bytes: [ 0x3C, 0x00, 0x00, 0x00, 0xA9, 0xF4, 0x01, 0x00 ],
  expected: '<💩',
  name: 'decoder sniffs UTF four-byte encoding if it sees "<"'
});

testOutput({
  bytes: [ 0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x00, 0x00, 0x00 ],
  expected: '<',
  name: 'decoder is okay with user-specified encoding if it matches BOM',
  opts: { encoding: 'utf32le' }
});

testOutput({
  bytes: [ 0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x00, 0x00, 0x00 ],
  expected: '<',
  name: 'decoder is okay if user-specified encoding does not contradict BOM',
  opts: { encoding: 'utf32' }
});

testError({
  bytes: [ 0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x00, 0x00, 0x00 ],
  match: /bom-indicated/i,
  name: 'decoder barfs if BOM contradicts user-specified encoding',
  opts: { encoding: 'utf32be' }
});

testError({
  bytes: [ 0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x00, 0x00, 0x00 ],
  match: /bom-indicated/i,
  name: 'decoder barfs if BOM contradicts user-specified encoding',
  opts: { encoding: 'utf32be' }
});

testError({
  bytes: [ 0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x00, 0x00 ],
  match: /abrupt/i,
  name: 'decoder barfs if input ends abruptly'
});

tap.test('decoder allows setting encoding after sniffing', test => {
  const decoder = new Decoder();
  const res = [];

  let failed;

  decoder.on('codepoint', cp => res.push(cp));

  decoder.on('error', err => {
    if (!failed) {
      test.error(err);
      test.end();
      failed = true;
    }
  });

  decoder.on('finish', () => {
    if (!failed) {
      test.equal(String.fromCodePoint(...res), 'Poop価格');
      test.end();
    }
  });

  decoder.write(Buffer.from([ 0x50, 0x6F, 0x6F, 0x70 ]));

  decoder.setXMLEncoding('Shift_JIS', 'declared');

  decoder.end(Buffer.from([ 0x89, 0xBF, 0x8A, 0x69 ]));
});

tap.test('decoder barfs on encoding change if not superset of seen', test => {
  const decoder = new Decoder();

  decoder.write(Buffer.from([ 0x50, 0xC3, 0xB6, 0xC3, 0xB6, 0x70 ]));

  try {
    decoder.setXMLEncoding('Shift_JIS', 'declared');
  } catch (err) {
    test.match(err.message, /Shift_JIS/i);
    test.match(err.message, /UTF8/i);
    test.end();
  }
});

tap.test('decoder barfs on unrecognized encoding', test => {
  try {
    new Decoder({ encoding: 'balls' });
  } catch (err) {
    test.match(err.message, /balls/i);
    test.end();
  }
});

tap.test('decoder barfs on change between codepages', test => {
  const decoder = new Decoder({ encoding: 'arabic' });

  try {
    decoder.setXMLEncoding('greek', 'declared');
  } catch (err) {
    test.match(err.message, /greek/i);
    test.end();
  }
});

tap.test('decoder barfs on change between word lengths', test => {
  const decoder = new Decoder();

  decoder.write(Buffer.from([ 0x3C, 0x00, 0x00, 0x00 ]));

  try {
    decoder.setXMLEncoding('utf16', 'declared');
  } catch (err) {
    test.match(err.message, /utf16/i);
    test.end();
  }
});
