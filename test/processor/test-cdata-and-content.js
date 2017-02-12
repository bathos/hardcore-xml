const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('cdata', test => {
  parse('<foo>bar</foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 1);
      test.equal(elem[0].text, 'bar');
      test.equal(elem[0].section, false);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('cdata and markup', test => {
  parse('<foo>bar<baz/>qux<!--quux-->corge<?grault?></foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 6);
      test.equal(elem[0].text, 'bar');
      test.equal(elem[1].name, 'baz');
      test.equal(elem[2].text, 'qux');
      test.equal(elem[3].content, 'quux');
      test.equal(elem[4].text, 'corge');
      test.equal(elem[5].target, 'grault');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('predefined general entities', test => {
  parse('<foo>bar&lt;baz&gt;</foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 1);
      test.equal(elem[0].text, 'bar<baz>');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('undefined general entities', test => {
  parse('<foo>bar&baz;</foo>')
    .catch(err => {
      test.match(err.message, 'entity "baz"');
      test.end();
    });
});

tap.test('character references', test => {
  parse('<foo>&#x26;&#38;</foo>')
    .then(([ [ cdata ] ]) => {
      test.equal(cdata.text, '&&');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('bad character reference', test => {
  parse('<foo>&#x00;</foo>')
    .catch(err => {
      test.match(err.message, 'legal XML char');
      test.end();
    });
});

tap.test('cdata section', test => {
  parse('<foo>bar<![CDATA[baz]]></foo>')
    .then(([ [ cdata1, cdata2 ] ]) => {
      test.equal(cdata1.text, 'bar');
      test.equal(cdata2.text, 'baz');
      test.equal(cdata2.section, true);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('cdata section with valid interior "]"s', test => {
  parse('<foo>bar<![CDATA[baz]qux]]quux]]]></foo>')
    .then(([ [ cdata1, cdata2 ] ]) => {
      test.equal(cdata1.text, 'bar');
      test.equal(cdata2.text, 'baz]qux]]quux]');
      test.equal(cdata2.section, true);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('invalid cdata', test => {
  parse('<foo>bar]]]]]]]></foo>')
    .catch(err => {
      test.match(err.message, ']]>');
      test.end();
    });
});

tap.test('cdata with valid "]" sequences', test => {
  parse('<foo>bar]baz]]qux]] >quux]]&gt;</foo>')
    .then(([ [ cdata ] ]) => {
      test.equal(cdata.text, 'bar]baz]]qux]] >quux]]>');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('EMPTY element cannot have cdata content', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
    ]>

    <foo>bar</foo>
  `).catch(err => {
    test.match(err.message, 'no content');
    test.end();
  });
});

tap.test('EMPTY element cannot have markup', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
    ]>

    <foo><!--bar--></foo>
  `).catch(err => {
    test.match(err.message, 'no content');
    test.end();
  });
});

tap.test('EMPTY element cannot even have an empty ref', test => {
  parse(`
    <!DOCTYPE foo [
      <!ENTITY bar "">
      <!ELEMENT foo EMPTY>
    ]>

    <foo>&bar;</foo>
  `).catch(err => {
    test.match(err.message, 'no content');
    test.end();
  });
});

tap.test('mixed element can contain CDATA and declared elems', test => {
  parse(`
    <!DOCTYPE foo [
      <!ENTITY bar "<foo>baz</foo>">
      <!ELEMENT foo (#PCDATA|foo)*>
    ]>

    <foo>&bar;qux<foo>quux</foo> </foo>
  `).then(([ , fooA ]) => {
      test.equal(fooA.length, 4);

      const [ fooB, cdataA, fooC, cdataB ] = fooA;

      test.equal(fooB.name, 'foo');
      test.equal(fooB[0].text, 'baz');
      test.equal(cdataA.text, 'qux');
      test.equal(fooC[0].text, 'quux');
      test.equal(cdataB.text, ' ');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('mixed element is constrained to specified set of elems', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA|foo)*>
      <!ELEMENT bar ANY>
    ]>

    <foo><bar/></foo>
  `).catch(err => {
    test.match(err.message, 'content spec');
    test.end();
  });
});

tap.test('children element cannot contain cdata', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar)>
      <!ELEMENT bar EMPTY>
    ]>

    <foo><bar/>baz</foo>
  `).catch(err => {
    test.match(err.message, 'no CDATA');
    test.end();
  });
});

tap.test('...but children element does not see whitespace as cdata', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar)>
      <!ELEMENT bar EMPTY>
    ]>

    <foo>
      <bar/>
    </foo>
  `).then(([ , fooA ]) => {
      test.equal(fooA.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('...not even if it is from an entity expansion', test => {
  parse(`
    <!DOCTYPE foo [
      <!ENTITY baz " ">
      <!ELEMENT foo (bar)>
      <!ELEMENT bar EMPTY>
    ]>

    <foo>
      <bar/>
      &baz;
    </foo>
  `).then(([ , fooA ]) => {
      test.equal(fooA.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('...but character references to whitespace are always cdata', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar)>
      <!ELEMENT bar EMPTY>
    ]>

    <foo>
      <bar/>
      &#x0D;
    </foo>
  `).catch(err => {
    test.match(err.message, 'no CDATA');
    test.end();
  });
});

tap.test('...as are CDATA sections', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (bar)>
      <!ELEMENT bar EMPTY>
    ]>

    <foo>
      <bar/>
      <![CDATA[ ]]>
    </foo>
  `).catch(err => {
    test.match(err.message, 'no CDATA');
    test.end();
  });
});

tap.test('entity reference in content must be general', test => {
  parse(`
    <!DOCTYPE foo [
      <!ENTITY % bar "baz">
      <!ELEMENT foo ANY>
    ]>

    <foo>&bar;</foo>
  `).catch(err => {
    test.match(err.message, 'be a general entity');
    test.end();
  });
});
