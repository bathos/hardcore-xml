const tap = require('tap');
const PI = require('../../.').nodes.ProcessingInstruction;

tap.test('PI: constructor', test => {
  const pi = new PI({ target: 'foo', instruction: 'bar' });

  test.equal(pi.target, 'foo');
  test.equal(pi.instruction, 'bar');

  test.same(pi.toJSON(), {
    nodeType: '#pi',
    target: 'foo',
    instruction: 'bar'
  });

  test.done();
});

tap.test('PI validation', test => {
  test.doesNotThrow(() =>
    new PI({ target: 'foo' }).validate()
  );

  test.throws(() =>
    new PI({ target: 'xMl' }).validate()
  );

  test.doesNotThrow(() =>
    new PI({ target: 'xmlz' }).validate()
  );

  test.throws(() =>
    new PI().validate()
  );

  test.done();
});

tap.test('PI serialization', test => {
  test.equal(
    new PI({ target: 'foo', instruction: 'bar' }).serialize({ depth: 1 }),
    `  <?foo bar?>`
  );

  test.equal(
    new PI({ target: 'foo' }).serialize({ depth: 1 }),
    `  <?foo?>`
  );

  test.done();
});
