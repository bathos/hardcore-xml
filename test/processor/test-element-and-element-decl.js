const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('twice declared element', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ELEMENT foo EMPTY>
    ]>

    <foo></foo>
  `).catch(err => {
    test.match(err.message, 'only once');
    test.end();
  });
});

tap.test('declared EMPTY element', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
    ]>

    <foo></foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared EMPTY element (self-closing)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
    ]>

    <foo/>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared EMPTY element (whitespace)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
    ]>

    <foo> </foo>
  `).catch(err => {
    test.match(err.message, 'EMPTY');
    test.end();
  });
});

tap.test('declared ANY element', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo ANY>
    ]>

    <foo>
      <foo/>
      <foo>cdata</foo>
      <foo><!--bar--></foo>
    </foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(
        elem.map(node => node.name || node.typeName).join(' '),
        '#text foo #text foo #text foo #text'
      );
      test.equal(elem[3][0].text, 'cdata');
      test.equal(elem[5][0].content, 'bar');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared MIXED element (cdata only)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA)*>
    ]>

    <foo>bar</foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem[0].text, 'bar');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared MIXED element (cdata only, violated)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA)*>
    ]>

    <foo>bar<foo>baz</foo></foo>
  `).catch(err => {
    test.match(err.message, 'content spec');
    test.end();
  });
});

tap.test('declared MIXED element (with children)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA|foo)*>
    ]>

    <foo>bar<foo>baz</foo></foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem[0].text, 'bar');
      test.equal(elem[1].name, 'foo');
      test.equal(elem[1][0].text, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared MIXED element (with children, violated)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA|foo|bar)*>
      <!ELEMENT bar ANY>
      <!ELEMENT baz ANY>
    ]>

    <foo><foo/><bar/><baz/></foo>
  `).catch(err => {
    test.match(err.message, 'baz');
    test.end();
  });
});

tap.test('declared MIXED element (with dupes)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA|foo|foo)*>
    ]>

    <foo><foo/></foo>
  `).catch(err => {
    test.match(err.message, 'appear twice');
    test.end();
  });
});

tap.test('declared element (with series child, singular)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar)>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><bar/></foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem[0].name, 'bar');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared element (with series children)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar, baz, qux)>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><bar/><baz/><qux/></foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem[0].name, 'bar');
      test.equal(elem[1].name, 'baz');
      test.equal(elem[2].name, 'qux');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared element (with series children, sum invalid)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar, baz, qux)>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><bar/><baz/></foo>
  `).catch(err => {
    test.match(err.message, 'conform to declared content spec');
    test.end();
  });
});

tap.test('declared element (with series children, medial invalid)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar, baz, qux)>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><bar/><qux/><baz/></foo>
  `).catch(err => {
    test.match(err.message, 'qux');
    test.end();
  });
});

tap.test('declared element (with choice children)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (qux|baz|bar)>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><baz/></foo>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem[0].name, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared element (with choice children, invalid)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (qux|baz|bar)>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><baz/><baz/></foo>
  `).catch(err => {
    test.match(err.message, 'baz');
    test.end();
  });
});

tap.test('declared element (with complex children)', test => {
  // That we accept this pattern — which is perfectly rational — may or may not
  // violate the constraints put forth re: ‘determinism’ and ‘ambiguity’ in the
  // spec, because the first and final members of the series could be considered
  // ambiguous on account of the outermost qualifier, a case we aren’t currently
  // factoring in. I’ll have to research this more to decide whether we are
  // supposed to barf on this, but for now this test serves to document the
  // behavior (if we change it, we just change the test to expect an error).

  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo ((qux|baz*|bar),qux+,(baz|bar)?)*>
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><baz/><baz/><qux/><qux/><qux/><qux/><bar/></foo>
  `).then(([ , elem ]) => {
      test.equal(elem.length, 7);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared element (with disallowed pattern)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (qux*,qux+)>
      <!ELEMENT qux EMPTY>
    ]>

    <foo><qux/></foo>
  `).catch(err => {
    test.match(err.message, 'deterministic');
    test.end();
  });
});

tap.test('declared element with undeclared attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
    ]>

    <foo bar="baz"/>
  `).catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});

tap.test('malformed ATTLIST (test series driver)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLISZT foo bar CDATA #IMPLIED>
    ]>

    <foo bar="baz"/>
  `).catch(err => {
    test.match(err.message, 'third "T"');
    test.end();
  });
});
