const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('empty attlist permitted', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo>
    ]>

    <foo/>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared element with declared attribute (CDATA)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #IMPLIED
      >
    ]>

    <foo bar="baz"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('existing required attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #REQUIRED
      >
    ]>

    <foo bar="baz"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('missing required attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #REQUIRED
      >
    ]>

    <foo/>
  `).catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});

tap.test('fixed attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #FIXED "baz"
      >
    ]>

    <foo bar="baz"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('incorrect fixed attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #FIXED "baz"
      >
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});

tap.test('existing attribute which had default', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA "baz"
      >
    ]>

    <foo bar="qux"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'qux');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('supplying of attribute default', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA "baz"
      >
    ]>

    <foo/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('default must match grammatical constraints even if unused', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar NMTOKEN '#baz'
      >
    ]>

    <foo/>
  `).catch(err => {
    test.match(err.message, 'NMTOKEN');
    test.end();
  });
});

tap.test('default need not match other VCs if never used', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar ENTITY 'baz'
      >
      <!NOTATION corge PUBLIC "grault">
      <!ENTITY qux SYSTEM "garply" NDATA corge>
    ]>

    <foo bar="qux"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'qux');
    })
    .catch(test.error)
    .then(test.end);
});
