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

tap.test('ID, IDREF, IDREFS attributes behavior and normalization', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (foo?)>
      <!ATTLIST foo
        bar ID #REQUIRED
        baz IDREF #IMPLIED
        qux IDREFS #IMPLIED
      >
    ]>

    <foo bar="corge ">
      <foo
        bar="quux"
        baz="quux"
        qux="
          quux
          corge
        "
      />
    </foo>
  `).then(([ , fooA ]) => {
      const [ fooB ] = fooA;

      test.equal(fooA.bar, 'corge');
      test.equal(fooA.id, 'corge');
      test.equal(fooB.bar, 'quux');
      test.equal(fooB.baz, 'quux');
      test.equal(fooB.qux, 'quux corge');
      test.equal(fooB.getReference('baz'), fooB);
      test.equal(fooB.getReferences('qux')[1], fooA);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('ID type attribute may not have default', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar ID 'baz'>
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'ID');
    test.end();
  });
});
