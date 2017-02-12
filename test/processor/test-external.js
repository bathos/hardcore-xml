const tap   = require('tap');
const parse = require('../../.').parse;

const parseHalp = opts => parse(opts.input, {
  dereference: ({ systemID }) => ({ entity: opts[systemID] })
});

tap.test('External DTD is dereferenced', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo/>
    `,
    foo: `
      <!ELEMENT foo EMPTY>
    `
  }).then(([ doctype, elem ]) => {
      test.equal(doctype.external.length, 1);
      test.equal(doctype.external[0].contentSpec, 'EMPTY');
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});
