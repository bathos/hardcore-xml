const tap = require('tap');
const CDATA = require('../../.').nodes.CDATA;

tap.test('CDATA: constructor', test => {
  const cdata = new CDATA({ text: 'foo' });

  test.equal(cdata.text, 'foo');
  test.equal(cdata.section, false);

  const cdataSection = new CDATA({ text: 'foo', section: true });

  test.equal(cdataSection.text, 'foo');
  test.equal(cdataSection.section, true);

  test.same(cdataSection.toJSON(), {
    nodeType: '#text',
    text: 'foo',
    section: true
  });

  test.done();
});

tap.test('CDATA validation', test => {
  test.doesNotThrow(() =>
    new CDATA({ text: 'foo' }).validate()
  );

  test.throws(() =>
    new CDATA().validate()
  );

  test.doesNotThrow(() =>
    new CDATA({ text: 'foo', section: true }).validate()
  );

  test.doesNotThrow(() =>
    new CDATA({ section: true }).validate()
  );

  test.doesNotThrow(() =>
    new CDATA({ text: ']]>' }).validate()
  );

  test.throws(() =>
    new CDATA({ text: ']]>', section: true }).validate()
  );

  test.throws(() =>
    new CDATA({ text: NaN }).validate()
  );

  test.throws(() =>
    new CDATA({ section: Infinity }).validate()
  );

  test.done();
});

tap.test('CDATA serialization', test => {
  const ipsum = `
    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
    tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
    quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
    consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse
    cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat
    non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
  `;

  test.equal(new CDATA({ text: 'foo & bar' }).serialize(), 'foo &amp; bar');

  test.equal(new CDATA({ text: 'foo]]>bar' }).serialize(), 'foo]]&gt;bar');

  test.match(
    new CDATA({ text: ipsum }).serialize(),
    /ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor\n/
  );

  test.match(
    new CDATA({ text: ipsum }).serialize({ wrapColumn: 40 }),
    /^Lorem ipsum dolor sit amet, consectetur\n/
  );

  test.match(
    new CDATA({ text: ipsum }).serialize({ depth: 1, wrapColumn: 40 }),
    /^  Lorem ipsum dolor sit amet,\n/
  );

  test.match(
    new CDATA({ text: ipsum }).serialize({ formatCDATA: false }),
    /eiusmod\n/
  );

  test.match(
    new CDATA({ section: true, text: ipsum }).serialize({ depth: 1 }),
    `  <![CDATA[${ ipsum }]]>`
  );

  test.done();
});
