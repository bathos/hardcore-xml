const { testOutput } = require('./halp-decoder');

testOutput({
  bytes: Buffer.from('a\rb\rc\r'),
  expected: 'a\nb\nc\n',
  name: 'decoder normalizes CR to LF'
});

testOutput({
  bytes: Buffer.from('a\r\nb\rc\n\r'),
  expected: 'a\nb\nc\n\n',
  name: 'decoder normalizes CR+LF to LF'
});
